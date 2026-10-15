import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { SsoService, ssoTokenSchema } from "@/lib/api/services/sso-service";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 120, 60_000);
    const input = ssoTokenSchema.parse(await request.json());
    const result = await new SsoService().token(input);

    auditClient.log({
      system: "raronexus",
      category: "auth",
      action: "auth.sso_token_issued",
      severity: "INFO",
      status: "SUCCESS",
      actor: {
        type: "user",
        userId: result.user.id,
        name: result.user.nome,
        email: result.user.email,
        role: result.role.chave,
      },
      targets: [
        {
          type: "application",
          id: result.application.id,
          label: result.application.nome,
        },
        {
          type: "user",
          id: result.user.id,
          label: result.user.nome,
        },
      ],
      context: getRequestContext(request),
      details: {
        platform: result.application.nome,
        client_id: result.application.client_id,
        role: result.role.chave,
        user_email: result.user.email,
      },
    });

    return ok(result);
  });
}
