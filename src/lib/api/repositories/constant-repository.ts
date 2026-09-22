import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiConstantRow, ApiConstantVersionRow } from "../constant-types";
import { ApiException } from "../errors";

function throwConstantError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "PGRST205"
  ) {
    throw new ApiException(
      "Central de constantes não encontrada no banco. Aplique a migration 20260921120000_api_constants.sql.",
      "CONSTANTS_SCHEMA_NOT_FOUND",
      503,
    );
  }
  throw error;
}

export class ConstantRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list() {
    const { data, error } = await this.supabase
      .from("api_constants")
      .select("*")
      .order("updated_at", { ascending: false })
      .returns<ApiConstantRow[]>();
    if (error) throwConstantError(error);
    return data;
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from("api_constants")
      .select("*")
      .eq("id", id)
      .maybeSingle<ApiConstantRow>();
    if (error) throwConstantError(error);
    return data;
  }

  async findByName(name: string) {
    const { data, error } = await this.supabase
      .from("api_constants")
      .select("*")
      .eq("name", name)
      .maybeSingle<ApiConstantRow>();
    if (error) throwConstantError(error);
    return data;
  }

  async create(input: ApiConstantRow) {
    const { data, error } = await this.supabase
      .from("api_constants")
      .insert(input)
      .select("*")
      .single<ApiConstantRow>();
    if (error) throwConstantError(error);
    return data;
  }

  async updateOptimistically(
    id: string,
    expectedVersion: number,
    expectedUpdatedAt: string,
    input: Partial<ApiConstantRow>,
  ) {
    const { data, error } = await this.supabase
      .from("api_constants")
      .update(input)
      .eq("id", id)
      .eq("current_version", expectedVersion)
      .eq("updated_at", expectedUpdatedAt)
      .select("*")
      .maybeSingle<ApiConstantRow>();
    if (error) throwConstantError(error);
    return data;
  }

  async delete(id: string) {
    const { error } = await this.supabase.from("api_constants").delete().eq("id", id);
    if (error) throwConstantError(error);
  }

  async createVersion(input: Omit<ApiConstantVersionRow, "id" | "created_at">) {
    const { data, error } = await this.supabase
      .from("api_constant_versions")
      .insert(input)
      .select("*")
      .single<ApiConstantVersionRow>();
    if (error) throwConstantError(error);
    return data;
  }

  async findVersion(constantId: string, version: number) {
    const { data, error } = await this.supabase
      .from("api_constant_versions")
      .select("*")
      .eq("constant_id", constantId)
      .eq("version", version)
      .maybeSingle<ApiConstantVersionRow>();
    if (error) throwConstantError(error);
    return data;
  }

  async listVersions(constantId: string) {
    const { data, error } = await this.supabase
      .from("api_constant_versions")
      .select("*")
      .eq("constant_id", constantId)
      .order("version", { ascending: false })
      .returns<ApiConstantVersionRow[]>();
    if (error) throwConstantError(error);
    return data;
  }

  async expireVersion(constantId: string, version: number, expiresAt: string) {
    const { error } = await this.supabase
      .from("api_constant_versions")
      .update({ expires_at: expiresAt })
      .eq("constant_id", constantId)
      .eq("version", version)
      .is("expires_at", null);
    if (error) throwConstantError(error);
  }

  async listExpiredVersions(now: string) {
    const { data, error } = await this.supabase
      .from("api_constant_versions")
      .select("*")
      .not("expires_at", "is", null)
      .lte("expires_at", now)
      .returns<ApiConstantVersionRow[]>();
    if (error) throwConstantError(error);
    return data;
  }

  async deleteVersions(ids: string[]) {
    if (ids.length === 0) return;
    const { error } = await this.supabase.from("api_constant_versions").delete().in("id", ids);
    if (error) throwConstantError(error);
  }

  async deleteVersion(id: string) {
    const { error } = await this.supabase.from("api_constant_versions").delete().eq("id", id);
    if (error) throwConstantError(error);
  }
}
