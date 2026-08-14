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
  nome: string | null;
  email: string;
  cpf: string | null;
  telefone: string | null;
  avatar_url: string | null;
  ativo: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type UserInviteRow = {
  id: string;
  email: string;
  token_hash: string;
  is_admin: boolean;
  status: "pending" | "consumed" | "canceled";
  invited_by: string | null;
  avatar_url: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  nome: string;
  descricao: string | null;
  client_id: string;
  client_secret: string;
  logo_url: string | null;
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
  global_session_id?: string | null;
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
  logo_url?: string | null;
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
  avatar_url?: string | null;
  role_id: string | null;
  role_chave: string;
  role_nome: string;
};

export type UserApplicationAccessDTO = {
  application_id: string;
  application_nome: string;
  application_client_id: string;
  application_logo_url?: string | null;
  application_ativo: boolean;
  role_id: string | null;
  role_chave: string;
  role_nome: string;
  roles: ApplicationRoleDTO[];
};

export type UserResponseDTO = {
  id: string;
  nome: string | null;
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

export type GlobalSessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  session_key: string;
  origin: string | null;
  user_agent: string | null;
  ip_address: string | null;
  issued_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type UserListItemDTO = UserResponseDTO & {
  record_type: "user" | "invite";
  invite_status?: "pending" | "expired";
  expires_at?: string;
};

export type UserInviteDTO = {
  id: string;
  email: string;
  is_admin: boolean;
  status: "pending" | "expired";
  avatar_url?: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type PublicInviteDTO = {
  id: string;
  email: string;
  is_admin: boolean;
  avatar_url?: string | null;
  expires_at: string;
};

export type AuthenticatedContext = {
  token: string;
  authUserId: string;
  email: string;
  profile: UserRow | null;
  globalSessionId?: string;
};

export type EmailEndpointKey = string;

export type EmailGlobalSettingsRow = {
  id: boolean;
  display_name: string;
  logo_url: string | null;
  primary_color: string;
  footer_text: string;
  created_at: string;
  updated_at: string;
};

export type ApplicationEmailSettingsRow = {
  id: string;
  application_id: string;
  display_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  footer_text: string | null;
  reply_to_email: string | null;
  allowed_recipient_domains: string[];
  created_at: string;
  updated_at: string;
};

export type ApplicationEmailEndpointPermissionRow = {
  id: string;
  application_id: string;
  endpoint: EmailEndpointKey;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type EmailEndpointRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  active: boolean;
  default_subject: string | null;
  default_title: string | null;
  default_message: string | null;
  default_action_label: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailDeliveryLogRow = {
  id: string;
  application_id: string | null;
  endpoint: EmailEndpointKey;
  recipient_count: number;
  recipient_domains: string[];
  subject: string | null;
  status: "success" | "error";
  error_code: string | null;
  error_message: string | null;
  provider_message_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type EmailGlobalSettingsDTO = {
  display_name: string;
  logo_url?: string | null;
  primary_color: string;
  footer_text: string;
};

export type ApplicationEmailSettingsDTO = {
  application_id: string;
  application_nome: string;
  application_client_id: string;
  application_logo_url?: string | null;
  display_name?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  footer_text?: string | null;
  reply_to_email?: string | null;
  allowed_recipient_domains: string[];
  endpoints: Record<string, boolean>;
};

export type EmailEndpointDTO = {
  id?: string;
  key: string;
  name: string;
  description?: string | null;
  active: boolean;
  default_subject?: string | null;
  default_title?: string | null;
  default_message?: string | null;
  default_action_label?: string | null;
};

export type EmailDeliveryLogDTO = {
  id: string;
  application_id?: string | null;
  application_nome?: string | null;
  endpoint: EmailEndpointKey;
  recipient_count: number;
  recipient_domains: string[];
  subject?: string | null;
  status: "success" | "error";
  error_code?: string | null;
  error_message?: string | null;
  provider_message_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export type EmailAdminSettingsDTO = {
  global: EmailGlobalSettingsDTO;
  endpoints: EmailEndpointDTO[];
  applications: ApplicationEmailSettingsDTO[];
  recent_logs: EmailDeliveryLogDTO[];
};
