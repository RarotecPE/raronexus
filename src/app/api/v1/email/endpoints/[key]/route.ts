import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { EmailService } from "@/lib/api/services/email-service";
import { emailEndpointInputSchema, emailEndpointSchema } from "@/lib/api/validators/email";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function PUT(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handleApi(async () => {
    rateLimit(request, 30, 60_000);
    const context = await new AuthService().authenticate(request);
    const { key } = await params;
    const endpointKey = emailEndpointSchema.parse(key);
    const input = emailEndpointInputSchema.parse(await request.json());
    const updated = await new EmailService().updateEndpoint(context, endpointKey, input);

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
          id: updated.id || updated.key,
          label: updated.name || updated.key,
        },
      ],
      context: getRequestContext(request),
      details: {
        operation: "updated",
        endpoint_key: updated.key,
        name: updated.name,
        active: updated.active,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000);
    const context = await new AuthService().authenticate(request);
    const { key } = await params;
    const endpointKey = emailEndpointSchema.parse(key);
    const result = await new EmailService().deleteEndpoint(context, endpointKey);

    auditClient.log({
      system: "raronexus",
      category: "email",
      action: "email.endpoint_deleted",
      severity: "WARNING",
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
          id: endpointKey,
          label: endpointKey,
        },
      ],
      context: getRequestContext(request),
      details: {
        endpoint_key: endpointKey,
      },
    });

    return ok(result);
  });
}
