import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationRepository } from "@/lib/api/repositories/application-repository";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";
import { updateApplicationSchema } from "@/lib/api/validators/application";
import { auditClient, getRequestContext } from "@/lib/audit";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { applicationId } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateApplicationSchema.parse(await request.json());
    const existing = await new ApplicationRepository(createAdminSupabaseClient()).findById(applicationId);
    const updated = await new ApplicationService().update(context, applicationId, input);

    auditClient.log({
      system: "raronexus",
      category: "applications",
      action: "application.updated",
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
          id: updated.id,
          label: updated.nome,
        },
      ],
      context: getRequestContext(request),
      diff: {
        before: {
          nome: existing?.nome ?? null,
          descricao: existing?.descricao ?? null,
          client_id: existing?.client_id ?? null,
          homepage_url: existing?.homepage_url ?? null,
          redirect_uris: existing?.redirect_uris ?? [],
          allowed_origins: existing?.allowed_origins ?? [],
          ativo: existing?.ativo ?? true,
        },
        after: {
          nome: updated.nome,
          descricao: updated.descricao ?? null,
          client_id: updated.client_id,
          homepage_url: updated.homepage_url ?? null,
          redirect_uris: updated.redirect_uris ?? [],
          allowed_origins: updated.allowed_origins ?? [],
          ativo: updated.ativo,
        },
      },
      details: {
        changes: input,
      },
    });

    return ok(updated);
  });
}
