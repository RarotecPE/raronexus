import { ApiException, friendlyAuthError } from "../errors";
import { UserRepository } from "../repositories/user-repository";
import type { AuthenticatedContext } from "../types";
import { createAdminSupabaseClient, createAnonSupabaseClient } from "@/lib/supabase/server";

const invalidCpfLoginMessage = "CPF ou senha invalidos.";

export class AuthService {
  async login(cpf: string, password: string) {
    const repository = new UserRepository(createAdminSupabaseClient());
    const user = await repository.findByCpf(cpf);

    if (!user) {
      throw new ApiException(invalidCpfLoginMessage, "INVALID_LOGIN", 401);
    }

    const supabase = createAnonSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error || !data.session || !data.user) {
      const message = error?.message?.toLowerCase().includes("email not confirmed")
        ? friendlyAuthError(error.message)
        : invalidCpfLoginMessage;
      throw new ApiException(message, "INVALID_LOGIN", 401);
    }

    const profile = await repository.findByAuthUserId(data.user.id);

    if (!profile?.ativo) {
      throw new ApiException("Usuario inativo.", "USER_INACTIVE", 403);
    }

    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: {
        id: profile.id,
        nome: profile.nome ?? profile.email,
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
