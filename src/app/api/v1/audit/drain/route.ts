import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ApiException } from "@/lib/api/errors";
import { drainAuditBatch } from "@/lib/audit/drain";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 30, 60_000, "audit-drain-admin");
    const context = await new AuthService().authenticate(request);

    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso restrito a administradores.", "FORBIDDEN", 403);
    }

    const result = await drainAuditBatch({ batchSize: 50 });

    return ok({
      drained: result.inserted,
      totalProcessed: result.processed,
      dlq: result.dlq,
      locked: result.locked,
      message: result.message || `${result.inserted} evento(s) persistido(s) no MongoDB Atlas com sucesso.`,
      stats: result.stats,
    });
  });
}
