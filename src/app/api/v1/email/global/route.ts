import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { emailGlobalSettingsSchema } from "@/lib/api/validators/email";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function PUT(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = emailGlobalSettingsSchema.parse(await request.json());
    const updated = await new EmailService().updateGlobalSettings(context, input);

    auditClient.log({
      system: "raronexus",
      category: "email",
      action: "smtp.settings_updated",
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
          type: "email_settings",
          id: "global",
          label: "Configurações Globais de E-mail",
        },
      ],
      context: getRequestContext(request),
      details: {
        scope: "global",
        settings: input,
      },
    });

    return ok(updated);
  });
}
