import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { resendInviteSchema } from "@/lib/api/validators/user";
import { auditClient, getRequestContext } from "@/lib/audit";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 10, 60_000, "user-invites-resend");
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const rawBody = await request.text();
    const parsedBody = rawBody.trim() ? resendInviteSchema.parse(JSON.parse(rawBody)) : undefined;
    const result = await new UserService().resendInvite(context, id, request.url, parsedBody?.expires_in_hours);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.invite_resent",
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
          type: "invite",
          id: result.id,
          label: result.email,
        },
      ],
      context: getRequestContext(request),
      details: {
        email: result.email,
        expires_at: result.expires_at,
      },
    });

    return ok(result);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000, "user-invites-cancel");
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const result = await new UserService().cancelInvite(context, id);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.invite_cancelled",
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
          type: "invite",
          id: result.id,
          label: result.email,
        },
      ],
      context: getRequestContext(request),
      details: {
        email: result.email,
        status: result.status,
      },
    });

    return ok(result);
  });
}
