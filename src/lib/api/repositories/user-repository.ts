import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserRow } from "../types";

const TABLE = "users";

export class UserRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async findByAuthUserId(authUserId: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle<UserRow>();

    if (error) throw error;
    return data;
  }

  async findById(id: string) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle<UserRow>();

    if (error) throw error;
    return data;
  }

  async findByCpf(cpf: string) {
    const digits = cpf.replace(/\D/g, "");
    const { data, error } = await this.supabase
      .from(TABLE)
      .select("*")
      .eq("cpf_digits", digits)
      .maybeSingle<UserRow>();

    if (error) throw error;
    return data;
  }

  async list(search?: string) {
    let query = this.supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (search) {
      const digits = search.replace(/\D/g, "");
      const filters = [`nome.ilike.%${search}%`, `email.ilike.%${search}%`];

      if (digits) {
        filters.push(`cpf_digits.ilike.%${digits}%`);
      }

      query = query.or(filters.join(","));
    }

    const { data, error } = await query.returns<UserRow[]>();
    if (error) throw error;
    return data;
  }

  async create(input: Partial<UserRow>) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(input)
      .select("*")
      .single<UserRow>();

    if (error) throw error;
    return data;
  }

  async update(id: string, input: Partial<UserRow>) {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single<UserRow>();

    if (error) throw error;
    return data;
  }
}
