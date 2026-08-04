import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlobalSessionRow } from "../types";

const TABLE = "global_sessions";

export class GlobalSessionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: Partial<GlobalSessionRow>) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(input)
      .select("*")
      .single<GlobalSessionRow>();

    if (error) throw error;
    return data;
  }

  async findActiveByTokenHash(tokenHash: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle<GlobalSessionRow>();

    if (error) throw error;
    return data;
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle<GlobalSessionRow>();

    if (error) throw error;
    return data;
  }

  async touch(id: string) {
    const { error } = await this.supabase
      .from(TABLE)
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", id);

    if (error) throw error;
  }

  async revoke(id: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("revoked_at", null)
      .select("*")
      .maybeSingle<GlobalSessionRow>();

    if (error) throw error;
    return data;
  }

  async revokeBySessionKey(sessionKey: string) {
    const { error } = await this.supabase
      .from(TABLE)
      .update({ revoked_at: new Date().toISOString() })
      .eq("session_key", sessionKey)
      .is("revoked_at", null);

    if (error) throw error;
  }
}
