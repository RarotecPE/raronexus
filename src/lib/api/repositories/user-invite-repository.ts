import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserInviteRow } from "../types";

const TABLE = "user_invites";

export class UserInviteRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listPending(search?: string) {
    let query = this.supabase
      .from(TABLE)
      .select("*")
      .eq("status", "pending")
      .is("consumed_at", null)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.ilike("email", `%${search}%`);
    }

    const { data, error } = await query.returns<UserInviteRow[]>();
    if (error) throw error;
    return data;
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle<UserInviteRow>();

    if (error) throw error;
    return data;
  }

  async findPendingByEmail(email: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .ilike("email", email)
      .eq("status", "pending")
      .is("consumed_at", null)
      .maybeSingle<UserInviteRow>();

    if (error) throw error;
    return data;
  }

  async findPendingByTokenHash(tokenHash: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .eq("token_hash", tokenHash)
      .eq("status", "pending")
      .is("consumed_at", null)
      .maybeSingle<UserInviteRow>();

    if (error) throw error;
    return data;
  }

  async create(input: Partial<UserInviteRow>) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(input)
      .select("*")
      .single<UserInviteRow>();

    if (error) throw error;
    return data;
  }

  async update(id: string, input: Partial<UserInviteRow>) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single<UserInviteRow>();

    if (error) throw error;
    return data;
  }
}
