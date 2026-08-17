import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { sendStandardEmail, sendTemplatedEmail } from "@/lib/server-mail";
import { ApiException } from "../errors";
import { ApplicationRepository } from "../repositories/application-repository";
import { EmailRepository } from "../repositories/email-repository";
import type {
  ApplicationEmailSettingsDTO,
  ApplicationEmailSettingsRow,
  ApplicationRow,
  AuthenticatedContext,
  EmailAdminSettingsDTO,
  EmailDeliveryLogDTO,
  EmailEndpointDTO,
  EmailEndpointKey,
  EmailEndpointRow,
  EmailGlobalSettingsDTO,
} from "../types";
import type { z } from "zod";
import type {
  adminEmailTestSchema,
  applicationEmailSettingsInputSchema,
  emailEndpointInputSchema,
  emailGlobalSettingsSchema,
  sendEmailSchema,
  testEmailSchema,
  updateEmailAdminSettingsSchema,
} from "../validators/email";

type SendInput = z.infer<typeof sendEmailSchema>;
type TestInput = z.infer<typeof testEmailSchema>;
type UpdateSettingsInput = z.infer<typeof updateEmailAdminSettingsSchema>;
type AdminTestInput = z.infer<typeof adminEmailTestSchema>;
type GlobalSettingsInput = z.infer<typeof emailGlobalSettingsSchema>;
type EndpointInput = z.infer<typeof emailEndpointInputSchema>;
type ApplicationSettingsInput = z.infer<typeof applicationEmailSettingsInputSchema>;

export class EmailService {
  private readonly supabase = createAdminSupabaseClient();
  private readonly applications = new ApplicationRepository(this.supabase);
  private readonly emails = new EmailRepository(this.supabase);

