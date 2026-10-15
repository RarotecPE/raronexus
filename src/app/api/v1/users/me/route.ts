import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { profileSchema } from "@/lib/api/validators/user";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request);
    const context = await new AuthService().authenticate(request);
    return ok(await new UserService().me(context));
  });
}

export async function PUT(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = profileSchema.parse(await request.json());
    const existing = context.profile;
    const updated = await new UserService().updateMe(context, input);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.profile_updated",
      severity: "INFO",
      status: "SUCCESS",
      actor: {
        type: "user",
        userId: updated.id,
        name: updated.nome ?? updated.email,
        email: updated.email,
        role: updated.is_admin ? "admin" : "user",
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
        before: {
          nome: existing?.nome ?? null,
          telefone: existing?.telefone ?? null,
          avatar_url: existing?.avatar_url ?? null,
        },
        after: {
          nome: updated.nome ?? null,
          telefone: updated.telefone ?? null,
          avatar_url: updated.avatar_url ?? null,
        },
      },
      details: {
        changes: input,
      },
    });

    return ok(updated);
  });
}
