import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Informe um e-mail valido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export const createUserSchema = z.object({
  nome: z.string().min(2).max(150),
  email: z.email().max(255),
  password: z.string().min(6).max(72),
  cpf: z.string().max(14).optional().nullable(),
  telefone: z.string().max(20).optional().nullable(),
  avatar_url: z.url().optional().nullable().or(z.literal("")),
  ativo: z.boolean().optional(),
  is_admin: z.boolean().optional(),
});

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
