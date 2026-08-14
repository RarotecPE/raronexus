import "server-only";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { ApiException } from "./api/errors";
import { createAdminSupabaseClient } from "./supabase/server";

export type StandardEmailInput = {
  to: string | string[];
  subject: string;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  logoUrl?: string | null;
  logoAlt?: string;
  primaryColor?: string;
  footerText?: string;
  fromName?: string;
  replyTo?: string | null;
  attachments?: Mail.Attachment[];
};

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new ApiException(`Variavel de ambiente ausente: ${name}`, "SMTP_CONFIG_MISSING", 500);
  }
  return value;
}

function getAppBaseUrl(requestUrl: string) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(requestUrl).origin).replace(/\/$/, "");
}

function getEmailLogoUrl() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, "");
  return `${supabaseUrl}/storage/v1/object/public/logos/${encodeURIComponent("RaroNexus.png")}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paragraphize(value: string) {
  return escapeHtml(value)
    .split(/\r?\n{2,}/)
    .map((paragraph) => paragraph.replace(/\r?\n/g, "<br />"))
    .map((paragraph) => `<p style="margin: 0 0 14px; font-size: 15px; line-height: 1.65;">${paragraph}</p>`)
    .join("");
}

function getTransporter() {
  const port = Number(requireEnv("SMTP_PORT"));
  if (!Number.isFinite(port)) {
    throw new ApiException("SMTP_PORT invalido.", "SMTP_CONFIG_INVALID", 500);
  }

  return nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASSWORD"),
    },
  });
}

function renderStandardEmail(input: StandardEmailInput) {
  const logoUrl = input.logoUrl || getEmailLogoUrl();
  const primaryColor = input.primaryColor || "#0ea5e9";
  const footerText = input.footerText || "E-mail enviado pelo RaroNexus.";
  const actionHtml = input.actionLabel && input.actionUrl
    ? `
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(input.actionUrl)}" style="display: inline-block; background: ${escapeHtml(primaryColor)}; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 700;">
          ${escapeHtml(input.actionLabel)}
        </a>
      </p>
      <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
        Se o botao nao funcionar, copie e cole este link no navegador:<br />
        <span style="word-break: break-all;">${escapeHtml(input.actionUrl)}</span>
      </p>
    `
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #172033;">
      <div style="text-align: center; margin-bottom: 24px;">
        <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(input.logoAlt || "RaroNexus")}" width="72" style="display: inline-block; width: 72px; height: auto;" />
      </div>
      <h2 style="margin: 0 0 16px; color: #0f172a;">${escapeHtml(input.title)}</h2>
      ${paragraphize(input.message)}
      ${actionHtml}
      <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; line-height: 1.5; color: #94a3b8;">${escapeHtml(footerText)}</p>
    </div>
  `;
}

async function getEmailLogoAttachment() {
  const storage = createAdminSupabaseClient().storage.from("logos");
  let logoPath = "RaroNexus.png";
  let { data, error } = await storage.download(logoPath);

  if (error || !data) {
    const { data: rootItems } = await storage.list("", { limit: 100 });
    for (const item of rootItems ?? []) {
      const candidatePath = `${item.name}/RaroNexus.png`;
      const result = await storage.download(candidatePath);
      if (result.data && !result.error) {
        logoPath = candidatePath;
        data = result.data;
        error = null;
        break;
      }
    }
  }

  if (error || !data) {
    console.warn("email_logo_download_failed", error?.message);
    return null;
  }

  return {
    filename: logoPath.split("/").pop() ?? "RaroNexus.png",
    content: Buffer.from(await data.arrayBuffer()),
    cid: "raronexus-logo",
    contentType: data.type || "image/png",
  };
}

export async function sendStandardEmail(input: StandardEmailInput) {
  const fromEmail = requireEnv("SMTP_FROM_EMAIL");
  const fromName = input.fromName || process.env.SMTP_FROM_NAME?.trim() || "RaroNexus";
  const info = await getTransporter().sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: input.to,
    subject: input.subject,
    html: renderStandardEmail(input),
    replyTo: input.replyTo || undefined,
    attachments: input.attachments ?? [],
  });

  return { messageId: info.messageId };
}

export async function sendUserInviteEmail(input: {
  email: string;
  token: string;
  requestUrl: string;
}) {
  const inviteUrl = `${getAppBaseUrl(input.requestUrl)}/set-password?token=${encodeURIComponent(input.token)}`;
  const logoAttachment = await getEmailLogoAttachment();
  const logoSrc = logoAttachment ? "cid:raronexus-logo" : getEmailLogoUrl();

  await sendStandardEmail({
    to: input.email,
    subject: "Complete seu cadastro no RaroNexus",
    title: "Voce foi convidado para o RaroNexus",
    message: [
      "Uma conta foi criada para este e-mail no RaroNexus.",
      "Para concluir seu cadastro, informe seus dados e defina sua senha no botao abaixo.",
    ].join("\n\n"),
    actionLabel: "Completar cadastro",
    actionUrl: inviteUrl,
    logoUrl: logoSrc,
    logoAlt: "RaroNexus",
    primaryColor: "#0f766e",
    footerText: "Este convite expira em 48 horas. Se voce nao esperava este convite, ignore este e-mail.",
    attachments: logoAttachment ? [logoAttachment] : [],
  });
}
