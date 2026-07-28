import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApplicationRoleRow, ApplicationRow, UserApplicationRow } from "../types";

export class ApplicationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAll() {
    const { data, error } = await this.supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<ApplicationRow[]>();

    if (error) throw error;
    return data;
  }

  async listForUser(userId: string) {
    const { data, error } = await this.supabase
      .from("user_applications")
      .select("*, applications(*), application_roles(*)")
      .eq("user_id", userId)
      .eq("ativo", true)
      .returns<Array<UserApplicationRow & {
        applications: ApplicationRow | null;
        application_roles: ApplicationRoleRow | null;
      }>>();

    if (error) throw error;
    return data.filter((row) => (
      row.applications?.ativo &&
      row.application_roles?.ativo &&
      row.application_roles.chave !== "nao_autorizado"
    ));
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .maybeSingle<ApplicationRow>();

    if (error) throw error;
    return data;
  }

  async findByClientId(clientId: string) {
    const { data, error } = await this.supabase
      .from("applications")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle<ApplicationRow>();

    if (error) throw error;
    return data;
  }

  async create(input: Partial<ApplicationRow>) {
    const { data, error } = await this.supabase
      .from("applications")
      .insert(input)
      .select("*")
      .single<ApplicationRow>();

    if (error) throw error;
    return data;
  }

  async update(id: string, input: Partial<ApplicationRow>) {
    const { data, error } = await this.supabase
      .from("applications")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single<ApplicationRow>();

    if (error) throw error;
    return data;
  }

  async listRoles(applicationId: string) {
    const { data, error } = await this.supabase
      .from("application_roles")
      .select("*")
      .eq("application_id", applicationId)
      .order("chave")
      .returns<ApplicationRoleRow[]>();

    if (error) throw error;
    return data;
  }

  async upsertRole(input: Partial<ApplicationRoleRow>) {
    const { data, error } = await this.supabase
      .from("application_roles")
      .upsert(input, { onConflict: "application_id,chave" })
      .select("*")
      .single<ApplicationRoleRow>();

    if (error) throw error;
    return data;
  }

  async updateRole(id: string, input: Partial<ApplicationRoleRow>) {
    const { data, error } = await this.supabase
      .from("application_roles")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single<ApplicationRoleRow>();

    if (error) throw error;
    return data;
  }

  async listAssignments(applicationId: string) {
    const { data, error } = await this.supabase
      .from("user_applications")
      .select("*, application_roles(*)")
      .eq("application_id", applicationId)
      .returns<Array<UserApplicationRow & { application_roles: ApplicationRoleRow | null }>>();

    if (error) throw error;
    return data;
  }

  async upsertAssignment(userId: string, applicationId: string, roleId: string | null, ativo: boolean) {
    const { data, error } = await this.supabase
      .from("user_applications")
      .upsert({
        user_id: userId,
        application_id: applicationId,
        role_id: roleId,
        ativo,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,application_id" })
      .select("*")
      .single<UserApplicationRow>();

    if (error) throw error;
    return data;
  }

  async userHasAccess(userId: string, applicationId: string) {
    const { data: application, error: applicationError } = await this.supabase
      .from("applications")
      .select("id")
      .eq("id", applicationId)
      .eq("ativo", true)
      .maybeSingle();

    if (applicationError) throw applicationError;
    if (!application) return false;

    const { data, error } = await this.supabase
      .from("user_applications")
      .select("id, application_roles!inner(chave, ativo)")
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .eq("ativo", true)
      .eq("application_roles.ativo", true)
      .neq("application_roles.chave", "nao_autorizado")
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }

  async findUserRole(userId: string, applicationId: string) {
    const { data, error } = await this.supabase
      .from("user_applications")
      .select("id, ativo, application_roles!inner(*)")
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .eq("ativo", true)
      .eq("application_roles.ativo", true)
      .maybeSingle<{ application_roles: ApplicationRoleRow | null }>();

    if (error) throw error;
    return data?.application_roles ?? null;
  }
}
