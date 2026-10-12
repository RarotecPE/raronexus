import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeInviteRegistrationSchema,
  createUserSchema,
  formatInviteExpirationLabel,
  loginSchema,
  profileSchema,
  resendInviteSchema,
} from "@/lib/api/validators/user";

describe("api validators", () => {
  it("accepts valid login credentials", () => {
    assert.deepEqual(loginSchema.parse({ cpf: "123.456.789-10", password: "secret1" }), {
      cpf: "123.456.789-10",
      password: "secret1",
    });
  });

  it("accepts user invite creation with e-mail only", () => {
    assert.deepEqual(createUserSchema.parse({
      email: "maria@empresa.com",
      is_admin: true,
    }), {
      email: "maria@empresa.com",
      is_admin: true,
    });
  });

  it("accepts custom invite expiration hours within valid range", () => {
    assert.deepEqual(createUserSchema.parse({
      email: "maria@empresa.com",
      is_admin: false,
      expires_in_hours: 168,
    }), {
      email: "maria@empresa.com",
      is_admin: false,
      expires_in_hours: 168,
    });

    assert.deepEqual(resendInviteSchema.parse({ expires_in_hours: "24" }), {
      expires_in_hours: 24,
    });
  });

  it("rejects invite expiration hours outside 1..720 range", () => {
    assert.throws(() => {
      createUserSchema.parse({
        email: "maria@empresa.com",
        expires_in_hours: 0,
      });
    });

    assert.throws(() => {
      createUserSchema.parse({
        email: "maria@empresa.com",
        expires_in_hours: 721,
      });
    });
  });

  it("formats invite expiration label for e-mail footer", () => {
    assert.equal(formatInviteExpirationLabel(1), "1 hora");
    assert.equal(formatInviteExpirationLabel(24), "24 horas");
    assert.equal(formatInviteExpirationLabel(48), "48 horas");
    assert.equal(formatInviteExpirationLabel(72), "3 dias (72 horas)");
    assert.equal(formatInviteExpirationLabel(168), "7 dias (168 horas)");
  });

  it("requires e-mail for user invite creation", () => {
    assert.throws(() => {
      createUserSchema.parse({
        is_admin: false,
      });
    });
  });

  it("requires CPF and password when completing an invite", () => {
    assert.equal(
      completeInviteRegistrationSchema.parse({
        token: "abcdefghijklmnopqrstuvwxyz123456",
        nome: "Maria",
        cpf: "123.456.789-10",
        password: "secret1",
      }).cpf,
      "123.456.789-10",
    );
  });

  it("accepts profile updates with optional avatar URL", () => {
    assert.equal(
      profileSchema.parse({
        nome: "Maria Souza",
        telefone: "1133334444",
        avatar_url: "",
      }).nome,
      "Maria Souza",
    );
  });
});
