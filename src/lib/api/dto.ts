import type { UserResponseDTO, UserRow } from "./types";

export function toUserDTO(
  user: UserRow,
  cadastroStatus: UserResponseDTO["cadastro_status"] = user.ativo ? "ativo" : "inativo",
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
