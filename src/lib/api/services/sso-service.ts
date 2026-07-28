import crypto from "node:crypto";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ApiException } from "../errors";
import { ApplicationRepository } from "../repositories/application-repository";
import { SsoRepository } from "../repositories/sso-repository";
import { UserRepository } from "../repositories/user-repository";
import type { AuthenticatedContext } from "../types";

const CODE_TTL_MS = 2 * 60 * 1000;
const UNAUTHORIZED_ROLE_KEY = "nao_autorizado";

export const ssoAuthorizeSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.url(),
  state: z.string().min(16),
});

export const ssoTokenSchema = z.object({
  grant_type: z.literal("authorization_code"),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  code: z.string().min(32),
  redirect_uri: z.url(),
});

function hashCode(code: string) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function buildRedirect(redirectUri: string, params: Record<string, string>) {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export class SsoService {
  private readonly supabase = createAdminSupabaseClient();
  private readonly applications = new ApplicationRepository(this.supabase);
  private readonly sso = new SsoRepository(this.supabase);
  private readonly users = new UserRepository(this.supabase);

  async authorize(context: AuthenticatedContext, input: z.infer<typeof ssoAuthorizeSchema>) {
    if (!context.profile?.ativo) {
      throw new ApiException("Usuario sem perfil ativo.", "PROFILE_NOT_FOUND", 403);
    }

    const application = await this.applications.findByClientId(input.client_id);
    if (!application?.ativo) {
      throw new ApiException("Aplicacao nao encontrada ou inativa.", "APPLICATION_NOT_FOUND", 404);
    }

    if (!application.redirect_uris.includes(input.redirect_uri)) {
      throw new ApiException("Redirect URI nao permitida.", "INVALID_REDIRECT_URI", 400);
    }

    const role = await this.applications.findUserRole(context.profile.id, application.id);
    if (!role || role.chave === UNAUTHORIZED_ROLE_KEY) {
      return {
        redirect_to: buildRedirect(input.redirect_uri, {
          error: "access_denied",
          error_description: "Usuario nao autorizado para esta plataforma.",
          state: input.state,
        }),
      };
    }

    const code = crypto.randomBytes(32).toString("base64url");
    await this.sso.createCode({
      code_hash: hashCode(code),
      application_id: application.id,
      user_id: context.profile.id,
      role_id: role.id,
      redirect_uri: input.redirect_uri,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });

    return {
      redirect_to: buildRedirect(input.redirect_uri, {
        code,
        state: input.state,
      }),
    };
  }

  async token(input: z.infer<typeof ssoTokenSchema>) {
    const application = await this.applications.findByClientId(input.client_id);
    if (!application?.ativo || application.client_secret !== input.client_secret) {
      throw new ApiException("Credenciais da aplicacao invalidas.", "INVALID_CLIENT", 401);
    }

    const code = await this.sso.findCode(hashCode(input.code));
    if (
      !code ||
      code.application_id !== application.id ||
      code.redirect_uri !== input.redirect_uri ||
      code.consumed_at ||
      new Date(code.expires_at).getTime() <= Date.now()
    ) {
      throw new ApiException("Codigo invalido ou expirado.", "INVALID_CODE", 400);
    }

    const consumed = await this.sso.consumeCode(code.id);
    if (!consumed) {
      throw new ApiException("Codigo ja utilizado.", "CODE_ALREADY_USED", 400);
    }

    const [user, roles] = await Promise.all([
      this.users.findById(code.user_id),
      this.applications.listRoles(application.id),
    ]);
    const role = roles.find((item) => item.id === code.role_id);

    if (!user?.ativo || !role?.ativo || role.chave === UNAUTHORIZED_ROLE_KEY) {
      throw new ApiException("Acesso nao autorizado.", "ACCESS_DENIED", 403);
    }

    return {
      token_type: "raronexus_sso",
      expires_in: 60 * 60 * 8,
      application: {
        id: application.id,
        client_id: application.client_id,
        nome: application.nome,
      },
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
      },
      role: {
        id: role.id,
        nome: role.nome,
        chave: role.chave,
      },
    };
  }
}
