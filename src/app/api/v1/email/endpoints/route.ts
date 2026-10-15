import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { emailEndpointInputSchema } from "@/lib/api/validators/email";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 30, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = emailEndpointInputSchema.parse(await request.json());
    const created = await new EmailService().createEndpoint(context, input);

    auditClient.log({
      system: "raronexus",
      category: "email",
      action: "email.endpoint_configured",
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
          type: "email_endpoint",
          id: created.id || created.key,
          label: created.name || created.key,
        },
      ],
      context: getRequestContext(request),
      details: {
        operation: "created",
        endpoint_key: created.key,
        name: created.name,
        active: created.active,
      },
    });

    return ok(created, { status: 201 });
  });
}
