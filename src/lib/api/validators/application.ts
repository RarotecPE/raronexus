import { z } from "zod";

const optionalUrlSchema = z.url().optional().nullable().or(z.literal(""));

export const roleInputSchema = z.object({
  id: z.uuid().optional(),
  nome: z.string().min(2).max(100),
  chave: z.string().min(2).max(100).regex(/^[a-z0-9_.-]+$/),
  descricao: z.string().max(500).optional().nullable(),
  ativo: z.boolean().optional(),
});

export const createApplicationSchema = z.object({
  nome: z.string().min(2).max(100),
  descricao: z.string().max(1000).optional().nullable(),
  client_id: z.string().min(2).max(100).regex(/^[a-z0-9_.-]+$/),
  homepage_url: optionalUrlSchema,
  redirect_uris: z.array(z.url()).min(1, "Informe ao menos uma URL de callback."),
  allowed_origins: z.array(z.url()).optional(),
  ativo: z.boolean().optional(),
  roles: z.array(roleInputSchema).optional(),
});

export const updateApplicationSchema = createApplicationSchema.partial().extend({
  roles: z.array(roleInputSchema).optional(),
});

export const updateApplicationAssignmentsSchema = z.object({
  assignments: z.array(z.object({
    user_id: z.uuid(),
    role_id: z.uuid().nullable(),
  })),
});