  private requireAdmin(context: AuthenticatedContext) {
    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso administrativo necessario.", "ADMIN_REQUIRED", 403);
    }
  }

  private normalizeOptional(value?: string | null) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  }

  private getDomains(recipients: string[]) {
    return Array.from(new Set(recipients.map((email) => email.split("@").pop()!.toLowerCase()))).sort();
  }

  private async log(input: {
    applicationId?: string | null;
    endpoint: EmailEndpointKey;
    recipients: string[];
    subject?: string | null;
    status: "success" | "error";
    errorCode?: string | null;
    errorMessage?: string | null;
    providerMessageId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.emails.createLog({
      application_id: input.applicationId ?? null,
      endpoint: input.endpoint,
      recipient_count: input.recipients.length,
      recipient_domains: this.getDomains(input.recipients),
      subject: input.subject ?? null,
      status: input.status,
      error_code: input.errorCode ?? null,
      error_message: input.errorMessage ?? null,
      provider_message_id: input.providerMessageId ?? null,
      metadata: input.metadata ?? {},
    });
    await this.emails.pruneLogs(50);
  }

  private toGlobalDTO(settings: Awaited<ReturnType<EmailRepository["getGlobalSettings"]>>): EmailGlobalSettingsDTO {
    return {
      display_name: settings.display_name,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      footer_text: settings.footer_text,
    };
  }

  private toLogDTO(log: Awaited<ReturnType<EmailRepository["listRecentLogs"]>>[number]): EmailDeliveryLogDTO {
    return {
      id: log.id,
      application_id: log.application_id,
      application_nome: log.applications?.nome ?? null,
      endpoint: log.endpoint,
      recipient_count: log.recipient_count,
      recipient_domains: log.recipient_domains,
      subject: log.subject,
      status: log.status,
      error_code: log.error_code,
      error_message: log.error_message,
      provider_message_id: log.provider_message_id,
      metadata: log.metadata,
      created_at: log.created_at,
    };
  }

  private toEndpointDTO(endpoint: EmailEndpointRow): EmailEndpointDTO {
    return {
      id: endpoint.id,
      key: endpoint.key,
      name: endpoint.name,
      description: endpoint.description,
      active: endpoint.active,
      default_subject: endpoint.default_subject,
      default_title: endpoint.default_title,
      default_message: endpoint.default_message,
      default_action_label: endpoint.default_action_label,
      html_template: endpoint.html_template || "{{body}}",
    };
  }

  private mergeApplicationEmailSettings(
    application: ApplicationRow,
    setting: ApplicationEmailSettingsRow | null | undefined,
    permissions: Awaited<ReturnType<EmailRepository["listEndpointPermissions"]>>,
    endpoints: EmailEndpointRow[],
  ): ApplicationEmailSettingsDTO {
    const appPermissions = permissions.filter((permission) => permission.application_id === application.id);
    const endpointMap = Object.fromEntries(endpoints.map((endpoint) => [
      endpoint.key,
      appPermissions.find((permission) => permission.endpoint === endpoint.key)?.enabled ?? false,
    ]));

    return {
      application_id: application.id,
      application_nome: application.nome,
      application_client_id: application.client_id,
      application_logo_url: application.logo_url,
      display_name: setting?.display_name ?? null,
      logo_url: setting?.logo_url ?? null,
      primary_color: setting?.primary_color ?? null,
      footer_text: setting?.footer_text ?? null,
      reply_to_email: setting?.reply_to_email ?? null,
      allowed_recipient_domains: setting?.allowed_recipient_domains ?? [],
      endpoints: endpointMap,
    };
  }

  async listAdminSettings(context: AuthenticatedContext): Promise<EmailAdminSettingsDTO> {
    this.requireAdmin(context);
    const [global, applications, settings, endpoints, permissions, logs] = await Promise.all([
      this.emails.getGlobalSettings(),
      this.applications.listAll(),
      this.emails.listApplicationSettings(),
      this.emails.listEndpoints(),
      this.emails.listEndpointPermissions(),
      this.emails.listRecentLogs(),
    ]);

    return {
      global: this.toGlobalDTO(global),
      endpoints: endpoints.map((endpoint) => this.toEndpointDTO(endpoint)),
      applications: applications.map((application) => this.mergeApplicationEmailSettings(
        application,
        settings.find((setting) => setting.application_id === application.id),
        permissions,
        endpoints,
      )),
      recent_logs: logs.map((log) => this.toLogDTO(log)),
    };
  }

  async updateAdminSettings(context: AuthenticatedContext, input: UpdateSettingsInput) {
    this.requireAdmin(context);
    await this.emails.updateGlobalSettings({
      display_name: input.global.display_name,
      logo_url: this.normalizeOptional(input.global.logo_url),
      primary_color: input.global.primary_color,
      footer_text: input.global.footer_text,
    });

    for (const endpoint of input.endpoints) {
      await this.emails.upsertEndpoint({
        key: endpoint.key,
        name: endpoint.name,
        description: this.normalizeOptional(endpoint.description),
        active: endpoint.active,
        default_subject: this.normalizeOptional(endpoint.default_subject),
        default_title: this.normalizeOptional(endpoint.default_title),
        default_message: this.normalizeOptional(endpoint.default_message),
        default_action_label: this.normalizeOptional(endpoint.default_action_label),
        html_template: endpoint.html_template || "{{body}}",
      });
    }

    const endpointKeys = input.endpoints.map((endpoint) => endpoint.key);

    for (const application of input.applications) {
      await this.emails.upsertApplicationSettings({
        application_id: application.application_id,
        display_name: this.normalizeOptional(application.display_name),
        logo_url: this.normalizeOptional(application.logo_url),
        primary_color: this.normalizeOptional(application.primary_color),
        footer_text: this.normalizeOptional(application.footer_text),
        reply_to_email: this.normalizeOptional(application.reply_to_email),
        allowed_recipient_domains: Array.from(new Set(application.allowed_recipient_domains.map((domain) => domain.toLowerCase()))),
      });

      await Promise.all(endpointKeys.map((endpoint) => (
        this.emails.upsertEndpointPermission(application.application_id, endpoint, application.endpoints[endpoint])
      )));
    }

    return this.listAdminSettings(context);
  }

  async updateGlobalSettings(context: AuthenticatedContext, input: GlobalSettingsInput) {
    this.requireAdmin(context);
    const settings = await this.emails.updateGlobalSettings({
      display_name: input.display_name,
      logo_url: this.normalizeOptional(input.logo_url),
      primary_color: input.primary_color,
      footer_text: input.footer_text,
    });

    return this.toGlobalDTO(settings);
  }

  private normalizeEndpointInput(input: EndpointInput) {
    return {
      key: input.key,
      name: input.name,
      description: this.normalizeOptional(input.description),
      active: input.active,
      default_subject: this.normalizeOptional(input.default_subject),
      default_title: this.normalizeOptional(input.default_title),
      default_message: this.normalizeOptional(input.default_message),
      default_action_label: this.normalizeOptional(input.default_action_label),
      html_template: input.html_template || "{{body}}",
    };
  }

  async createEndpoint(context: AuthenticatedContext, input: EndpointInput) {
    this.requireAdmin(context);
    const endpoint = await this.emails.upsertEndpoint(this.normalizeEndpointInput(input));
    return this.toEndpointDTO(endpoint);
  }

  async updateEndpoint(context: AuthenticatedContext, currentKey: EmailEndpointKey, input: EndpointInput) {
    this.requireAdmin(context);

    const existing = await this.emails.findEndpointByKey(currentKey);
    if (!existing) {
      throw new ApiException("Endpoint de e-mail nao encontrado.", "EMAIL_ENDPOINT_NOT_FOUND", 404);
    }

    const endpoint = await this.emails.updateEndpointByKey(currentKey, this.normalizeEndpointInput(input));
    if (currentKey !== input.key) {
      await this.emails.updateEndpointPermissionKey(currentKey, input.key);
    }

    return this.toEndpointDTO(endpoint);
  }

  async updateApplicationSettings(context: AuthenticatedContext, applicationId: string, input: ApplicationSettingsInput) {
    this.requireAdmin(context);
    if (applicationId !== input.application_id) {
      throw new ApiException("Aplicacao invalida.", "APPLICATION_ID_MISMATCH", 400);
    }

    const application = await this.applications.findById(applicationId);
    if (!application) {
      throw new ApiException("Aplicacao nao encontrada.", "APPLICATION_NOT_FOUND", 404);
    }

    await this.emails.upsertApplicationSettings({
      application_id: input.application_id,
      display_name: this.normalizeOptional(input.display_name),
      logo_url: this.normalizeOptional(input.logo_url),
      primary_color: this.normalizeOptional(input.primary_color),
      footer_text: this.normalizeOptional(input.footer_text),
      reply_to_email: this.normalizeOptional(input.reply_to_email),
      allowed_recipient_domains: Array.from(new Set(input.allowed_recipient_domains.map((domain) => domain.toLowerCase()))),
    });

    await Promise.all(Object.entries(input.endpoints).map(([endpoint, enabled]) => (
      this.emails.upsertEndpointPermission(applicationId, endpoint, enabled)
    )));

    const [setting, permissions, endpoints] = await Promise.all([
      this.emails.findApplicationSettings(applicationId),
      this.emails.listEndpointPermissionsForApplication(applicationId),
      this.emails.listEndpoints(),
    ]);

    return this.mergeApplicationEmailSettings(application, setting, permissions, endpoints);
  }

  async listLogs(context: AuthenticatedContext) {
    this.requireAdmin(context);
    const logs = await this.emails.listRecentLogs(50);
    return logs.map((log) => this.toLogDTO(log));
  }

  async deleteEndpoint(context: AuthenticatedContext, key: string) {
    this.requireAdmin(context);

    const endpoint = await this.emails.findEndpointByKey(key);
    if (!endpoint) {
      throw new ApiException("Endpoint de e-mail nao encontrado.", "EMAIL_ENDPOINT_NOT_FOUND", 404);
    }

    await this.emails.deleteEndpoint(key);
    return this.listAdminSettings(context);
  }

  private async authenticateApplication(request: Request, endpoint: EmailEndpointKey) {
    const clientId = request.headers.get("X-RaroNexus-Client-Id")?.trim();
    const clientSecret = request.headers.get("X-RaroNexus-Client-Secret")?.trim();

    if (!clientId || !clientSecret) {
      throw new ApiException("Credenciais da aplicacao nao informadas.", "APPLICATION_CREDENTIALS_REQUIRED", 401);
    }

    const application = await this.applications.findByClientId(clientId);
    if (!application?.ativo || application.client_secret !== clientSecret) {
      throw new ApiException("Aplicacao invalida ou credenciais incorretas.", "INVALID_APPLICATION_CREDENTIALS", 401);
    }

    const [endpointRow, setting, permissions] = await Promise.all([
      this.emails.findEndpointByKey(endpoint),
      this.emails.findApplicationSettings(application.id),
      this.emails.listEndpointPermissionsForApplication(application.id),
    ]);

    if (!endpointRow?.active) {
      throw new ApiException("Endpoint de e-mail nao encontrado ou inativo.", "EMAIL_ENDPOINT_NOT_FOUND", 404);
    }

    const permission = permissions.find((item) => item.endpoint === endpoint);

    if (!permission?.enabled) {
      throw new ApiException("Endpoint de e-mail nao liberado para esta aplicacao.", "EMAIL_ENDPOINT_NOT_ALLOWED", 403);
    }

    return { application, setting, endpoint: endpointRow };
  }

  private ensureAllowedRecipients(setting: ApplicationEmailSettingsRow | null, recipients: string[]) {
    const allowedDomains = new Set((setting?.allowed_recipient_domains ?? []).map((domain) => domain.toLowerCase()));
    if (allowedDomains.size === 0) {
      return;
    }

    const invalid = recipients.filter((email) => {
      const domain = email.split("@").pop()!.toLowerCase();
      return !allowedDomains.has(domain);
    });

    if (invalid.length > 0) {
      throw new ApiException("Destinatario fora da lista de dominios permitidos.", "EMAIL_DOMAIN_NOT_ALLOWED", 403);
    }
  }

  private async getTemplateSettings(application: ApplicationRow, setting: ApplicationEmailSettingsRow | null) {
    const global = await this.emails.getGlobalSettings();
    return {
      fromName: setting?.display_name || global.display_name,
      logoUrl: setting?.logo_url || application.logo_url || global.logo_url,
      primaryColor: setting?.primary_color || global.primary_color,
      footerText: setting?.footer_text || global.footer_text,
      replyTo: setting?.reply_to_email,
    };
  }

  private mapAttachments(input: SendInput["attachments"]) {
    return input?.map((attachment) => ({
      filename: attachment.filename,
      content: Buffer.from(attachment.content_base64, "base64"),
      contentType: attachment.content_type,
    }));
  }

  async sendFromApplication(request: Request, input: SendInput, endpoint: EmailEndpointKey = "send") {
    const { application, setting, endpoint: endpointRow } = await this.authenticateApplication(request, endpoint);
    this.ensureAllowedRecipients(setting, input.to);

    try {
      const template = await this.getTemplateSettings(application, setting);
      const subject = input.subject || endpointRow.default_subject;

      if (!subject || !input.body || !endpointRow.html_template?.includes("{{body}}")) {
        throw new ApiException(
          "Informe subject e body, e configure um corpo HTML com {{body}} para este endpoint.",
          "EMAIL_CONTENT_REQUIRED",
          422,
        );
      }

      const result = await sendTemplatedEmail({
        to: input.to,
        subject,
        htmlTemplate: endpointRow.html_template,
        bodyHtml: input.body,
        logoUrl: template.logoUrl,
        logoAlt: template.fromName,
        fromName: template.fromName,
        replyTo: template.replyTo,
        attachments: this.mapAttachments(input.attachments),
      });

      await this.log({
        applicationId: application.id,
        endpoint,
        recipients: input.to,
        subject,
        status: "success",
        providerMessageId: result.messageId,
        metadata: input.metadata,
      });

      return { sent: true, message_id: result.messageId ?? null };
    } catch (error) {
      await this.log({
        applicationId: application.id,
        endpoint,
        recipients: input.to,
        subject: input.subject || endpointRow.default_subject,
        status: "error",
        errorCode: error instanceof ApiException ? error.code : "EMAIL_SEND_FAILED",
        errorMessage: error instanceof Error ? error.message : "Falha ao enviar e-mail.",
        metadata: input.metadata,
      });
      throw error;
    }
  }

  async testFromApplication(request: Request, input: TestInput) {
    const endpoint: EmailEndpointKey = "test";
    const { application, setting } = await this.authenticateApplication(request, endpoint);
    this.ensureAllowedRecipients(setting, [input.to]);

    return this.sendTest(application, setting, input.to, input.metadata);
  }

  async testFromAdmin(context: AuthenticatedContext, input: AdminTestInput) {
    this.requireAdmin(context);
    const application = await this.applications.findById(input.application_id);
    if (!application) throw new ApiException("Aplicacao nao encontrada.", "APPLICATION_NOT_FOUND", 404);
    const setting = await this.emails.findApplicationSettings(application.id);
    this.ensureAllowedRecipients(setting, [input.to]);

    return this.sendTest(application, setting, input.to, { triggered_by: context.profile?.email ?? context.email });
  }

  private async sendTest(
    application: ApplicationRow,
    setting: ApplicationEmailSettingsRow | null,
    to: string,
    metadata?: Record<string, unknown>,
  ) {
    const endpoint: EmailEndpointKey = "test";

    try {
      const template = await this.getTemplateSettings(application, setting);
      const result = await sendStandardEmail({
        to,
        subject: "Teste de e-mail RaroNexus",
        title: "Teste de envio",
        message: `Este e-mail confirma que a aplicacao ${application.nome} esta autorizada a usar a central de e-mails do RaroNexus.`,
        logoUrl: template.logoUrl,
        logoAlt: template.fromName,
        primaryColor: template.primaryColor,
        footerText: template.footerText,
        fromName: template.fromName,
        replyTo: template.replyTo,
      });

      await this.log({
        applicationId: application.id,
        endpoint,
        recipients: [to],
        subject: "Teste de e-mail RaroNexus",
        status: "success",
        providerMessageId: result.messageId,
        metadata,
      });

      return { sent: true, message_id: result.messageId ?? null };
    } catch (error) {
      await this.log({
        applicationId: application.id,
        endpoint,
        recipients: [to],
        subject: "Teste de e-mail RaroNexus",
        status: "error",
        errorCode: error instanceof ApiException ? error.code : "EMAIL_SEND_FAILED",
        errorMessage: error instanceof Error ? error.message : "Falha ao enviar e-mail.",
        metadata,
      });
      throw error;
    }
  }
}
