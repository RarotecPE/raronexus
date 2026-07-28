import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuditRepository } from "@/lib/api/repositories/audit-repository";
import { AuthService } from "@/lib/api/services/auth-service";
import { loginSchema } from "@/lib/api/validators/user";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 16, 60_000);
    const input = loginSchema.parse(await request.json());
    const data = await new AuthService().login(input.email, input.password);

    await new AuditRepository(createAdminSupabaseClient()).log({
      user_id: data.user.id,
      event: "login_realizado",
    });

    return ok(data);
  });
}
