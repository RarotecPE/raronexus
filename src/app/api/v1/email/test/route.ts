import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { adminEmailTestSchema } from "@/lib/api/validators/email";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = adminEmailTestSchema.parse(await request.json());
    return ok(await new EmailService().testFromAdmin(context, input));
  });
}
