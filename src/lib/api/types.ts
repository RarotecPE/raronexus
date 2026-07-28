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
  ativo: boolean;
  created_at: string;
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
