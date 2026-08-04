import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { randomBytes, createHash } from "crypto";
import { sendUserInviteEmail } from "@/lib/server-mail";
import { sanitizeFileName } from "@/lib/formatters";
import { toPublicInviteDTO, toPublicUserDTO, toUserDTO, toUserInviteDTO, toUserInviteListItemDTO, toUserListItemDTO } from "../dto";
import { ApiException } from "../errors";
import { AuditRepository } from "../repositories/audit-repository";
import { UserInviteRepository } from "../repositories/user-invite-repository";
import { UserRepository } from "../repositories/user-repository";
import { ApplicationService } from "./application-service";
import type { AuthenticatedContext } from "../types";
import type { z } from "zod";
import type {
  completeInviteRegistrationSchema,
  completeRegistrationSchema,
  createUserSchema,
  inviteTokenSchema,
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
  private readonly invites = new UserInviteRepository(this.admin);
  private readonly audit = new AuditRepository(this.admin);

  private requireAdmin(context: AuthenticatedContext) {
    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso administrativo necessario.", "ADMIN_REQUIRED", 403);
    }
  }

  private createInviteToken() {
    return randomBytes(32).toString("base64url");
  }

  private hashInviteToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private getInviteExpiresAt() {
    return new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  }

  private ensureInviteUsable(invite: { expires_at: string; status: string; consumed_at?: string | null }) {
    if (invite.status !== "pending" || invite.consumed_at) {
      throw new ApiException("Convite invalido ou ja utilizado.", "INVITE_NOT_AVAILABLE", 410);
    }

    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      throw new ApiException("Convite expirado. Solicite um novo convite.", "INVITE_EXPIRED", 410);
    }
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
    const [users, invites] = await Promise.all([
      this.users.list(search),
      this.invites.listPending(search),
    ]);
    const userItems = await Promise.all(
      users.map(async (user) => toUserListItemDTO(user, await this.getCadastroStatus(user))),
    );
    const inviteItems = invites.map(toUserInviteListItemDTO);
    return [...inviteItems, ...userItems].sort((a, b) => (
      new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
    ));
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
    const email = input.email.trim().toLowerCase();
    const existingUser = await this.users.findByEmail(email);

    if (existingUser) {
      throw new ApiException("Ja existe um usuario cadastrado com este e-mail.", "EMAIL_ALREADY_EXISTS", 409);
    }

    const token = this.createInviteToken();
    const inviteInput = {
      email,
      token_hash: this.hashInviteToken(token),
      is_admin: input.is_admin ?? false,
      status: "pending" as const,
      invited_by: context.profile?.id ?? null,
      expires_at: this.getInviteExpiresAt(),
      consumed_at: null,
      created_user_id: null,
    };

    const existingInvite = await this.invites.findPendingByEmail(email);
    const invite = existingInvite
      ? await this.invites.update(existingInvite.id, inviteInput)
      : await this.invites.create(inviteInput);

    await sendUserInviteEmail({ email, token, requestUrl });

    await this.audit.log({
      user_id: context.profile?.id ?? null,
      event: "convite_de_usuario",
    });

    return toUserInviteDTO(invite);
  }

  async completeRegistration(context: AuthenticatedContext, input: z.infer<typeof completeRegistrationSchema>) {
    if (!context.profile) {
      throw new ApiException("Perfil complementar nao encontrado.", "PROFILE_NOT_FOUND", 404);
    }

    if (context.profile.nome && context.profile.cpf) {
      throw new ApiException("Cadastro ja concluido.", "REGISTRATION_ALREADY_COMPLETE", 409);
    }

    try {
      const updated = await this.users.update(context.profile.id, {
        nome: input.nome,
        cpf: input.cpf,
        avatar_url: input.avatar_url || null,
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
    const invite = await this.invites.findById(id);
    if (!invite || invite.status !== "pending" || invite.consumed_at) {
      throw new ApiException("Convite nao encontrado.", "INVITE_NOT_FOUND", 404);
    }

    const token = this.createInviteToken();
    const updated = await this.invites.update(invite.id, {
      token_hash: this.hashInviteToken(token),
      expires_at: this.getInviteExpiresAt(),
      status: "pending",
      consumed_at: null,
    });

    await sendUserInviteEmail({ email: updated.email, token, requestUrl });

    await this.audit.log({
      user_id: context.profile?.id ?? null,
      event: "reenvio_convite_usuario",
    });

    return toUserInviteDTO(updated);
  }

  async cancelInvite(context: AuthenticatedContext, id: string) {
    this.requireAdmin(context);
    const invite = await this.invites.findById(id);
    if (!invite || invite.status !== "pending" || invite.consumed_at) {
      throw new ApiException("Convite nao encontrado.", "INVITE_NOT_FOUND", 404);
    }

    const updated = await this.invites.update(invite.id, { status: "canceled" });

    await this.audit.log({
      user_id: context.profile?.id ?? null,
      event: "cancelamento_convite_usuario",
    });

    return toUserInviteDTO(updated);
  }

  async validateInvite(input: z.infer<typeof inviteTokenSchema>) {
    const invite = await this.invites.findPendingByTokenHash(this.hashInviteToken(input.token));
    if (!invite) throw new ApiException("Convite invalido ou expirado.", "INVITE_NOT_FOUND", 404);
    this.ensureInviteUsable(invite);
    return toPublicInviteDTO(invite);
  }

  async uploadInviteAvatar(input: z.infer<typeof inviteTokenSchema>, file: File) {
    const invite = await this.invites.findPendingByTokenHash(this.hashInviteToken(input.token));
    if (!invite) throw new ApiException("Convite invalido ou expirado.", "INVITE_NOT_FOUND", 404);
    this.ensureInviteUsable(invite);

    if (!file.type.startsWith("image/")) {
      throw new ApiException("Selecione um arquivo de imagem.", "INVALID_AVATAR_FILE", 422);
    }

    const extension = file.name.split(".").pop() || "png";
    const path = `invites/${invite.id}/${Date.now()}-${sanitizeFileName(file.name || `avatar.${extension}`)}`;
    const { error } = await this.admin.storage.from("avatars").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/png",
    });

    if (error) throw new ApiException(error.message, "AVATAR_UPLOAD_FAILED", 400);

    const { data } = this.admin.storage.from("avatars").getPublicUrl(path);
    const updated = await this.invites.update(invite.id, { avatar_url: data.publicUrl });
    return toPublicInviteDTO(updated);
  }

  async completeInviteRegistration(input: z.infer<typeof completeInviteRegistrationSchema>) {
    const invite = await this.invites.findPendingByTokenHash(this.hashInviteToken(input.token));
    if (!invite) throw new ApiException("Convite invalido ou expirado.", "INVITE_NOT_FOUND", 404);
    this.ensureInviteUsable(invite);

    const existingUser = await this.users.findByEmail(invite.email);
    if (existingUser) {
      throw new ApiException("Ja existe um usuario cadastrado com este e-mail.", "EMAIL_ALREADY_EXISTS", 409);
    }

    const { data: authData, error: authError } = await this.admin.auth.admin.createUser({
      email: invite.email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        nome: input.nome,
      },
    });

    if (authError || !authData.user) {
      throw new ApiException(authError?.message ?? "Falha ao criar autenticacao.", "AUTH_USER_CREATE_FAILED", 400);
    }

    try {
      const user = await this.users.create({
        auth_user_id: authData.user.id,
        nome: input.nome,
        email: invite.email,
        cpf: input.cpf,
        telefone: null,
        avatar_url: input.avatar_url || invite.avatar_url || null,
        ativo: true,
        is_admin: invite.is_admin,
      });

      await this.invites.update(invite.id, {
        status: "consumed",
        consumed_at: new Date().toISOString(),
        created_user_id: user.id,
      });

      await this.audit.log({
        user_id: user.id,
        event: "cadastro_concluido",
      });

      return toUserDTO(user);
    } catch (error) {
      await this.admin.auth.admin.deleteUser(authData.user.id);

      if (isUniqueCpfError(error)) {
        throw new ApiException("CPF ja cadastrado para outro usuario.", "CPF_ALREADY_EXISTS", 409);
      }

      throw error;
    }
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

  async remove(context: AuthenticatedContext, id: string) {
    this.requireAdmin(context);
    const user = await this.users.findById(id);
    if (!user) throw new ApiException("Usuario nao encontrado.", "USER_NOT_FOUND", 404);

    if (context.profile?.id === user.id) {
      throw new ApiException("Voce nao pode excluir seu proprio usuario.", "SELF_DELETE_NOT_ALLOWED", 409);
    }

    if (user.is_admin && user.ativo) {
      const remainingAdmins = await this.users.countActiveAdminsExcept(user.id);
      if (remainingAdmins === 0) {
        throw new ApiException("Nao e possivel excluir o ultimo administrador ativo.", "LAST_ADMIN_DELETE_NOT_ALLOWED", 409);
      }
    }

    const { error } = await this.admin.auth.admin.deleteUser(user.auth_user_id);
    if (error) {
      throw new ApiException(error.message, "AUTH_USER_DELETE_FAILED", 400);
    }

    await this.users.remove(user.id);

    await this.audit.log({
      user_id: context.profile?.id ?? null,
      event: "exclusao_usuario",
    });

    return { id: user.id, deleted: true };
  }
}
