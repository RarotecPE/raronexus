import "server-only";

import crypto from "node:crypto";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { ApiConstantDetail, ApiConstantRow, ApiConstantSummary } from "../constant-types";
import { ApiException } from "../errors";
import { ConstantRepository } from "../repositories/constant-repository";
import type { AuthenticatedContext } from "../types";
import type { createConstantSchema, updateConstantSchema } from "../validators/constant";
import { GlobalSessionService } from "./global-session-service";
import {
  deleteConstantObjects,
  prepareConstantObject,
  readConstantObject,
  uploadConstantObject,
} from "./constant-storage";

type CreateInput = z.infer<typeof createConstantSchema>;
type UpdateInput = z.infer<typeof updateConstantSchema>;

const RETENTION_MS = 15 * 24 * 60 * 60 * 1000;

function toSummary(row: ApiConstantRow): ApiConstantSummary {
  return {
    id: row.id,
    name: row.name,
    is_public: row.is_public,
    current_version: row.current_version,
    content_hash: row.content_hash,
    original_size: Number(row.original_size),
    compressed_size: Number(row.compressed_size),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class ConstantService {
  private readonly repository = new ConstantRepository(createAdminSupabaseClient());

  private requireAdmin(context: AuthenticatedContext) {
    if (!context.profile?.is_admin) {
      throw new ApiException("Acesso administrativo necessário.", "ADMIN_REQUIRED", 403);
    }
  }

  async authenticatePrivateConsumer(request: Request) {
    const sessions = new GlobalSessionService();
    const cookieToken = sessions.getTokenFromCookie(request);
    const authorization = request.headers.get("authorization");
    const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null;
    const token = cookieToken || bearerToken;
    if (!token) {
      throw new ApiException("Autenticação necessária para esta constante.", "AUTH_REQUIRED", 401);
    }
    await sessions.validateToken(token);
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async cleanupExpiredVersions() {
    const expired = await this.repository.listExpiredVersions(new Date().toISOString());
    if (expired.length === 0) return;
    await deleteConstantObjects(expired.map((version) => version.storage_path));
    await this.repository.deleteVersions(expired.map((version) => version.id));
  }

  async list(context: AuthenticatedContext) {
    this.requireAdmin(context);
    await this.cleanupExpiredVersions();
    return (await this.repository.list()).map(toSummary);
  }

  async getAdminDetail(context: AuthenticatedContext, id: string): Promise<ApiConstantDetail> {
    this.requireAdmin(context);
    const row = await this.repository.findById(id);
    if (!row) throw new ApiException("Constante não encontrada.", "CONSTANT_NOT_FOUND", 404);
    const content = await readConstantObject(row.storage_path, row.content_hash);
    return { ...toSummary(row), content };
  }

  async create(context: AuthenticatedContext, input: CreateInput): Promise<ApiConstantDetail> {
    this.requireAdmin(context);
    await this.cleanupExpiredVersions();
    if (await this.repository.findByName(input.name)) {
      throw new ApiException("Já existe uma constante com este nome.", "CONSTANT_NAME_CONFLICT", 409);
    }

    const id = randomUUID();
    const version = 1;
    const prepared = await prepareConstantObject(id, version, input.content);
    await uploadConstantObject(prepared.storagePath, prepared.compressed);

    const now = new Date().toISOString();
    const userId = context.profile?.id ?? null;
    let row: ApiConstantRow | null = null;
    try {
      row = await this.repository.create({
        id,
        name: input.name,
        is_public: input.is_public,
        current_version: version,
        storage_path: prepared.storagePath,
        content_hash: prepared.hash,
        original_size: prepared.raw.length,
        compressed_size: prepared.compressed.length,
        created_by: userId,
        updated_by: userId,
        created_at: now,
        updated_at: now,
      });
      await this.repository.createVersion({
        constant_id: id,
        version,
        storage_path: prepared.storagePath,
        content_hash: prepared.hash,
        original_size: prepared.raw.length,
        compressed_size: prepared.compressed.length,
        created_by: userId,
        expires_at: null,
      });
    } catch (error) {
      if (row) await this.repository.delete(id).catch(() => undefined);
      await deleteConstantObjects([prepared.storagePath]).catch(() => undefined);
      throw error;
    }

    return { ...toSummary(row), content: input.content };
  }

  async update(context: AuthenticatedContext, id: string, input: UpdateInput): Promise<ApiConstantDetail> {
    this.requireAdmin(context);
    await this.cleanupExpiredVersions();
    const current = await this.repository.findById(id);
    if (!current) throw new ApiException("Constante não encontrada.", "CONSTANT_NOT_FOUND", 404);
    if (current.current_version !== input.expected_version || current.updated_at !== input.expected_updated_at) {
      throw new ApiException("A constante foi alterada por outro usuário. Recarregue antes de salvar.", "CONSTANT_EDIT_CONFLICT", 409);
    }

    const existingName = await this.repository.findByName(input.name);
    if (existingName && existingName.id !== id) {
      throw new ApiException("Já existe uma constante com este nome.", "CONSTANT_NAME_CONFLICT", 409);
    }

    const version = current.current_version + 1;
    const prepared = await prepareConstantObject(id, version, input.content);
    await uploadConstantObject(prepared.storagePath, prepared.compressed);
    const userId = context.profile?.id ?? null;
    let createdVersionId: string | null = null;
    let metadataUpdated = false;

    try {
      const versionRow = await this.repository.createVersion({
        constant_id: id,
        version,
        storage_path: prepared.storagePath,
        content_hash: prepared.hash,
        original_size: prepared.raw.length,
        compressed_size: prepared.compressed.length,
        created_by: userId,
        expires_at: null,
      });
      createdVersionId = versionRow.id;

      const updated = await this.repository.updateOptimistically(
        id,
        input.expected_version,
        input.expected_updated_at,
        {
          name: input.name,
          is_public: input.is_public,
          current_version: version,
          storage_path: prepared.storagePath,
          content_hash: prepared.hash,
          original_size: prepared.raw.length,
          compressed_size: prepared.compressed.length,
          updated_by: userId,
        },
      );
      if (!updated) {
        throw new ApiException("A constante foi alterada por outro usuário. Recarregue antes de salvar.", "CONSTANT_EDIT_CONFLICT", 409);
      }
      metadataUpdated = true;

      const expiresAt = new Date(Date.now() + RETENTION_MS).toISOString();
      await this.repository.expireVersion(id, current.current_version, expiresAt).catch((error) => {
        console.warn("Falha ao definir retenção da versão anterior da constante", error);
      });
      return { ...toSummary(updated), content: input.content };
    } catch (error) {
      if (!metadataUpdated) {
        if (createdVersionId) await this.repository.deleteVersion(createdVersionId).catch(() => undefined);
        await deleteConstantObjects([prepared.storagePath]).catch(() => undefined);
      }
      throw error;
    }
  }

  async remove(context: AuthenticatedContext, id: string) {
    this.requireAdmin(context);
    const constant = await this.repository.findById(id);
    if (!constant) throw new ApiException("Constante não encontrada.", "CONSTANT_NOT_FOUND", 404);
    const versions = await this.repository.listVersions(id);
    await deleteConstantObjects(Array.from(new Set(versions.map((version) => version.storage_path))));
    await this.repository.delete(id);
    return { deleted: true };
  }

  async resolveByName(name: string) {
    const constant = await this.repository.findByName(name);
    if (!constant) throw new ApiException("Constante não encontrada.", "CONSTANT_NOT_FOUND", 404);
    return constant;
  }

  async getVersion(constantId: string, versionNumber: number) {
    const [constant, version] = await Promise.all([
      this.repository.findById(constantId),
      this.repository.findVersion(constantId, versionNumber),
    ]);
    if (!constant || !version) {
      throw new ApiException("Versão da constante não encontrada.", "CONSTANT_VERSION_NOT_FOUND", 404);
    }
    if (version.expires_at && new Date(version.expires_at).getTime() <= Date.now()) {
      throw new ApiException("Esta versão da constante expirou.", "CONSTANT_VERSION_EXPIRED", 410);
    }
    return { constant, version };
  }

  readContent(storagePath: string, hash: string) {
    return readConstantObject(storagePath, hash);
  }
}
