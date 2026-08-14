import { z } from "zod";

const optionalUrlSchema = z.url().optional().nullable().or(z.literal(""));
const optionalEmailSchema = z.email().optional().nullable().or(z.literal(""));
const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i, "Dominio invalido.");
const plainTextSchema = (max: number) => z
  .string()
  .trim()
  .min(1)
  .max(max)
  .refine((value) => !/<[a-z][\s\S]*>/i.test(value), "HTML nao e aceito neste campo.");

export const emailEndpointSchema = z.string().trim().min(2).max(80).regex(/^[a-z0-9_.-]+$/);
const optionalPlainTextSchema = (max: number) => z
  .string()
  .trim()
  .max(max)
  .refine((value) => !/<[a-z][\s\S]*>/i.test(value), "HTML nao e aceito neste campo.")
  .optional()
  .nullable();

export const emailGlobalSettingsSchema = z.object({
  display_name: z.string().trim().min(2).max(120),
  logo_url: optionalUrlSchema,
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor hexadecimal, como #0ea5e9."),
  footer_text: z.string().trim().min(1).max(1000),
});

export const applicationEmailSettingsInputSchema = z.object({
  application_id: z.uuid(),
  display_name: z.string().trim().max(120).optional().nullable(),
  logo_url: optionalUrlSchema,
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable().or(z.literal("")),
  footer_text: z.string().trim().max(1000).optional().nullable(),
  reply_to_email: optionalEmailSchema,
  allowed_recipient_domains: z.array(domainSchema).max(50),
  endpoints: z.record(emailEndpointSchema, z.boolean()),
});

export const updateEmailAdminSettingsSchema = z.object({
  global: emailGlobalSettingsSchema,
  endpoints: z.array(z.object({
    id: z.uuid().optional(),
    key: emailEndpointSchema,
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(1000).optional().nullable(),
    active: z.boolean(),
    default_subject: optionalPlainTextSchema(160),
    default_title: optionalPlainTextSchema(140),
    default_message: optionalPlainTextSchema(4000),
    default_action_label: optionalPlainTextSchema(60),
  })).min(1),
  applications: z.array(applicationEmailSettingsInputSchema),
});

const emailListSchema = z.union([
  z.email(),
  z.array(z.email()).min(1).max(50),
]).transform((value) => (Array.isArray(value) ? value : [value]));

export const sendEmailSchema = z.object({
  to: emailListSchema,
  subject: plainTextSchema(160).optional(),
  title: plainTextSchema(140).optional(),
  message: plainTextSchema(4000).optional(),
  action_label: z.string().trim().max(60).refine((value) => !/<[a-z][\s\S]*>/i.test(value), "HTML nao e aceito neste campo.").optional(),
  action_url: z.url().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const testEmailSchema = z.object({
  to: z.email(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const adminEmailTestSchema = z.object({
  application_id: z.uuid(),
  to: z.email(),
});
