"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export class ApiFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function isAuthFetchError(error: unknown) {
  return error instanceof ApiFetchError && error.status === 401;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const supabase = createBrowserSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new ApiFetchError(
      `Resposta invalida da API (${response.status}). Verifique se a rota ${path} esta disponivel.`,
      response.status,
    );
  }

  const payload = await response.json();
  if (!payload.success) {
    throw new ApiFetchError(payload.message ?? "Erro na requisicao.", response.status, payload.code);
  }

  return payload.data as T;
}
