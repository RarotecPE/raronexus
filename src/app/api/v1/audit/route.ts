import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ApiException } from "@/lib/api/errors";
import { getAuditCollection } from "@/lib/audit/mongo";
import {
  getAuditRedisClient,
  AUDIT_STREAM_KEY,
  readAuditBatchFromQueue,
  ackAuditMessages,
  pushToDLQ,
} from "@/lib/audit/queue";
import { tokenize } from "@/lib/audit/tokens";
import type { AuditEnvelope } from "@/lib/audit/types";
import type { Filter } from "mongodb";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ApplicationRepository } from "@/lib/api/repositories/application-repository";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000, "audit-admin");
    const context = await new AuthService().authenticate(request);

    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso restrito a administradores.", "FORBIDDEN", 403);
    }

    const collection = await getAuditCollection();

    // Drenagem automática transparente: toda vez que o usuário consulta/atualiza
    try {
      const BATCH_SIZE = 100;
      const batch = await readAuditBatchFromQueue(BATCH_SIZE);

      if (batch.length > 0) {
        const validEnvelopes: AuditEnvelope[] = [];
        const validMessageIds: string[] = [];
        const nowIso = new Date().toISOString();

        for (const item of batch) {
          if (!item.envelope || !item.envelope._id) {
            await pushToDLQ(
              item.id,
              item.rawPayload,
              "Payload de auditoria inválido ou corrompido"
            );
            validMessageIds.push(item.id);
            continue;
          }

          item.envelope.ingestedAt = nowIso;
          validEnvelopes.push(item.envelope);
          validMessageIds.push(item.id);
        }

        if (validEnvelopes.length > 0) {
          try {
            await collection.insertMany(validEnvelopes, { ordered: false });
          } catch (insertErr: any) {
            if (insertErr?.code !== 11000) {
              console.error("[AutoDrain Error]:", insertErr);
            }
          }
        }

        await ackAuditMessages(validMessageIds);
      }
    } catch (drainErr) {
      console.warn("[AutoDrain Queue Warning]:", drainErr);
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const action = url.searchParams.get("action")?.trim();
    const startDate = url.searchParams.get("startDate")?.trim() || url.searchParams.get("from")?.trim();
    const endDate = url.searchParams.get("endDate")?.trim() || url.searchParams.get("to")?.trim();

    // Suporte a múltiplos filtros (vírgula ou parâmetro único)
    const systemsParam = url.searchParams.get("systems")?.trim() || url.searchParams.get("system")?.trim();
    const severitiesParam = url.searchParams.get("severities")?.trim() || url.searchParams.get("severity")?.trim();
    const statusesParam = url.searchParams.get("statuses")?.trim() || url.searchParams.get("status")?.trim();

    // Paginação
    const pageParam = parseInt(url.searchParams.get("page") || "1", 10);
    const page = Math.max(isNaN(pageParam) ? 1 : pageParam, 1);
    const limitParam = parseInt(url.searchParams.get("limit") || "25", 10);
    const limit = Math.min(Math.max(isNaN(limitParam) ? 25 : limitParam, 1), 100);
    const skip = (page - 1) * limit;

    // Monta filtro MongoDB
    const filter: Filter<AuditEnvelope> = {};

    // 1. Sistemas múltiplos
    if (systemsParam && systemsParam !== "all") {
      const systemsList = systemsParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (systemsList.length === 1) {
        filter.system = systemsList[0] as any;
      } else if (systemsList.length > 1) {
        filter.system = { $in: systemsList } as any;
      }
    }

    // 2. Severidades múltiplas
    if (severitiesParam && severitiesParam !== "all") {
      const sevList = severitiesParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (sevList.length === 1) {
        filter.severity = sevList[0] as any;
      } else if (sevList.length > 1) {
        filter.severity = { $in: sevList } as any;
      }
    }

    // 3. Status múltiplos
    if (statusesParam && statusesParam !== "all") {
      const statusList = statusesParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (statusList.length === 1) {
        filter.status = statusList[0] as any;
      } else if (statusList.length > 1) {
        filter.status = { $in: statusList } as any;
      }
    }

    // 4. Período direto (startDate / endDate)
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        const startIso = new Date(startDate).toISOString();
        if (startIso) filter.timestamp.$gte = startIso;
      }
      if (endDate) {
        const endIso = new Date(endDate).toISOString();
        if (endIso) filter.timestamp.$lte = endIso;
      }
    }

    // 5. Ação ou Categoria (texto livre digitado)
    if (action) {
      const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [
        { action: regex },
        { category: regex },
      ];
    }

    // 6. Busca textual geral
    if (search) {
      const searchWords = tokenize(search);
      if (searchWords.length > 0) {
        filter.searchTokens = { $all: searchWords };
      }
    }

    // Consulta paginada e agregações
    const [events, totalFiltered, totalAll, systemAgg, severityAgg] = await Promise.all([
      collection
        .find(filter)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
      collection.estimatedDocumentCount(),
      collection
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: "$system", count: { $sum: 1 } } },
        ])
        .toArray(),
      collection
        .aggregate<{ _id: string; count: number }>([
          { $group: { _id: "$severity", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    // Plataformas dinâmicas cadastradas no RaroNexus (Supabase)
    const platformsMap = new Map<string, { clientId: string; name: string }>();
    try {
      const supabase = createAdminSupabaseClient();
      const repo = new ApplicationRepository(supabase);
      const registeredApps = await repo.listAll();
      for (const app of registeredApps) {
        if (app.client_id) {
          platformsMap.set(app.client_id, {
            clientId: app.client_id,
            name: app.nome || app.client_id,
          });
        }
      }
    } catch (platformErr) {
      console.warn("[Audit Route] Erro ao carregar aplicações cadastradas:", platformErr);
    }

    // Adiciona qualquer sistema que já tenha emitido eventos no banco (retrocompatibilidade)
    for (const item of systemAgg) {
      if (item._id && !platformsMap.has(item._id)) {
        platformsMap.set(item._id, {
          clientId: item._id,
          name: item._id,
        });
      }
    }

    const platforms = Array.from(platformsMap.values());

    // Tamanho da fila pendente no Redis após drenagem
    let pendingQueueCount = 0;
    try {
      const redis = getAuditRedisClient();
      pendingQueueCount = await redis.xlen(AUDIT_STREAM_KEY);
    } catch {
      // Falha graciosa ao consultar Redis
    }

    const bySystem: Record<string, number> = {};
    for (const item of systemAgg) {
      if (item._id) bySystem[item._id] = item.count;
    }

    const bySeverity: Record<string, number> = {
      INFO: 0,
      WARNING: 0,
      CRITICAL: 0,
    };
    for (const item of severityAgg) {
      if (item._id) bySeverity[item._id] = item.count;
    }

    return ok({
      events,
      total: totalFiltered,
      page,
      limit,
      totalPages: Math.ceil(totalFiltered / limit),
      platforms,
      stats: {
        totalEvents: totalAll,
        pendingQueueCount,
        bySystem,
        bySeverity,
      },
    });
  });
}
