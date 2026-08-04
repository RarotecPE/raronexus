import type {
  ApplicationAccessSummaryDTO,
  ApplicationResponseDTO,
  ApplicationRoleDTO,
  ApplicationRoleRow,
  ApplicationRow,
  PublicInviteDTO,
  UserInviteDTO,
  UserInviteRow,
  UserListItemDTO,
  UserResponseDTO,
  UserRow,
} from "./types";

export function toUserDTO(
  user: UserRow,
  cadastroStatus: UserResponseDTO["cadastro_status"] = !user.nome || !user.cpf
    ? "pendente"
    : user.ativo ? "ativo" : "inativo",
): UserResponseDTO {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    avatar_url: user.avatar_url,
    ativo: user.ativo,
    cadastro_status: cadastroStatus,
    is_admin: user.is_admin,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export function toPublicUserDTO(user: UserRow): UserResponseDTO {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    ativo: user.ativo,
  };
}

export function toUserListItemDTO(
  user: UserRow,
  cadastroStatus?: UserResponseDTO["cadastro_status"],
): UserListItemDTO {
  return {
    ...toUserDTO(user, cadastroStatus),
    record_type: "user",
  };
}

export function toUserInviteDTO(invite: UserInviteRow): UserInviteDTO {
  return {
    id: invite.id,
    email: invite.email,
    is_admin: invite.is_admin,
    status: new Date(invite.expires_at).getTime() <= Date.now() ? "expired" : "pending",
    avatar_url: invite.avatar_url,
    expires_at: invite.expires_at,
    created_at: invite.created_at,
    updated_at: invite.updated_at,
  };
}

export function toUserInviteListItemDTO(invite: UserInviteRow): UserListItemDTO {
  const dto = toUserInviteDTO(invite);
  return {
    id: dto.id,
    nome: null,
    email: dto.email,
    avatar_url: dto.avatar_url,
    ativo: true,
    cadastro_status: "pendente",
    is_admin: dto.is_admin,
    created_at: dto.created_at,
    updated_at: dto.updated_at,
    record_type: "invite",
    invite_status: dto.status,
    expires_at: dto.expires_at,
  };
}

export function toPublicInviteDTO(invite: UserInviteRow): PublicInviteDTO {
  return {
    id: invite.id,
    email: invite.email,
    is_admin: invite.is_admin,
    avatar_url: invite.avatar_url,
    expires_at: invite.expires_at,
  };
}

export function toApplicationRoleDTO(role: ApplicationRoleRow): ApplicationRoleDTO {
  return {
    id: role.id,
    nome: role.nome,
    chave: role.chave,
    descricao: role.descricao,
    ativo: role.ativo,
  };
}

export function toApplicationDTO(
  application: ApplicationRow,
  roles: ApplicationRoleRow[] = [],
  options: {
    includeSecret?: boolean;
    userRole?: ApplicationRoleRow | null;
    accessSummary?: ApplicationAccessSummaryDTO;
  } = {},
): ApplicationResponseDTO {
  return {
    id: application.id,
    nome: application.nome,
    descricao: application.descricao,
    client_id: application.client_id,
    ...(options.includeSecret ? { client_secret: application.client_secret } : {}),
    logo_url: application.logo_url,
    homepage_url: application.homepage_url,
    redirect_uris: application.redirect_uris,
    allowed_origins: application.allowed_origins,
    ativo: application.ativo,
    roles: roles.map(toApplicationRoleDTO),
    user_role: options.userRole ? toApplicationRoleDTO(options.userRole) : null,
    ...(options.accessSummary ? { access_summary: options.accessSummary } : {}),
    created_at: application.created_at,
    updated_at: application.updated_at,
  };
}
