import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { SsoService, ssoAuthorizeSchema } from "@/lib/api/services/sso-service";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = ssoAuthorizeSchema.parse(await request.json());
    return ok(await new SsoService().authorize(context, input));
  });
}
