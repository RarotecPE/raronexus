import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiException } from "../errors";
import type {
  ApplicationEmailEndpointPermissionRow,
  ApplicationEmailSettingsRow,
  EmailDeliveryLogRow,
  EmailEndpointKey,
  EmailEndpointRow,
  EmailGlobalSettingsRow,
} from "../types";

function isMissingEmailTableError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST205"
  );
}

function throwEmailSchemaError(error: unknown): never {
  if (isMissingEmailTableError(error)) {
    throw new ApiException(
      "Central de e-mails nao encontrada no banco. Aplique as migrations 20260814100000_email_center.sql e 20260814102000_dynamic_email_endpoints.sql no Supabase.",
      "EMAIL_SCHEMA_NOT_FOUND",
      503,
    );
  }

  throw error;
}

export class EmailRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getGlobalSettings() {
    const { data, error } = await this.supabase
      .from("email_global_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle<EmailGlobalSettingsRow>();

    if (error) throwEmailSchemaError(error);
    if (data) return data;

    const inserted = await this.supabase
      .from("email_global_settings")
      .insert({ id: true })
      .select("*")
      .single<EmailGlobalSettingsRow>();

    if (inserted.error) throwEmailSchemaError(inserted.error);
    return inserted.data;
  }

  async updateGlobalSettings(input: Partial<EmailGlobalSettingsRow>) {
    const { data, error } = await this.supabase
      .from("email_global_settings")
      .upsert({ id: true, ...input, updated_at: new Date().toISOString() }, { onConflict: "id" })
      .select("*")
      .single<EmailGlobalSettingsRow>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async listApplicationSettings() {
    const { data, error } = await this.supabase
      .from("application_email_settings")
      .select("*")
      .returns<ApplicationEmailSettingsRow[]>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async findApplicationSettings(applicationId: string) {
    const { data, error } = await this.supabase
      .from("application_email_settings")
      .select("*")
      .eq("application_id", applicationId)
      .maybeSingle<ApplicationEmailSettingsRow>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async upsertApplicationSettings(input: Partial<ApplicationEmailSettingsRow> & { application_id: string }) {
    const { data, error } = await this.supabase
      .from("application_email_settings")
      .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: "application_id" })
      .select("*")
      .single<ApplicationEmailSettingsRow>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async listEndpointPermissions() {
    const { data, error } = await this.supabase
      .from("application_email_endpoint_permissions")
      .select("*")
      .returns<ApplicationEmailEndpointPermissionRow[]>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async listEndpoints() {
    const { data, error } = await this.supabase
      .from("email_endpoints")
      .select("*")
      .order("name")
      .returns<EmailEndpointRow[]>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async findEndpointByKey(key: string) {
    const { data, error } = await this.supabase
      .from("email_endpoints")
      .select("*")
      .eq("key", key)
      .maybeSingle<EmailEndpointRow>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async upsertEndpoint(input: Partial<EmailEndpointRow> & { key: string; name: string }) {
    const { data, error } = await this.supabase
      .from("email_endpoints")
      .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: "key" })
      .select("*")
      .single<EmailEndpointRow>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async deleteEndpoint(key: string) {
    const permissions = await this.supabase
      .from("application_email_endpoint_permissions")
      .delete()
      .eq("endpoint", key);

    if (permissions.error) throwEmailSchemaError(permissions.error);

    const { error } = await this.supabase
      .from("email_endpoints")
      .delete()
      .eq("key", key);

    if (error) throwEmailSchemaError(error);
  }

  async listEndpointPermissionsForApplication(applicationId: string) {
    const { data, error } = await this.supabase
      .from("application_email_endpoint_permissions")
      .select("*")
      .eq("application_id", applicationId)
      .returns<ApplicationEmailEndpointPermissionRow[]>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async upsertEndpointPermission(applicationId: string, endpoint: EmailEndpointKey, enabled: boolean) {
    const { data, error } = await this.supabase
      .from("application_email_endpoint_permissions")
      .upsert({
        application_id: applicationId,
        endpoint,
        enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: "application_id,endpoint" })
      .select("*")
      .single<ApplicationEmailEndpointPermissionRow>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async listRecentLogs(limit = 50) {
    const { data, error } = await this.supabase
      .from("email_delivery_logs")
      .select("*, applications(nome)")
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<Array<EmailDeliveryLogRow & { applications: { nome: string } | null }>>();

    if (error) throwEmailSchemaError(error);
    return data;
  }

  async createLog(input: Partial<EmailDeliveryLogRow>) {
    const { data, error } = await this.supabase
      .from("email_delivery_logs")
      .insert(input)
      .select("*")
      .single<EmailDeliveryLogRow>();

    if (error) throw error;
    return data;
  }
}
