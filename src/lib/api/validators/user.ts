import { z } from "zod";

export const loginSchema = z.object({
  cpf: z
    .string()
    .min(11, "Informe um CPF valido.")
    .max(14, "Informe um CPF valido.")
    .regex(/^(\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$/, "Informe um CPF valido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

const cpfSchema = z
  .string()
  .min(14, "Informe um CPF completo.")
  .max(14)
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "Informe um CPF valido.");

export const inviteUserSchema = z.object({
  email: z.email().max(255),
  is_admin: z.boolean().optional(),
});

export const createUserSchema = inviteUserSchema;

export const updateUserSchema = z.object({
  nome: z.string().min(2).max(150).optional(),
  cpf: z.string().max(14).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  avatar_url: z.url().optional().nullable().or(z.literal("")),
  ativo: z.boolean().optional(),
  is_admin: z.boolean().optional(),
});

export const profileSchema = z.object({
  nome: z.string().min(2).max(150),
  telefone: z.string().max(20).optional().nullable(),
  avatar_url: z.url().optional().nullable().or(z.literal("")),
});

export const completeRegistrationSchema = z.object({
  nome: z.string().min(2, "Informe seu nome.").max(150),
  cpf: cpfSchema,
});
