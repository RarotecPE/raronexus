import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";
import { createApplicationSchema } from "@/lib/api/validators/application";
import { auditClient, getRequestContext } from "@/lib/audit";

export async function GET(request: Request) {
  return handleApi(async () => {
    rateLimit(request);
    const context = await new AuthService().authenticate(request);
    return ok(await new ApplicationService().list(context));
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const context = await new AuthService().authenticate(request);
    const input = createApplicationSchema.parse(await request.json());
    const created = await new ApplicationService().create(context, input);

    auditClient.log({
      system: "raronexus",
      category: "applications",
      action: "application.created",
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
          id: created.id,
          label: created.nome,
        },
      ],
      context: getRequestContext(request),
      details: {
        nome: created.nome,
        client_id: created.client_id,
        ativo: created.ativo,
        roles_count: created.roles?.length ?? 0,
      },
    });

    return ok(created, { status: 201 });
  });
}
