import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { AuthService } from "@/lib/api/services/auth-service";
import { ConstantService } from "@/lib/api/services/constant-service";
import { createConstantSchema } from "@/lib/api/validators/constant";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 90, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    return ok(await new ConstantService().list(context));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 20, 60_000, "constants-admin");
    const context = await new AuthService().authenticate(request);
    const input = createConstantSchema.parse(await request.json());
    const created = await new ConstantService().create(context, input);

    auditClient.log({
      system: "raronexus",
      category: "constants",
      action: "constant.created",
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
          type: "constant",
          id: created.id,
          label: created.name,
        },
      ],
      context: getRequestContext(request),
      details: {
        name: created.name,
        is_public: created.is_public,
        current_version: created.current_version,
        original_size: created.original_size,
        compressed_size: created.compressed_size,
      },
    });

    return ok(created, { status: 201 });
  });
}
