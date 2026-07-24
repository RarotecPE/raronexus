import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPublicUserDTO, toUserDTO } from "@/lib/api/dto";
import type { UserRow } from "@/lib/api/types";

const row: UserRow = {
  id: "11111111-1111-1111-1111-111111111111",
  auth_user_id: "22222222-2222-2222-2222-222222222222",
  nome: "Joao Silva",
  email: "joao@empresa.com",
  cpf: "000.000.000-00",
  telefone: "11999999999",
  avatar_url: null,
  ativo: true,
  is_admin: true,
  created_at: "2026-07-24T00:00:00.000Z",
  updated_at: "2026-07-24T00:00:00.000Z",
};

describe("user DTOs", () => {
  it("maps complete user data for internal authenticated screens", () => {
    assert.deepEqual(
      {
        id: toUserDTO(row).id,
        nome: toUserDTO(row).nome,
        email: toUserDTO(row).email,
        ativo: toUserDTO(row).ativo,
        is_admin: toUserDTO(row).is_admin,
      },
      {
      id: row.id,
      nome: "Joao Silva",
      email: "joao@empresa.com",
      ativo: true,
      is_admin: true,
      },
    );
  });

  it("does not expose complementary private fields in public DTO", () => {
    assert.deepEqual(toPublicUserDTO(row), {
      id: row.id,
      nome: row.nome,
      email: row.email,
      ativo: row.ativo,
    });
  });
});
