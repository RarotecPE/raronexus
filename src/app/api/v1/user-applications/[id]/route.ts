import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";
import { UserRepository } from "@/lib/api/repositories/user-repository";
import { updateUserApplicationAssignmentsSchema } from "@/lib/api/validators/application";
import { auditClient, getRequestContext } from "@/lib/audit";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new ApplicationService().listUserApplications(context, id));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { id } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateUserApplicationAssignmentsSchema.parse(await request.json());

    // Obter estado anterior com nomes de aplicações e papéis antes da alteração
    const previous = await new ApplicationService().listUserApplications(context, id);
    const updated = await new ApplicationService().updateUserApplications(context, id, input);
    const targetUser = await new UserRepository(createAdminSupabaseClient()).findById(id);

    const diffBefore: Record<string, string> = {};
    const diffAfter: Record<string, string> = {};
    const changes: Array<{ field: string; before: string; after: string }> = [];
    const changedApps: Array<{
      application_id: string;
      application_nome: string;
      previous_role: string;
      new_role: string;
    }> = [];

    for (const app of updated) {
      const prev = previous.find((p) => p.application_id === app.application_id);
      const prevRole = prev?.role_nome || "Não autorizado";
      const newRole = app.role_nome || "Não autorizado";

      diffBefore[app.application_nome] = prevRole;
      diffAfter[app.application_nome] = newRole;

      if (prevRole !== newRole || (prev && prev.role_id !== app.role_id)) {
        changes.push({
          field: app.application_nome,
          before: prevRole,
          after: newRole,
        });
        changedApps.push({
          application_id: app.application_id,
          application_nome: app.application_nome,
          previous_role: prevRole,
          new_role: newRole,
        });
      }
    }

    auditClient.log({
      system: "raronexus",
      category: "users",
      action: "user.applications_updated",
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
          id,
          label: targetUser?.nome ? `${targetUser.nome} (${targetUser.email})` : (targetUser?.email || id),
        },
        ...changedApps.map((app) => ({
          type: "application",
          id: app.application_id,
          label: app.application_nome,
        })),
      ],
      context: getRequestContext(request),
      diff: {
        before: diffBefore,
        after: diffAfter,
      },
      changes,
      details: {
        user_id: id,
        user_name: targetUser?.nome ?? "Cadastro pendente",
        user_email: targetUser?.email ?? id,
        changed_count: changedApps.length,
        changed_applications: changedApps,
        applications: updated.map((app) => ({
          application_id: app.application_id,
          application_nome: app.application_nome,
          role_id: app.role_id,
          role_key: app.role_chave,
          role_name: app.role_nome,
        })),
      },
    });

    return ok(updated);
  });
}
