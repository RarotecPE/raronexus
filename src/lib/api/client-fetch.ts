"use client";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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

  const payload = await response.json();
  if (!payload.success) {
    throw new Error(payload.message ?? "Erro na requisicao.");
  }

  return payload.data as T;
}
