import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { updateEmailAdminSettingsSchema } from "@/lib/api/validators/email";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request);
    const context = await new AuthService().authenticate(request);
    return ok(await new EmailService().listAdminSettings(context));
  });
}

export async function PUT(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = updateEmailAdminSettingsSchema.parse(await request.json());
    const updated = await new EmailService().updateAdminSettings(context, input);

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
          id: "admin",
          label: "Configurações Administrativas de E-mail",
        },
      ],
      context: getRequestContext(request),
      details: {
        scope: "admin_settings",
        endpoints_count: input.endpoints.length,
        applications_count: input.applications.length,
      },
    });

    return ok(updated);
  });
}
