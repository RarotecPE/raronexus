import { USER_ROLE_COOKIE_NAME } from "@/components/auth/constants";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { GLOBAL_SESSION_COOKIE_NAME, GlobalSessionService } from "@/lib/api/services/global-session-service";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);
    const service = new GlobalSessionService();
    const token = service.getTokenFromCookie(request);

    if (token) {
      try {
        const session = await service.validateToken(token);
        if (session?.user) {
          auditClient.log({
            system: "raronexus",
            category: "auth",
            action: "user.logout",
            severity: "INFO",
            status: "SUCCESS",
            actor: {
              type: "user",
              userId: session.user.id,
              email: session.user.email,
            },
            targets: [
              {
                type: "user",
                id: session.user.id || "unknown",
                label: session.user.email || "Usuário",
              },
            ],
            context: getRequestContext(request),
            details: {
              reason: "logout_voluntario",
            },
          });
        }
      } catch {
        // Ignora erro ao inspecionar token expirado/inválido antes da revogação
      }
    }

    const result = token ? await service.revokeToken(token) : { revoked: false };
    const response = ok(result);
    response.cookies.delete(GLOBAL_SESSION_COOKIE_NAME);
    response.cookies.delete(USER_ROLE_COOKIE_NAME);
    return response;
  });
}
