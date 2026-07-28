import { createAdminSupabaseClient } from "@/lib/supabase/server";
import crypto from "node:crypto";
import { toApplicationDTO } from "../dto";
import { ApiException } from "../errors";
import { ApplicationRepository } from "../repositories/application-repository";
import { UserRepository } from "../repositories/user-repository";
import type { ApplicationAssignmentDTO, ApplicationRoleRow, AuthenticatedContext } from "../types";
import type { z } from "zod";
import type {
  createApplicationSchema,
  updateApplicationAssignmentsSchema,
  updateApplicationSchema,
} from "../validators/application";

const UNAUTHORIZED_ROLE = {
  nome: "Nao autorizado",
  chave: "nao_autorizado",
  descricao: "Opcao padrao para usuarios sem acesso a plataforma.",
  ativo: true,
};

export class ApplicationService {
  private readonly supabase = createAdminSupabaseClient();
  private readonly repository = new ApplicationRepository(this.supabase);
  private readonly users = new UserRepository(this.supabase);

  private requireAdmin(context: AuthenticatedContext) {
    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso administrativo necessario.", "ADMIN_REQUIRED", 403);
    }
  }

  private generateClientSecret() {
    return `rnxs_${crypto.randomBytes(24).toString("base64url")}`;
  }

  private async ensureUnauthorizedRole(applicationId: string) {
    return this.repository.upsertRole({
      application_id: applicationId,
      ...UNAUTHORIZED_ROLE,
    });
  }

  private async saveRoles(applicationId: string, roles: z.infer<typeof createApplicationSchema>["roles"] = []) {
    const unauthorized = await this.ensureUnauthorizedRole(applicationId);
    const savedRoles: ApplicationRoleRow[] = [unauthorized];

    for (const role of roles) {
      if (role.chave === UNAUTHORIZED_ROLE.chave) continue;
      if (role.id) {
        savedRoles.push(await this.repository.updateRole(role.id, {
          nome: role.nome,
          chave: role.chave,
          descricao: role.descricao || null,
          ativo: role.ativo ?? true,
        }));
      } else {
        savedRoles.push(await this.repository.upsertRole({
          application_id: applicationId,
          nome: role.nome,
          chave: role.chave,
          descricao: role.descricao || null,
          ativo: role.ativo ?? true,
        }));
      }
    }

    return savedRoles;
  }

  async list(context: AuthenticatedContext) {
    if (!context.profile) {
      throw new ApiException("Perfil complementar nao encontrado.", "PROFILE_NOT_FOUND", 404);
    }

    if (context.profile.is_admin) {
      const applications = await this.repository.listAll();
      return Promise.all(applications.map(async (application) => (
        toApplicationDTO(application, await this.repository.listRoles(application.id), { includeSecret: true })
      )));
    }

    const assignments = await this.repository.listForUser(context.profile.id);
    return assignments.map((assignment) => (
      toApplicationDTO(assignment.applications!, [], { userRole: assignment.application_roles })
    ));
  }

  async create(context: AuthenticatedContext, input: z.infer<typeof createApplicationSchema>) {
    this.requireAdmin(context);
    const application = await this.repository.create({
      nome: input.nome,
      descricao: input.descricao || null,
      client_id: input.client_id,
      client_secret: this.generateClientSecret(),
      homepage_url: input.homepage_url || null,
      redirect_uris: input.redirect_uris,
      allowed_origins: input.allowed_origins ?? [],
      ativo: input.ativo ?? true,
    });
    const roles = await this.saveRoles(application.id, input.roles);
    return toApplicationDTO(application, roles, { includeSecret: true });
  }

  async update(context: AuthenticatedContext, id: string, input: z.infer<typeof updateApplicationSchema>) {
    this.requireAdmin(context);
    const existing = await this.repository.findById(id);
    if (!existing) throw new ApiException("Aplicacao nao encontrada.", "APPLICATION_NOT_FOUND", 404);

    const application = await this.repository.update(id, {
      ...(input.nome !== undefined ? { nome: input.nome } : {}),
      ...(input.descricao !== undefined ? { descricao: input.descricao || null } : {}),
      ...(input.client_id !== undefined ? { client_id: input.client_id } : {}),
      ...(input.homepage_url !== undefined ? { homepage_url: input.homepage_url || null } : {}),
      ...(input.redirect_uris !== undefined ? { redirect_uris: input.redirect_uris } : {}),
      ...(input.allowed_origins !== undefined ? { allowed_origins: input.allowed_origins ?? [] } : {}),
      ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
    });
    const roles = input.roles
      ? await this.saveRoles(application.id, input.roles)
      : await this.repository.listRoles(application.id);
    return toApplicationDTO(application, roles, { includeSecret: true });
  }

  async listAssignments(context: AuthenticatedContext, applicationId: string) {
    this.requireAdmin(context);
    const application = await this.repository.findById(applicationId);
    if (!application) throw new ApiException("Aplicacao nao encontrada.", "APPLICATION_NOT_FOUND", 404);

    const [users, assignments, roles] = await Promise.all([
      this.users.list(),
      this.repository.listAssignments(applicationId),
      this.repository.listRoles(applicationId),
    ]);
    const unauthorized = roles.find((role) => role.chave === UNAUTHORIZED_ROLE.chave);

    return users.map<ApplicationAssignmentDTO>((user) => {
      const assignment = assignments.find((item) => item.user_id === user.id);
      const role = assignment?.ativo
        ? roles.find((item) => item.id === assignment.role_id) ?? unauthorized
        : unauthorized;

      return {
        user_id: user.id,
        nome: user.nome,
        email: user.email,
        role_id: role?.chave === UNAUTHORIZED_ROLE.chave ? null : role?.id ?? null,
        role_chave: role?.chave ?? UNAUTHORIZED_ROLE.chave,
        role_nome: role?.nome ?? UNAUTHORIZED_ROLE.nome,
      };
    });
  }

  async updateAssignments(
    context: AuthenticatedContext,
    applicationId: string,
    input: z.infer<typeof updateApplicationAssignmentsSchema>,
  ) {
    this.requireAdmin(context);
    const roles = await this.repository.listRoles(applicationId);
    const unauthorized = roles.find((role) => role.chave === UNAUTHORIZED_ROLE.chave)
      ?? await this.ensureUnauthorizedRole(applicationId);

    for (const assignment of input.assignments) {
      const roleId = assignment.role_id ?? unauthorized.id;
      const role = roles.find((item) => item.id === roleId) ?? unauthorized;
      await this.repository.upsertAssignment(
        assignment.user_id,
        applicationId,
        role.id,
        role.chave !== UNAUTHORIZED_ROLE.chave,
      );
    }

    return this.listAssignments(context, applicationId);
  }

  async checkAccess(context: AuthenticatedContext, applicationId: string) {
    if (!context.profile) {
      throw new ApiException("Perfil complementar nao encontrado.", "PROFILE_NOT_FOUND", 404);
    }

    return {
      allowed: await this.repository.userHasAccess(context.profile.id, applicationId),
    };
  }
}
