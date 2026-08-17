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

const htmlTemplateSchema = z
  .string()
  .trim()
  .min(8)
  .max(30000)
  .refine((value) => value.includes("{{body}}"), "O corpo HTML precisa conter a tag {{body}}.")
  .refine((value) => !/<\s*script[\s>]/i.test(value), "Scripts nao sao permitidos no template.")
  .refine((value) => !/\son[a-z]+\s*=/i.test(value), "Eventos HTML nao sao permitidos no template.")
  .refine((value) => !/javascript\s*:/i.test(value), "Links javascript nao sao permitidos no template.");

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

export const emailEndpointInputSchema = z.object({
  id: z.uuid().optional(),
  key: emailEndpointSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  active: z.boolean(),
  default_subject: optionalPlainTextSchema(160),
  default_title: optionalPlainTextSchema(140),
  default_message: optionalPlainTextSchema(4000),
  default_action_label: optionalPlainTextSchema(60),
  html_template: htmlTemplateSchema,
});

export const updateEmailAdminSettingsSchema = z.object({
  global: emailGlobalSettingsSchema,
  endpoints: z.array(emailEndpointInputSchema).min(1),
  applications: z.array(applicationEmailSettingsInputSchema),
});

const emailListSchema = z.union([
  z.email(),
  z.array(z.email()).min(1).max(50),
]).transform((value) => (Array.isArray(value) ? value : [value]));

const emailAttachmentSchema = z.object({
  filename: z.string().trim().min(1).max(140),
  content_type: z.literal("application/pdf"),
  content_base64: z.string().trim().min(1),
}).refine((attachment) => {
  const size = Buffer.byteLength(attachment.content_base64, "base64");
  return size > 0 && size <= 5 * 1024 * 1024;
}, "O anexo deve ser um PDF de ate 5 MB.");

export const sendEmailSchema = z.object({
  to: emailListSchema,
  subject: plainTextSchema(160).optional(),
  body: z.string().trim().min(1).max(20000),
  attachments: z.array(emailAttachmentSchema).max(3).optional(),
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
