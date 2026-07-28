import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { SsoService, ssoTokenSchema } from "@/lib/api/services/sso-service";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 120, 60_000);
    const input = ssoTokenSchema.parse(await request.json());
    return ok(await new SsoService().token(input));
  });
}
