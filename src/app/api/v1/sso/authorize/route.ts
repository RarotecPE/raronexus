import { ApiException } from "@/lib/api/errors";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { GLOBAL_SESSION_COOKIE_NAME, GlobalSessionService } from "@/lib/api/services/global-session-service";
import { SsoService, ssoAuthorizeSchema } from "@/lib/api/services/sso-service";
import { auditClient, getRequestContext } from "@/lib/audit";

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
    let authResult;
    try {
      authResult = await new SsoService().authorize(context, input);
    } catch (error) {
      if (error instanceof ApiException && error.code === "PROFILE_NOT_FOUND") {
        auditClient.log({
          system: "raronexus",
          category: "auth",
          action: "auth.sso_access_denied",
          severity: "WARNING",
          status: "FAILURE",
          actor: {
            type: "user",
            userId: context.profile?.id ?? context.authUserId,
            name: context.profile?.nome ?? context.email,
            email: context.profile?.email ?? context.email,
            role: context.profile?.is_admin ? "admin" : "user",
          },
          targets: [
            {
              type: "application",
              id: input.client_id,
              label: input.client_id,
            },
          ],
          context: getRequestContext(request),
          details: {
            client_id: input.client_id,
            redirect_uri: input.redirect_uri,
            reason: error.message,
          },
        });
      }
      throw error;
    }

    if (authResult.redirect_to.includes("error=access_denied")) {
      auditClient.log({
        system: "raronexus",
        category: "auth",
        action: "auth.sso_access_denied",
        severity: "WARNING",
        status: "FAILURE",
        actor: {
          type: "user",
          userId: context.profile?.id ?? context.authUserId,
          name: context.profile?.nome ?? context.email,
          email: context.profile?.email ?? context.email,
          role: context.profile?.is_admin ? "admin" : "user",
        },
        targets: [
          {
            type: "application",
            id: input.client_id,
            label: input.client_id,
          },
        ],
        context: getRequestContext(request),
        details: {
          client_id: input.client_id,
          redirect_uri: input.redirect_uri,
          reason: "nao_autorizado",
        },
      });
    }

    const response = ok(authResult);

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
