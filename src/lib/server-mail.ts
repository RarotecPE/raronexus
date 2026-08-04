import "server-only";
import nodemailer from "nodemailer";
import { ApiException } from "./api/errors";
import { createAdminSupabaseClient } from "./supabase/server";

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

export async function sendUserInviteEmail(input: {
  email: string;
  token: string;
  requestUrl: string;
}) {
  const port = Number(requireEnv("SMTP_PORT"));
  if (!Number.isFinite(port)) {
    throw new ApiException("SMTP_PORT invalido.", "SMTP_CONFIG_INVALID", 500);
  }
  const fromEmail = requireEnv("SMTP_FROM_EMAIL");
  const fromName = process.env.SMTP_FROM_NAME?.trim() || "RaroNexus";
  const inviteUrl = `${getAppBaseUrl(input.requestUrl)}/set-password?token=${encodeURIComponent(input.token)}`;
  const logoAttachment = await getEmailLogoAttachment();
  const logoUrl = getEmailLogoUrl();
  const logoSrc = logoAttachment ? "cid:raronexus-logo" : logoUrl;

  const transporter = nodemailer.createTransport({
    host: requireEnv("SMTP_HOST"),
    port,
    secure: port === 465,
    auth: {
      user: requireEnv("SMTP_USER"),
      pass: requireEnv("SMTP_PASSWORD"),
    },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: input.email,
    subject: "Complete seu cadastro no RaroNexus",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #172033;">
        <div style="text-align: center; margin-bottom: 24px;">
          <img src="${logoSrc}" alt="RaroNexus" width="72" style="display: inline-block; width: 72px; height: auto;" />
        </div>
        <h2 style="margin: 0 0 16px; color: #0f172a;">Voce foi convidado para o RaroNexus</h2>
        <p style="font-size: 15px; line-height: 1.6;">Uma conta foi criada para este e-mail no RaroNexus.</p>
        <p style="font-size: 15px; line-height: 1.6;">Para concluir seu cadastro, informe seus dados e defina sua senha no botao abaixo.</p>
        <p style="margin: 28px 0;">
          <a href="${inviteUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 700;">
            Completar cadastro
          </a>
        </p>
        <p style="font-size: 13px; line-height: 1.5; color: #64748b;">
          Se o botao nao funcionar, copie e cole este link no navegador:<br />
          <span style="word-break: break-all;">${inviteUrl}</span>
        </p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">Este convite expira em 48 horas. Se voce nao esperava este convite, ignore este e-mail.</p>
      </div>
    `,
    attachments: logoAttachment ? [logoAttachment] : [],
  });
}
