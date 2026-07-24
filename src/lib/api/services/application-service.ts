import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ApiException } from "../errors";
import { ApplicationRepository } from "../repositories/application-repository";
import type { AuthenticatedContext } from "../types";

export class ApplicationService {
  async checkAccess(context: AuthenticatedContext, applicationId: string) {
    if (!context.profile) {
      throw new ApiException("Perfil complementar nao encontrado.", "PROFILE_NOT_FOUND", 404);
    }

    const repository = new ApplicationRepository(createAdminSupabaseClient());
    return {
      allowed: await repository.userHasAccess(context.profile.id, applicationId),
    };
  }
}
