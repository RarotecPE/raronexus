import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { completeInviteRegistrationSchema, createUserSchema, loginSchema, profileSchema } from "@/lib/api/validators/user";

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
