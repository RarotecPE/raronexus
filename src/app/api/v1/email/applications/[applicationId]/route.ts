import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { applicationEmailSettingsInputSchema } from "@/lib/api/validators/email";
import { auditClient, getRequestContext } from "@/lib/audit";
import { z } from "zod";

const applicationIdSchema = z.uuid();

export async function PUT(request: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const { applicationId } = await params;
    const id = applicationIdSchema.parse(applicationId);
    const input = applicationEmailSettingsInputSchema.parse(await request.json());
    const updated = await new EmailService().updateApplicationSettings(context, id, input);

    auditClient.log({
      system: "raronexus",
      category: "email",
      action: "email.application_settings_updated",
      severity: "INFO",
      status: "SUCCESS",
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
          id: updated.application_id,
          label: updated.application_nome,
        },
      ],
      context: getRequestContext(request),
      details: {
        display_name: updated.display_name,
        reply_to_email: updated.reply_to_email,
        endpoints: updated.endpoints,
      },
    });

    return ok(updated);
  });
}
