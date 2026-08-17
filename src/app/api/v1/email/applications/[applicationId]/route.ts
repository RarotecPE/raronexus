import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { applicationEmailSettingsInputSchema } from "@/lib/api/validators/email";
import { z } from "zod";

const applicationIdSchema = z.uuid();

export async function PUT(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const { applicationId } = await params;
    const id = applicationIdSchema.parse(applicationId);
    const input = applicationEmailSettingsInputSchema.parse(await request.json());
    return ok(await new EmailService().updateApplicationSettings(context, id, input));
  });
}
