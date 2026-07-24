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

  it("rejects short passwords for user creation", () => {
    assert.throws(() => {
      createUserSchema.parse({
        nome: "Maria",
        email: "maria@empresa.com",
        password: "123",
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
