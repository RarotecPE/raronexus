import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserService } from "@/lib/api/services/user-service";
import { createUserSchema } from "@/lib/api/validators/user";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request);
    const context = await new AuthService().authenticate(request);
    const url = new URL(request.url);
    return ok(await new UserService().list(context, url.searchParams.get("search") ?? undefined));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000, "user-invites-create");
    const context = await new AuthService().authenticate(request);
    const input = createUserSchema.parse(await request.json());
    const created = await new UserService().create(context, input, request.url);

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.invited",
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
          id: (created as any)?.id || input.email,
          label: (created as any)?.nome || input.email,
        },
      ],
      context: getRequestContext(request),
      details: {
        email: input.email,
        is_admin: input.is_admin,
      },
    });

    return ok(created, { status: 201 });
  });
}
