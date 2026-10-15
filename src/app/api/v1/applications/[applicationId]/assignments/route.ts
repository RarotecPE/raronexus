import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApplicationRepository } from "@/lib/api/repositories/application-repository";
import { ApplicationService } from "@/lib/api/services/application-service";
import { AuthService } from "@/lib/api/services/auth-service";
import { updateApplicationAssignmentsSchema } from "@/lib/api/validators/application";
import { auditClient, getRequestContext } from "@/lib/audit";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type Params = {
  params: Promise<{ applicationId: string }>;
};

export async function GET(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request);
    const { applicationId } = await params;
    const context = await new AuthService().authenticate(request);
    return ok(await new ApplicationService().listAssignments(context, applicationId));
  });
}

export async function PUT(request: Request, { params }: Params) {
  return handleApi(async () => {
    rateLimit(request, 40, 60_000);
    const { applicationId } = await params;
    const context = await new AuthService().authenticate(request);
    const input = updateApplicationAssignmentsSchema.parse(await request.json());

    // Obter estado anterior com nomes de usuários e papéis antes da alteração
    const previousAssignments = await new ApplicationService().listAssignments(context, applicationId);
    const updatedAssignments = await new ApplicationService().updateAssignments(context, applicationId, input);
    const application = await new ApplicationRepository(createAdminSupabaseClient()).findById(applicationId);

    const diffBefore: Record<string, string> = {};
    const diffAfter: Record<string, string> = {};
    const changes: Array<{ field: string; before: string; after: string }> = [];
    const changedUsers: Array<{
      user_id: string;
      user_name: string;
      user_email: string;
      previous_role: string;
      new_role: string;
    }> = [];

    for (const updatedItem of updatedAssignments) {
      const prevItem = previousAssignments.find((p) => p.user_id === updatedItem.user_id);
      const prevRole = prevItem?.role_nome || "Não autorizado";
      const newRole = updatedItem.role_nome || "Não autorizado";
      const userLabel = updatedItem.nome ? `${updatedItem.nome} (${updatedItem.email})` : updatedItem.email;

      diffBefore[userLabel] = prevRole;
      diffAfter[userLabel] = newRole;

      if (prevRole !== newRole || (prevItem && prevItem.role_id !== updatedItem.role_id)) {
        changes.push({
          field: userLabel,
          before: prevRole,
          after: newRole,
        });
        changedUsers.push({
          user_id: updatedItem.user_id,
          user_name: updatedItem.nome || "Cadastro pendente",
          user_email: updatedItem.email,
          previous_role: prevRole,
          new_role: newRole,
        });
      }
    }

    auditClient.log({
      system: "raronexus",
      category: "applications",
      action: "application.assignments_updated",
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
          id: applicationId,
          label: application?.nome ?? applicationId,
        },
        ...changedUsers.slice(0, 10).map((u) => ({
          type: "user",
          id: u.user_id,
          label: `${u.user_name} (${u.user_email})`,
        })),
      ],
      context: getRequestContext(request),
      diff: {
        before: diffBefore,
        after: diffAfter,
      },
      changes,
      details: {
        application_id: applicationId,
        application_name: application?.nome ?? applicationId,
        total_assignments: updatedAssignments.length,
        changes_count: changedUsers.length,
        changed_users: changedUsers,
        assignments: updatedAssignments.map((item) => ({
          user_id: item.user_id,
          user_name: item.nome,
          user_email: item.email,
          role_id: item.role_id,
          role_key: item.role_chave,
          role_name: item.role_nome,
        })),
      },
    });

    return ok(updatedAssignments);
  });
}
