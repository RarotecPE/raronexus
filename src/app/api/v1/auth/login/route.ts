import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditRepository } from "@/lib/api/repositories/audit-repository";
import { AuthService } from "@/lib/api/services/auth-service";
import { GLOBAL_SESSION_COOKIE_NAME, GlobalSessionService } from "@/lib/api/services/global-session-service";
import { loginSchema } from "@/lib/api/validators/user";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 32, 60_000);
    const input = loginSchema.parse(await request.json());
    const data = await new AuthService().login(input.cpf, input.password);
    const globalSessionToken = await new GlobalSessionService().createForUser({ id: data.user.id }, request);

    await new AuditRepository(createAdminSupabaseClient()).log({
      user_id: data.user.id,
      event: "login_realizado",
    });

    const response = ok({ ...data, global_session_token: globalSessionToken });
    response.cookies.set(GLOBAL_SESSION_COOKIE_NAME, globalSessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    return response;
  });
}
