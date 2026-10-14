import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sortUserListItems, toPublicUserDTO, toUserDTO } from "@/lib/api/dto";
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

  it("sorts users with completed registrations first, then pending and expired at the end", () => {
    const userActiveB = {
      id: "u-2",
      nome: "Bruno Costa",
      email: "bruno@empresa.com",
      ativo: true,
      cadastro_status: "ativo" as const,
      record_type: "user" as const,
    };
    const userActiveA = {
      id: "u-1",
      nome: "Ana Santos",
      email: "ana@empresa.com",
      ativo: true,
      cadastro_status: "ativo" as const,
      record_type: "user" as const,
    };
    const userPendingC = {
      id: "u-3",
      nome: "Carlos Lima",
      email: "carlos@empresa.com",
      ativo: true,
      cadastro_status: "pendente" as const,
      record_type: "user" as const,
    };
    const invitePendingA = {
      id: "i-1",
      nome: null,
      email: "alberto.convidado@empresa.com",
      ativo: true,
      cadastro_status: "pendente" as const,
      record_type: "invite" as const,
      invite_status: "pending" as const,
    };
    const invitePendingZ = {
      id: "i-2",
      nome: null,
      email: "ze.convidado@empresa.com",
      ativo: true,
      cadastro_status: "pendente" as const,
      record_type: "invite" as const,
      invite_status: "pending" as const,
    };
    const inviteExpired = {
      id: "i-3",
      nome: null,
      email: "expirado@empresa.com",
      ativo: true,
      cadastro_status: "pendente" as const,
      record_type: "invite" as const,
      invite_status: "expired" as const,
    };

    const sorted = sortUserListItems([
      userActiveB,
      userActiveA,
      userPendingC,
      invitePendingZ,
      invitePendingA,
      inviteExpired,
    ]);

    assert.deepEqual(
      sorted.map((item) => ({
        id: item.id,
        nome: item.nome,
        email: item.email,
        status: item.record_type === "invite" && item.invite_status === "expired" ? "Expirado" : item.cadastro_status,
      })),
      [
        // Rank 0: Completed/Active users sorted by name ascending (Ana Santos, then Bruno Costa)
        { id: "u-1", nome: "Ana Santos", email: "ana@empresa.com", status: "ativo" },
        { id: "u-2", nome: "Bruno Costa", email: "bruno@empresa.com", status: "ativo" },

        // Rank 1: Pending registrations
        // "Cadastro pendente" (starts with C) vs "Carlos Lima" (starts with C) -> "Cadastro..." < "Carlos..."
        // Between the two invites, alberto@ comes before ze@
        { id: "i-1", nome: null, email: "alberto.convidado@empresa.com", status: "pendente" },
        { id: "i-2", nome: null, email: "ze.convidado@empresa.com", status: "pendente" },
        { id: "u-3", nome: "Carlos Lima", email: "carlos@empresa.com", status: "pendente" },

        // Rank 2: Expired invite
        { id: "i-3", nome: null, email: "expirado@empresa.com", status: "Expirado" },
      ],
    );
  });
});
