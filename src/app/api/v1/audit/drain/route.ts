import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ApiException } from "@/lib/api/errors";
import { getAuditCollection } from "@/lib/audit/mongo";
import { readAuditBatchFromQueue, ackAuditMessages, pushToDLQ } from "@/lib/audit/queue";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 30, 60_000, "audit-drain-admin");
    const context = await new AuthService().authenticate(request);

    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso restrito a administradores.", "FORBIDDEN", 403);
    }

    const BATCH_SIZE = 50;
    const batch = await readAuditBatchFromQueue(BATCH_SIZE);

    if (batch.length === 0) {
      return ok({ drained: 0, message: "A fila já está vazia." });
    }

    const collection = await getAuditCollection();
    const validEnvelopes: typeof batch[number]["envelope"][] = [];
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

    let insertedCount = 0;
    if (validEnvelopes.length > 0) {
      try {
        const insertResult = await collection.insertMany(validEnvelopes, { ordered: false });
        insertedCount = insertResult.insertedCount;
      } catch (insertErr: any) {
        if (insertErr?.code === 11000) {
          insertedCount = insertErr.result?.nInserted || 0;
        } else {
          throw insertErr;
        }
      }
    }

    await ackAuditMessages(validMessageIds);

    return ok({
      drained: insertedCount,
      totalProcessed: validMessageIds.length,
      message: `${insertedCount} evento(s) persistido(s) no MongoDB Atlas com sucesso.`,
    });
  });
}
