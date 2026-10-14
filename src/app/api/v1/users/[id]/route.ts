import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { updateUserSchema } from "@/lib/api/validators/user";
import { auditClient, getRequestContext } from "@/lib/audit";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new UserService().find(context, id));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateUserSchema.parse(await request.json());
    const existing = await new UserService().find(context, id);
    const updated = await new UserService().update(context, id, input);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.updated",
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
          type: "user",
          id: updated.id,
          label: updated.nome ?? updated.email,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: existing as unknown as Record<string, unknown>,
        after: updated as unknown as Record<string, unknown>,
      },
      details: {
        changes: input,
      },
    });

    return ok(updated);
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const result = await new UserService().remove(context, id);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.deleted",
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
          type: "user",
          id,
          label: `User ${id}`,
        },
      ],
      context: getRequestContext(request),
      details: {
        deleted: true,
      },
    });

    return ok(result);
  });
}
