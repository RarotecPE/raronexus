import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { toPublicUserDTO, toUserDTO } from "../dto";
import { ApiException } from "../errors";
import { AuditRepository } from "../repositories/audit-repository";
import { UserRepository } from "../repositories/user-repository";
import { ApplicationService } from "./application-service";
import type { AuthenticatedContext } from "../types";
import type { z } from "zod";
import type {
  completeRegistrationSchema,
  createUserSchema,
  profileSchema,
  updateUserSchema,
} from "../validators/user";

function isUniqueCpfError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "23505";
}

export class UserService {
  private readonly admin = createAdminSupabaseClient();
  private readonly users = new UserRepository(this.admin);
  private readonly audit = new AuditRepository(this.admin);

  private requireAdmin(context: AuthenticatedContext) {
    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso administrativo necessario.", "ADMIN_REQUIRED", 403);
    }
  }

  private getInviteRedirectTo(requestUrl: string) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(requestUrl).origin;
    return `${appUrl.replace(/\/$/, "")}/set-password`;
  }

  private async getCadastroStatus(user: {
    auth_user_id: string;
    ativo: boolean;
    nome?: string | null;
    cpf?: string | null;
  }) {
    const { data, error } = await this.admin.auth.admin.getUserById(user.auth_user_id);
    if (error || !data.user) {
      throw new ApiException(error?.message ?? "Usuario de autenticacao nao encontrado.", "AUTH_USER_NOT_FOUND", 404);
    }

    if (!data.user.email_confirmed_at && !data.user.confirmed_at) {
      return "pendente" as const;
    }

    if (!user.nome || !user.cpf) {
      return "pendente" as const;
    }

    return user.ativo ? "ativo" as const : "inativo" as const;
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
    return Promise.all(users.map(async (user) => toUserDTO(user, await this.getCadastroStatus(user))));
  }

  async find(context: AuthenticatedContext, id: string) {
    this.requireAdmin(context);
    const user = await this.users.findById(id);
    if (!user) throw new ApiException("Usuario nao encontrado.", "USER_NOT_FOUND", 404);
    return toPublicUserDTO(user);
  }

  async create(
    context: AuthenticatedContext,
    input: z.infer<typeof createUserSchema>,
    requestUrl: string,
  ) {
    this.requireAdmin(context);
    const inviteRedirectTo = this.getInviteRedirectTo(requestUrl);

    const { data, error } = await this.admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: inviteRedirectTo,
    });

    if (error || !data.user) {
      throw new ApiException(error?.message ?? "Falha ao convidar usuario.", "AUTH_INVITE_FAILED", 400);
    }

    const user = await this.users.create({
      auth_user_id: data.user.id,
      nome: null,
      email: input.email,
      cpf: null,
      telefone: null,
      avatar_url: null,
      ativo: true,
      is_admin: input.is_admin ?? false,
    });

    await this.audit.log({
      user_id: user.id,
      event: "convite_de_usuario",
    });

    return toUserDTO(user);
  }

  async completeRegistration(context: AuthenticatedContext, input: z.infer<typeof completeRegistrationSchema>) {
    if (!context.profile) {
      throw new ApiException("Perfil complementar nao encontrado.", "PROFILE_NOT_FOUND", 404);
    }

    try {
      const updated = await this.users.update(context.profile.id, {
        nome: input.nome,
        cpf: input.cpf,
      });

      await this.audit.log({
        user_id: updated.id,
        event: "cadastro_concluido",
      });

      return toUserDTO(updated);
    } catch (error) {
      if (isUniqueCpfError(error)) {
        throw new ApiException("CPF ja cadastrado para outro usuario.", "CPF_ALREADY_EXISTS", 409);
      }

      throw error;
    }
  }

  async resendInvite(context: AuthenticatedContext, id: string, requestUrl: string) {
    this.requireAdmin(context);
    const user = await this.users.findById(id);
    if (!user) throw new ApiException("Usuario nao encontrado.", "USER_NOT_FOUND", 404);

    const cadastroStatus = await this.getCadastroStatus(user);
    if (cadastroStatus !== "pendente") {
      throw new ApiException("Cadastro ja confirmado.", "USER_ALREADY_CONFIRMED", 409);
    }

    const { error } = await this.admin.auth.admin.inviteUserByEmail(user.email, {
      redirectTo: this.getInviteRedirectTo(requestUrl),
    });

    if (error) {
      throw new ApiException(error.message, "AUTH_INVITE_RESEND_FAILED", 400);
    }

    await this.audit.log({
      user_id: user.id,
      event: "reenvio_convite_usuario",
    });

    return toUserDTO(user, "pendente");
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
