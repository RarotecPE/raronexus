import type {
  ApplicationAccessSummaryDTO,
  ApplicationResponseDTO,
  ApplicationRoleDTO,
  ApplicationRoleRow,
  ApplicationRow,
  UserResponseDTO,
  UserRow,
} from "./types";

export function toUserDTO(user: UserRow): UserResponseDTO {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email,
    cpf: user.cpf,
    telefone: user.telefone,
    avatar_url: user.avatar_url,
    ativo: user.ativo,
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
