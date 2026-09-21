import "server-only";

import crypto from "node:crypto";
import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { unstable_cache } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { ApiException } from "../errors";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);
const BUCKET = "constants";
const CACHE_SECONDS = 15 * 24 * 60 * 60;

export async function prepareConstantObject(constantId: string, version: number, content: string) {
  const raw = Buffer.from(content, "utf8");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const compressed = await gzipAsync(raw, { level: 9 });
  return {
    hash,
    raw,
    compressed,
    storagePath: `${constantId}/v${version}-${hash}.json.gz`,
  };
}

export async function uploadConstantObject(storagePath: string, compressed: Buffer) {
  const { error } = await createAdminSupabaseClient()
    .storage
    .from(BUCKET)
    .upload(storagePath, compressed, {
      contentType: "application/gzip",
      cacheControl: String(CACHE_SECONDS),
      upsert: false,
    });
  if (error) {
    throw new ApiException("Não foi possível salvar a constante no storage.", "CONSTANT_UPLOAD_FAILED", 502);
  }
}

export async function deleteConstantObjects(storagePaths: string[]) {
  if (storagePaths.length === 0) return;
  const { error } = await createAdminSupabaseClient().storage.from(BUCKET).remove(storagePaths);
  if (error) {
    throw new ApiException("Não foi possível remover os arquivos da constante.", "CONSTANT_DELETE_FAILED", 502);
  }
}

const readCachedConstantObject = unstable_cache(
  async (storagePath: string, expectedHash: string) => {
    const { data, error } = await createAdminSupabaseClient().storage.from(BUCKET).download(storagePath);
    if (error || !data) {
      throw new ApiException("Conteúdo da constante não encontrado.", "CONSTANT_CONTENT_NOT_FOUND", 404);
    }

    const compressed = Buffer.from(await data.arrayBuffer());
    const raw = await gunzipAsync(compressed);
    const actualHash = crypto.createHash("sha256").update(raw).digest("hex");
    if (actualHash !== expectedHash) {
      throw new ApiException("A integridade da constante não pôde ser confirmada.", "CONSTANT_HASH_MISMATCH", 500);
    }
    return raw.toString("utf8");
  },
  ["api-constant-content"],
  { revalidate: CACHE_SECONDS },
);

export function readConstantObject(storagePath: string, expectedHash: string) {
  return readCachedConstantObject(storagePath, expectedHash);
}
