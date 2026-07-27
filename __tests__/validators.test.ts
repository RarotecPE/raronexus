import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createUserSchema, loginSchema, profileSchema } from "@/lib/api/validators/user";

describe("api validators", () => {
  it("accepts valid login credentials", () => {
    assert.deepEqual(loginSchema.parse({ email: "user@empresa.com", password: "secret1" }), {
      email: "user@empresa.com",
      password: "secret1",
    });
  });

  it("accepts user creation without an initial password", () => {
    assert.deepEqual(createUserSchema.parse({
      nome: "Maria",
      email: "maria@empresa.com",
      cpf: "123.456.789-10",
    }), {
      nome: "Maria",
      email: "maria@empresa.com",
      cpf: "123.456.789-10",
    });
  });

  it("requires CPF for user creation", () => {
    assert.throws(() => {
      createUserSchema.parse({
        nome: "Maria",
        email: "maria@empresa.com",
      });
    });
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
