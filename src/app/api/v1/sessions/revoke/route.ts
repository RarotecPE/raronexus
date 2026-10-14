import { z } from "zod";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { GlobalSessionService } from "@/lib/api/services/global-session-service";
import { auditClient, getRequestContext } from "@/lib/audit";

const revokeSchema = z.object({
  token: z.string().min(32),
});

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);
    const input = revokeSchema.parse(await request.json());
    const result = await new GlobalSessionService().revokeToken(input.token);

    auditClient.log({
      system: "raronexus",
      category: "auth",
      action: "auth.session_revoked",
      severity: "INFO",
      status: "SUCCESS",
      actor: {
        type: "system",
      },
      context: getRequestContext(request),
      details: {
        revoked: result.revoked,
      },
    });

    return ok(result);
  });
}
