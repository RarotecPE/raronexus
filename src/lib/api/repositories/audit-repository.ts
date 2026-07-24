import type { SupabaseClient } from "@supabase/supabase-js";

export class AuditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async log(input: {
    user_id?: string | null;
    application_id?: string | null;
    event: string;
    ip_address?: string;
  }) {
    const { error } = await this.supabase.from("audit_logs").insert(input);
    if (error) console.error("audit_log_failed", error);
  }
}
