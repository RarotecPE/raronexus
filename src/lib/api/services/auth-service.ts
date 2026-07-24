import { ApiException, friendlyAuthError } from "../errors";
import { UserRepository } from "../repositories/user-repository";
import type { AuthenticatedContext } from "../types";
import { createAdminSupabaseClient, createAnonSupabaseClient } from "@/lib/supabase/server";

export class AuthService {
  async login(email: string, password: string) {
    const supabase = createAnonSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      throw new ApiException(friendlyAuthError(error?.message), "INVALID_LOGIN", 401);
    }

    const profile = await new UserRepository(createAdminSupabaseClient()).findByAuthUserId(
      data.user.id,
    );

    if (!profile?.ativo) {
      throw new ApiException("Usuario inativo.", "USER_INACTIVE", 403);
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: profile.id,
        nome: profile.nome,
        email: profile.email,
      },
    };
  }

  async authenticate(request: Request): Promise<AuthenticatedContext> {
    const header = request.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      throw new ApiException("Token nao informado.", "AUTH_REQUIRED", 401);
    }

    const supabase = createAnonSupabaseClient(token);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new ApiException("Token invalido ou expirado.", "INVALID_TOKEN", 401);
    }

    const profile = await new UserRepository(createAdminSupabaseClient()).findByAuthUserId(
      data.user.id,
    );

    if (profile && !profile.ativo) {
      throw new ApiException("Usuario inativo.", "USER_INACTIVE", 403);
    }

    return {
      token,
      authUserId: data.user.id,
      email: data.user.email ?? "",
      profile,
    };
  }
}
