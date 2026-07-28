import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { toPublicUserDTO, toUserDTO } from "../dto";
import { ApiException } from "../errors";
import { AuditRepository } from "../repositories/audit-repository";
import { UserRepository } from "../repositories/user-repository";
import { ApplicationService } from "./application-service";
import type { AuthenticatedContext } from "../types";
import type { z } from "zod";
import type { createUserSchema, profileSchema, updateUserSchema } from "../validators/user";

export class UserService {
  private readonly admin = createAdminSupabaseClient();
  private readonly users = new UserRepository(this.admin);
  private readonly audit = new AuditRepository(this.admin);

  private requireAdmin(context: AuthenticatedContext) {
    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso administrativo necessario.", "ADMIN_REQUIRED", 403);
    }
  }

  async me(context: AuthenticatedContext) {
    if (!context.profile) {
      throw new ApiException("Perfil complementar nao encontrado.", "PROFILE_NOT_FOUND", 404);
    }
    return toUserDTO(context.profile);
  }

  async updateMe(context: AuthenticatedContext, input: z.infer<typeof profileSchema>) {
    if (!context.profile) {
      throw new ApiException("Perfil complementar nao encontrado.", "PROFILE_NOT_FOUND", 404);
    }

    const updated = await this.users.update(context.profile.id, {
      nome: input.nome,
      telefone: input.telefone || null,
      avatar_url: input.avatar_url || null,
    });

    await this.audit.log({ user_id: updated.id, event: "alteracao_cadastral" });
    return toUserDTO(updated);
  }

  async list(context: AuthenticatedContext, search?: string) {
    this.requireAdmin(context);
    const users = await this.users.list(search);
    return users.map(toUserDTO);
  }

  async find(context: AuthenticatedContext, id: string) {
    this.requireAdmin(context);
    const user = await this.users.findById(id);
    if (!user) throw new ApiException("Usuario nao encontrado.", "USER_NOT_FOUND", 404);
    return toPublicUserDTO(user);
  }

  async create(context: AuthenticatedContext, input: z.infer<typeof createUserSchema>) {
    this.requireAdmin(context);

    const { data, error } = await this.admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { nome: input.nome },
    });

    if (error || !data.user) {
      throw new ApiException(error?.message ?? "Falha ao criar usuario.", "AUTH_CREATE_FAILED", 400);
    }

    const user = await this.users.create({
      auth_user_id: data.user.id,
      nome: input.nome,
      email: input.email,
      cpf: input.cpf || null,
      telefone: input.telefone || null,
      avatar_url: input.avatar_url || null,
      ativo: input.ativo ?? true,
      is_admin: input.is_admin ?? false,
    });

    await this.audit.log({
      user_id: user.id,
      event: "criacao_de_usuario",
    });

    return toUserDTO(user);
  }

  async update(context: AuthenticatedContext, id: string, input: z.infer<typeof updateUserSchema>) {
    this.requireAdmin(context);
    const user = await this.users.update(id, {
      ...input,
      avatar_url: input.avatar_url || null,
      telefone: input.telefone || null,
    });

    await this.audit.log({ user_id: user.id, event: "alteracao_cadastral" });

    if (input.ativo === false) {
      await new ApplicationService().setUserUnauthorizedEverywhere(user.id);
    }

    return toUserDTO(user);
  }

  async deactivate(context: AuthenticatedContext, id: string) {
    return this.update(context, id, { ativo: false });
  }
}
