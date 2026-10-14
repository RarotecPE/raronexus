import { USER_ROLE_COOKIE_NAME } from "@/components/auth/constants";
import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditRepository } from "@/lib/api/repositories/audit-repository";
import { AuthService } from "@/lib/api/services/auth-service";
import { GLOBAL_SESSION_COOKIE_NAME, GlobalSessionService } from "@/lib/api/services/global-session-service";
import { loginSchema } from "@/lib/api/validators/user";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 32, 60_000);
    const context = getRequestContext(request);
    const input = loginSchema.parse(await request.json());

    let data;
    try {
      data = await new AuthService().login(input.cpf, input.password);
    } catch (loginError) {
      auditClient.log({
        system: "raronexus",
        category: "auth",
        action: "auth.login_failed",
        severity: "WARNING",
        status: "FAILURE",
        actor: {
          type: "anonymous",
          name: "Tentativa de Login",
        },
        targets: [
          {
            type: "cpf",
            id: input.cpf,
            label: `CPF ${input.cpf}`,
          },
        ],
        context,
        details: {
          reason: loginError instanceof Error ? loginError.message : "Credenciais inválidas",
        },
      });
      throw loginError;
    }

    const globalSessionToken = await new GlobalSessionService().createForUser({ id: data.user.id }, request);

    await new AuditRepository(createAdminSupabaseClient()).log({
      user_id: data.user.id,
      event: "login_realizado",
    });

    auditClient.log({
      system: "raronexus",
      category: "auth",
      action: "user.login",
      severity: "INFO",
      status: "SUCCESS",
      actor: {
        type: "user",
        userId: data.user.id,
        name: data.user.nome,
        email: data.user.email,
        role: data.user.is_admin ? "admin" : "user",
      },
      targets: [
        {
          type: "user",
          id: data.user.id,
          label: data.user.nome,
        },
      ],
      context,
      details: {
        method: "cpf_password",
      },
    });

    const response = ok({ ...data, global_session_token: globalSessionToken });
    response.cookies.set(GLOBAL_SESSION_COOKIE_NAME, globalSessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.cookies.set(USER_ROLE_COOKIE_NAME, data.user.is_admin ? "admin" : "user", {
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  });
}
