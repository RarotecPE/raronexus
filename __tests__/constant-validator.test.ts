import assert from "node:assert/strict";
import test from "node:test";
import { createConstantSchema, MAX_CONSTANT_BYTES } from "../src/lib/api/validators/constant";

test("aceita qualquer raiz JSON válida", () => {
  for (const content of ['{"ok":true}', "[1,2]", '"texto"', "42", "false", "null"]) {
    assert.equal(createConstantSchema.safeParse({
      name: "valid-key.v2",
      is_public: true,
      content,
    }).success, true);
  }
});

test("rejeita JSON inválido, vazio e nome inseguro", () => {
  assert.equal(createConstantSchema.safeParse({
    name: "nome válido",
    is_public: false,
    content: "{}",
  }).success, false);
  assert.equal(createConstantSchema.safeParse({
    name: "valid-name",
    is_public: false,
    content: "",
  }).success, false);
  assert.equal(createConstantSchema.safeParse({
    name: "valid-name",
    is_public: false,
    content: "{]",
  }).success, false);
});

test("rejeita JSON bruto acima de 5 MB", () => {
  const content = `"${"a".repeat(MAX_CONSTANT_BYTES)}"`;
  assert.equal(createConstantSchema.safeParse({
    name: "large-json",
    is_public: false,
    content,
  }).success, false);
});
