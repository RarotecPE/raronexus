"use client";

import { sanitizeFileName } from "@/lib/formatters";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const AVATAR_BUCKET = "avatars";

export async function uploadAvatar(file: File, userId: string) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  const supabase = createBrowserSupabaseClient();
  const extension = file.name.split(".").pop() || "png";
  const path = `${userId}/${Date.now()}-${sanitizeFileName(file.name || `avatar.${extension}`)}`;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadInviteAvatar(file: File, token: string) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  const formData = new FormData();
  formData.append("token", token);
  formData.append("file", file);

  const response = await fetch("/api/v1/user-invites/avatar", {
    method: "POST",
    body: formData,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message ?? "Erro ao enviar avatar.");
  }

  return payload.data.avatar_url as string | null;
}
