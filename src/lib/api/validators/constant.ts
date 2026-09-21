import { z } from "zod";

export const MAX_CONSTANT_BYTES = 5 * 1024 * 1024;
export const CONSTANT_NAME_PATTERN = /^[a-z0-9][a-z0-9_.-]{1,79}$/;

const constantName = z
  .string()
  .trim()
  .min(2, "Informe um nome com pelo menos 2 caracteres.")
  .max(80, "O nome pode ter no máximo 80 caracteres.")
  .regex(CONSTANT_NAME_PATTERN, "Use apenas letras minúsculas, números, ponto, hífen e sublinhado.")
  .refine(
    (value) => value !== "_content" && value !== "content",
    "Este nome é reservado pelo sistema.",
  );

const constantContent = z
  .string()
  .refine((value) => value.trim().length > 0, "O JSON não pode ficar vazio.")
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= MAX_CONSTANT_BYTES,
    "O JSON deve ter no máximo 5 MB.",
  )
  .superRefine((value, context) => {
    try {
      JSON.parse(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? `JSON inválido: ${error.message}` : "JSON inválido.",
      });
    }
  });

export const createConstantSchema = z.object({
  name: constantName,
  is_public: z.boolean(),
  content: constantContent,
});

export const updateConstantSchema = createConstantSchema.extend({
  expected_version: z.number().int().positive(),
  expected_updated_at: z.string().datetime({ offset: true }),
});
