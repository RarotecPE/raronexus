import { handleApi } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { ok } from "@/lib/api/response";
import { ApiException } from "@/lib/api/errors";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

type AuthorizedUserRow = {
  users: {
    id: string;
    nome: string | null;
    email: string;
    avatar_url: string | null;
    cpf: string | null;
    telefone: string | null;
    ativo: boolean;
  } | null;
  application_roles: {
    nome: string;
    chave: string;
    ativo: boolean;
  } | null;
};

export async function POST(request: Request) {
  return handleApi(async () => {
    rateLimit(request, 60, 60_000);

    const body = await request.json().catch(() => ({}));
    const clientId = typeof body.client_id === "string" ? body.client_id.trim() : "";
    const clientSecret = typeof body.client_secret === "string" ? body.client_secret.trim() : "";

    if (!clientId || !clientSecret) {
      throw new ApiException("Credenciais da aplicacao nao informadas.", "APPLICATION_CREDENTIALS_REQUIRED", 401);
    }

    const supabase = createAdminSupabaseClient();
    const { data: application, error: applicationError } = await supabase
      .from("applications")
      .select("id, client_secret, ativo")
      .eq("client_id", clientId)
      .maybeSingle<{ id: string; client_secret: string; ativo: boolean }>();

    if (applicationError) throw applicationError;
    if (!application || !application.ativo || application.client_secret !== clientSecret) {
      throw new ApiException("Aplicacao invalida ou credenciais incorretas.", "INVALID_APPLICATION_CREDENTIALS", 401);
    }

    const { data, error } = await supabase
      .from("user_applications")
      .select("users(id, nome, email, avatar_url, cpf, telefone, ativo), application_roles(nome, chave, ativo)")
      .eq("application_id", application.id)
      .eq("ativo", true)
      .returns<AuthorizedUserRow[]>();

    if (error) throw error;

    const users = data
      .filter((row) => (
        row.users?.ativo &&
        row.application_roles?.ativo &&
        row.application_roles.chave !== "nao_autorizado"
      ))
      .map((row) => ({
        id: row.users!.id,
        nome: row.users!.nome ?? row.users!.email,
        email: row.users!.email,
        avatar_url: row.users!.avatar_url,
        cpf: row.users!.cpf ?? null,
        telefone: row.users!.telefone ?? null,
        role_nome: row.application_roles!.nome,
        role_chave: row.application_roles!.chave,
      }))
      .sort((left, right) => left.nome.localeCompare(right.nome));

    return ok(users);
  });
}
