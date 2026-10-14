import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ApiException } from "@/lib/api/errors";
import { getAuditCollection } from "@/lib/audit/mongo";
import { getAuditRedisClient, AUDIT_STREAM_KEY } from "@/lib/audit/queue";
import { tokenize } from "@/lib/audit/tokens";
import type { AuditEnvelope } from "@/lib/audit/types";
import type { Filter } from "mongodb";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000, "audit-admin");
    const context = await new AuthService().authenticate(request);

    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso restrito a administradores.", "FORBIDDEN", 403);
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const system = url.searchParams.get("system")?.trim();
    const severity = url.searchParams.get("severity")?.trim();
    const status = url.searchParams.get("status")?.trim();
    const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10), 1), 100);
    const skip = Math.max(parseInt(url.searchParams.get("skip") || "0", 10), 0);

    const collection = await getAuditCollection();

    // Monta filtro MongoDB
    const filter: Filter<AuditEnvelope> = {};

    if (system && system !== "all") {
      filter.system = system as any;
    }

    if (severity && severity !== "all") {
      filter.severity = severity as any;
    }

    if (status && status !== "all") {
      filter.status = status as any;
    }

    if (search) {
      const searchWords = tokenize(search);
      if (searchWords.length > 0) {
        filter.searchTokens = { $all: searchWords };
      }
    }

    // Consulta paginada
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

    // Tamanho da fila pendente no Redis
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
      skip,
      limit,
      stats: {
        totalEvents: totalAll,
        pendingQueueCount,
        bySystem,
        bySeverity,
      },
    });
  });
}
