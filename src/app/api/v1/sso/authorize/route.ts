import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { GLOBAL_SESSION_COOKIE_NAME, GlobalSessionService } from "@/lib/api/services/global-session-service";
import { SsoService, ssoAuthorizeSchema } from "@/lib/api/services/sso-service";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);
    let context = await new AuthService().authenticate(request);
    let globalSessionToken: string | null = null;

    if (!context.globalSessionId && context.profile) {
      const created = await new GlobalSessionService().createForUserSession(context.profile, request);
      globalSessionToken = created.token;
      context = {
        ...context,
        token: created.token,
        globalSessionId: created.session.id,
      };
    }

    const input = ssoAuthorizeSchema.parse(await request.json());
    const response = ok(await new SsoService().authorize(context, input));

    if (globalSessionToken) {
      response.cookies.set(GLOBAL_SESSION_COOKIE_NAME, globalSessionToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }

    return response;
  });
}
