import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { emailGlobalSettingsSchema } from "@/lib/api/validators/email";

export async function PUT(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = emailGlobalSettingsSchema.parse(await request.json());
    return ok(await new EmailService().updateGlobalSettings(context, input));
  });
}
