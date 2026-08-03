"use client";

import { sanitizeFileName } from "@/lib/formatters";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGOS_BUCKET = "logos";

export async function uploadApplicationLogo(file: File, applicationId: string) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem.");
  }

  const supabase = createBrowserSupabaseClient();
  const extension = file.name.split(".").pop() || "png";
  const fallbackName = `logo.${extension}`;
  const path = `${applicationId}/${Date.now()}-${sanitizeFileName(file.name || fallbackName)}`;

  const { error } = await supabase.storage.from(LOGOS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
