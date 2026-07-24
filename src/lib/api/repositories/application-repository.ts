import type { SupabaseClient } from "@supabase/supabase-js";

export class ApplicationRepository {
  constructor(private readonly supabase: SupabaseClient) {}

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
      .select("id")
      .eq("user_id", userId)
      .eq("application_id", applicationId)
      .eq("ativo", true)
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }
}
