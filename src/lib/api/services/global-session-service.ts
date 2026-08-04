import crypto from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ApiException } from "../errors";
import { ApplicationRepository } from "../repositories/application-repository";
import { GlobalSessionRepository } from "../repositories/global-session-repository";
import { UserRepository } from "../repositories/user-repository";
import type { AuthenticatedContext } from "../types";

const UNAUTHORIZED_ROLE_KEY = "nao_autorizado";

export const GLOBAL_SESSION_COOKIE_NAME = "raronexus_global_session";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class GlobalSessionService {
  private readonly supabase = createAdminSupabaseClient();
  private readonly sessions = new GlobalSessionRepository(this.supabase);
  private readonly users = new UserRepository(this.supabase);
  private readonly applications = new ApplicationRepository(this.supabase);

  createToken() {
    return crypto.randomBytes(32).toString("base64url");
  }

  createSessionKey() {
    return crypto.randomBytes(24).toString("base64url");
  }

  async createForUserSession(user: { id: string }, request?: Request, sessionKey = this.createSessionKey()) {
    const token = this.createToken();
    const origin = request?.headers.get("origin") ?? null;
    const userAgent = request?.headers.get("user-agent") ?? null;
    const ipAddress = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request?.headers.get("x-real-ip")
      ?? null;

    const session = await this.sessions.create({
      user_id: user.id,
      token_hash: hashToken(token),
      session_key: sessionKey,
      origin,
      user_agent: userAgent,
      ip_address: ipAddress,
      expires_at: null,
      revoked_at: null,
    });

    return { token, session };
  }

  async createForUser(user: { id: string }, request?: Request, sessionKey = this.createSessionKey()) {
    const { token } = await this.createForUserSession(user, request, sessionKey);
    return token;
  }

  async createRelatedToken(sourceSessionId: string | null | undefined, user: { id: string }) {
    const sourceSession = sourceSessionId ? await this.sessions.findById(sourceSessionId) : null;
    return this.createForUser(user, undefined, sourceSession?.session_key ?? this.createSessionKey());
  }

  async validateToken(token: string) {
    const session = await this.sessions.findActiveByTokenHash(hashToken(token));
    if (!session) {
      throw new ApiException("Sessao invalida ou encerrada.", "GLOBAL_SESSION_INVALID", 401);
    }

    if (session.expires_at && new Date(session.expires_at).getTime() <= Date.now()) {
      await this.sessions.revoke(session.id);
      throw new ApiException("Sessao expirada.", "GLOBAL_SESSION_EXPIRED", 401);
    }

    const user = await this.users.findById(session.user_id);
    if (!user?.ativo) {
      throw new ApiException("Usuario inativo.", "USER_INACTIVE", 403);
    }

    await this.sessions.touch(session.id);
    return { session, user };
  }

  async authenticateFromCookie(request: Request): Promise<AuthenticatedContext | null> {
    const token = this.getTokenFromCookie(request);
    if (!token) return null;
    const { session, user } = await this.validateToken(token);

    return {
      token,
      authUserId: user.auth_user_id,
      email: user.email,
      profile: user,
      globalSessionId: session.id,
    };
  }

  getTokenFromCookie(request: Request) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookies = cookieHeader.split(";").map((item) => item.trim());
    const prefix = `${GLOBAL_SESSION_COOKIE_NAME}=`;
    const cookie = cookies.find((item) => item.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
  }

  async revokeToken(token: string) {
    const session = await this.sessions.findActiveByTokenHash(hashToken(token));
    if (!session) return { revoked: false };
    await this.sessions.revokeBySessionKey(session.session_key);
    return { revoked: true };
  }

  async introspect(input: { token: string; client_id: string }) {
    const { user } = await this.validateToken(input.token);
    const application = await this.applications.findByClientId(input.client_id);
    if (!application?.ativo) {
      throw new ApiException("Aplicacao nao encontrada ou inativa.", "APPLICATION_NOT_FOUND", 404);
    }

    const role = await this.applications.findUserRole(user.id, application.id);
    if (!role || !role.ativo || role.chave === UNAUTHORIZED_ROLE_KEY) {
      throw new ApiException("Acesso nao autorizado.", "ACCESS_DENIED", 403);
    }

    return {
      active: true,
      user: {
        id: user.id,
        nome: user.nome ?? user.email,
        email: user.email,
        avatar_url: user.avatar_url,
      },
      role: {
        id: role.id,
        nome: role.nome,
        chave: role.chave,
      },
      application: {
        id: application.id,
        client_id: application.client_id,
        nome: application.nome,
      },
    };
  }
}
