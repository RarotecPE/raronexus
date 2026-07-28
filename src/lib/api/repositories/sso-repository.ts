import type { SupabaseClient } from "@supabase/supabase-js";
import type { SsoAuthorizationCodeRow } from "../types";

export class SsoRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async createCode(input: Omit<SsoAuthorizationCodeRow, "id" | "created_at" | "consumed_at">) {
    const { data, error } = await this.supabase
      .from("sso_authorization_codes")
      .insert(input)
      .select("*")
      .single<SsoAuthorizationCodeRow>();

    if (error) throw error;
    return data;
  }

  async findCode(codeHash: string) {
    const { data, error } = await this.supabase
      .from("sso_authorization_codes")
      .select("*")
      .eq("code_hash", codeHash)
      .maybeSingle<SsoAuthorizationCodeRow>();

    if (error) throw error;
    return data;
  }

  async consumeCode(id: string) {
    const { data, error } = await this.supabase
      .from("sso_authorization_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", id)
      .is("consumed_at", null)
      .select("*")
      .maybeSingle<SsoAuthorizationCodeRow>();

    if (error) throw error;
    return data;
  }
}
