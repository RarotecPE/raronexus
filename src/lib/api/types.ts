export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  message: string;
  code: string;
};

export type UserRow = {
  id: string;
  auth_user_id: string;
  nome: string;
  email: string;
  cpf: string | null;
  telefone: string | null;
  avatar_url: string | null;
  ativo: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  nome: string;
  descricao: string | null;
  client_id: string;
  client_secret: string;
  homepage_url: string | null;
  redirect_uris: string[];
  allowed_origins: string[];
  ativo: boolean;
  created_at: string;
  updated_at?: string;
};

export type ApplicationRoleRow = {
  id: string;
  application_id: string;
  nome: string;
  chave: string;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at?: string;
};

export type UserApplicationRow = {
  id: string;
  user_id: string;
  application_id: string;
  role_id: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type SsoAuthorizationCodeRow = {
  id: string;
  code_hash: string;
  application_id: string;
  user_id: string;
  role_id: string;
  redirect_uri: string;
  expires_at: string;
  consumed_at?: string | null;
  created_at?: string;
};

export type ApplicationRoleDTO = {
  id: string;
  nome: string;
  chave: string;
  descricao?: string | null;
  ativo: boolean;
};

export type ApplicationResponseDTO = {
  id: string;
  nome: string;
  descricao?: string | null;
  client_id: string;
  client_secret?: string;
  homepage_url?: string | null;
  redirect_uris?: string[];
  allowed_origins?: string[];
  ativo: boolean;
  roles?: ApplicationRoleDTO[];
  user_role?: ApplicationRoleDTO | null;
  access_summary?: ApplicationAccessSummaryDTO;
  created_at?: string;
  updated_at?: string;
};

export type ApplicationAccessSummaryDTO = {
  authorized_total: number;
  by_profile: Array<{
    role_id: string;
    role_chave: string;
    role_nome: string;
    total: number;
  }>;
};

export type ApplicationAssignmentDTO = {
  user_id: string;
  nome: string;
  email: string;
  role_id: string | null;
  role_chave: string;
  role_nome: string;
};

export type UserApplicationAccessDTO = {
  application_id: string;
  application_nome: string;
  application_client_id: string;
  application_ativo: boolean;
  role_id: string | null;
  role_chave: string;
  role_nome: string;
  roles: ApplicationRoleDTO[];
};

export type UserResponseDTO = {
  id: string;
  nome: string;
  email: string;
  cpf?: string | null;
  telefone?: string | null;
  avatar_url?: string | null;
  ativo: boolean;
  cadastro_status?: "ativo" | "inativo" | "pendente";
  is_admin?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type AuthenticatedContext = {
  token: string;
  authUserId: string;
  email: string;
  profile: UserRow | null;
};
