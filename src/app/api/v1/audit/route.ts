import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ApiException } from "@/lib/api/errors";
import { getAuditCollection } from "@/lib/audit/mongo";
import { getAuditRedisClient, AUDIT_STREAM_KEY } from "@/lib/audit/queue";
import { drainAuditBatch } from "@/lib/audit/drain";
import { tokenize } from "@/lib/audit/tokens";
import type { AuditEnvelope } from "@/lib/audit/types";
import type { Filter } from "mongodb";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ApplicationRepository } from "@/lib/api/repositories/application-repository";

function normalizeSystemKey(raw?: string | null): string {
  if (!raw) return "";
  const lower = raw.toLowerCase().trim();
  if (lower.startsWith("rarostock")) return "rarostock";
  if (lower.startsWith("raronexus")) return "raronexus";
  if (lower.startsWith("rarogestao")) return "rarogestao";
  if (lower.startsWith("raroclients")) return "raroclients";
  if (lower.startsWith("raropay")) return "raropay";
  if (lower.startsWith("rarotickets")) return "rarotickets";
  return lower.replace(/[_-](homolog|prod|producao|dev|teste).*$/, "");
}

function getSystemVariants(rawKey: string): string[] {
  const canonical = normalizeSystemKey(rawKey);
  const variants = new Set<string>([
    rawKey.toLowerCase().trim(),
    canonical,
    `${canonical}_homolog`,
    `${canonical}-homolog`,
    `${canonical}_prod`,
    `${canonical}-prod`,
    `${canonical}_dev`,
    `${canonical}-dev`,
  ]);
  return Array.from(variants);
}

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000, "audit-admin");
    const context = await new AuthService().authenticate(request);

    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso restrito a administradores.", "FORBIDDEN", 403);
    }

    const collection = await getAuditCollection();

    // Drenagem automática transparente com lock distribuído e encadeamento criptográfico contínuo
    try {
      await drainAuditBatch({ batchSize: 100 });
    } catch (drainErr) {
      console.warn("[AutoDrain Queue Warning]:", drainErr);
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || url.searchParams.get("searches")?.trim();
    const action = url.searchParams.get("action")?.trim() || url.searchParams.get("actions")?.trim();
    const actor = url.searchParams.get("actor")?.trim() || url.searchParams.get("actors")?.trim();
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

    // 1. Sistemas múltiplos (com expansão de variantes e aliases canônicos)
    if (systemsParam && systemsParam !== "all") {
      const requestedSystems = systemsParam.split(",").map((s) => s.trim()).filter(Boolean);
      const expandedSystems = new Set<string>();

      for (const reqSys of requestedSystems) {
        const variants = getSystemVariants(reqSys);
        for (const v of variants) {
          expandedSystems.add(v);
        }
      }

      const matchSystems = Array.from(expandedSystems);
      if (matchSystems.length === 1) {
        filter.system = matchSystems[0] as any;
      } else if (matchSystems.length > 1) {
        filter.system = { $in: matchSystems } as any;
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

    // 5. Ação/Categoria e Ator (filtros de texto com suporte a múltiplos termos separados por vírgula)
    const textConditions: Filter<AuditEnvelope>[] = [];

    if (action) {
      const actionList = action.split(",").map((s) => s.trim()).filter(Boolean);
      if (actionList.length === 1) {
        const escapedAction = actionList[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const actionRegex = new RegExp(escapedAction, "i");
        textConditions.push({
          $or: [
            { action: actionRegex },
            { category: actionRegex },
          ],
        });
      } else if (actionList.length > 1) {
        textConditions.push({
          $or: actionList.flatMap((act) => {
            const escaped = act.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const reg = new RegExp(escaped, "i");
            return [
              { action: reg },
              { category: reg },
            ];
          }),
        });
      }
    }

    if (actor) {
      const actorList = actor.split(",").map((s) => s.trim()).filter(Boolean);
      if (actorList.length === 1) {
        const escapedActor = actorList[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const actorRegex = new RegExp(escapedActor, "i");
        textConditions.push({
          $or: [
            { "actor.name": actorRegex } as any,
            { "actor.email": actorRegex } as any,
            { "actor.userId": actorRegex } as any,
            { "actor.role": actorRegex } as any,
          ],
        });
      } else if (actorList.length > 1) {
        textConditions.push({
          $or: actorList.flatMap((act) => {
            const escaped = act.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const reg = new RegExp(escaped, "i");
            return [
              { "actor.name": reg } as any,
              { "actor.email": reg } as any,
              { "actor.userId": reg } as any,
              { "actor.role": reg } as any,
            ];
          }),
        });
      }
    }

    if (textConditions.length === 1) {
      Object.assign(filter, textConditions[0]);
    } else if (textConditions.length > 1) {
      filter.$and = textConditions;
    }

    // 6. Busca textual geral (suporta múltiplos termos)
    if (search) {
      const searchTerms = search.split(",").map((s) => s.trim()).filter(Boolean);
      const searchWords = searchTerms.flatMap((term) => tokenize(term));
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

    // Plataformas cadastradas mapeadas para chaves canônicas (evita dessincronização e duplicatas)
    const DEFAULT_PLATFORMS: Array<{ clientId: string; name: string }> = [
      { clientId: "raronexus", name: "RaroNexus" },
      { clientId: "rarostock", name: "Rarostock" },
      { clientId: "rarogestao", name: "RaroGestão" },
      { clientId: "raroclients", name: "RaroClients" },
      { clientId: "raropay", name: "RaroPay" },
      { clientId: "rarotickets", name: "RaroTickets" },
    ];

    const platformsMap = new Map<string, { clientId: string; name: string }>();
    for (const p of DEFAULT_PLATFORMS) {
      platformsMap.set(p.clientId, { ...p });
    }

    try {
      const supabase = createAdminSupabaseClient();
      const repo = new ApplicationRepository(supabase);
      const registeredApps = await repo.listAll();
      for (const app of registeredApps) {
        if (!app.client_id) continue;
        const canonical = normalizeSystemKey(app.client_id);
        const existing = platformsMap.get(canonical);
        const friendlyName = app.nome || existing?.name || canonical;
        platformsMap.set(canonical, {
          clientId: canonical,
          name: friendlyName,
        });
      }
    } catch (platformErr) {
      console.warn("[Audit Route] Erro ao carregar aplicações cadastradas:", platformErr);
    }

    // Adiciona qualquer sistema que já tenha emitido eventos no banco (retrocompatibilidade)
    for (const item of systemAgg) {
      if (!item._id) continue;
      const canonical = normalizeSystemKey(item._id);
      if (!platformsMap.has(canonical)) {
        platformsMap.set(canonical, {
          clientId: canonical,
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
      if (item._id) {
        const canonical = normalizeSystemKey(item._id);
        bySystem[canonical] = (bySystem[canonical] || 0) + item.count;
      }
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
