import { MongoBulkWriteError } from 'mongodb';
import { getAuditCollection } from './mongo';
import {
  readAuditBatchFromQueue,
  ackAuditMessages,
  pushToDLQ,
  getQueueStats,
  acquireDrainLock,
  releaseDrainLock,
  getLastHashForSystem,
  setLastHashForSystem,
} from './queue';
import { extractSearchTokens } from './tokens';
import { calculateEventHash } from './hash';
import { AuditEnvelope } from './types';

export interface DrainResult {
  success: boolean;
  processed: number;
  inserted: number;
  dlq: number;
  locked?: boolean;
  message?: string;
  remainingInStream?: number;
  stats?: { streamLength: number; dlqLength: number };
}

/**
 * Executa a drenagem de um lote de mensagens da fila Upstash Redis para o MongoDB Atlas.
 * Garante:
 * 1. Trava atômica distribuída (prevenindo concorrência entre QStash e AutoDrain).
 * 2. Encadeamento contínuo de hashes criptográficos (Hash Chaining) por sistema.
 * 3. Idempotência estrita e tratamento robusto de MongoBulkWriteError.
 * 4. Isolamento de mensagens corrompidas para Dead-Letter Queue (DLQ).
 */
export async function drainAuditBatch({
  batchSize = 100,
}: {
  batchSize?: number;
} = {}): Promise<DrainResult> {
  const hasLock = await acquireDrainLock();

  if (!hasLock) {
    const stats = await getQueueStats().catch(() => ({ streamLength: 0, dlqLength: 0 }));
    return {
      success: true,
      processed: 0,
      inserted: 0,
      dlq: 0,
      locked: true,
      message: 'Drenagem já em andamento por outro worker',
      remainingInStream: stats.streamLength,
      stats,
    };
  }

  try {
    // 1. Ler lote de mensagens da stream
    const batch = await readAuditBatchFromQueue(batchSize);

    if (batch.length === 0) {
      const stats = await getQueueStats();
      return {
        success: true,
        processed: 0,
        inserted: 0,
        dlq: 0,
        message: 'Fila vazia',
        remainingInStream: stats.streamLength,
        stats,
      };
    }

    const collection = await getAuditCollection();
    const serverTimestamp = new Date().toISOString();

    const validItems: Array<{ id: string; envelope: AuditEnvelope }> = [];
    const poisonPills: Array<{ id: string; rawPayload: string; reason: string }> = [];

    // Cache local em memória durante o lote para encadeamento ordenado intra-batch
    const systemLastHashMap = new Map<string, string>();

    // 2. Validação, enriquecimento e encadeamento criptográfico contínuo
    for (const item of batch) {
      if (!item.envelope || !item.envelope._id) {
        poisonPills.push({
          id: item.id,
          rawPayload: item.rawPayload,
          reason: 'Payload nulo ou sem _id',
        });
        continue;
      }

      const env = item.envelope;
      // Carimbo temporal confiável do servidor
      env.ingestedAt = serverTimestamp;

      // Garantir tokens de busca
      if (!env.searchTokens || env.searchTokens.length === 0) {
        env.searchTokens = extractSearchTokens(env);
      }

      // Encadeamento contínuo de hashes (Hash Chaining)
      const systemKey = env.system || 'unknown';
      let prevHash = systemLastHashMap.get(systemKey);

      if (!prevHash) {
        // Tenta recuperar o último hash do Redis
        const redisHash = await getLastHashForSystem(systemKey).catch(() => null);
        if (redisHash) {
          prevHash = redisHash;
        } else {
          // Fallback resiliente: busca o hash do documento mais recente deste sistema no MongoDB
          const latestDoc = await collection.findOne(
            { system: systemKey },
            { sort: { timestamp: -1 }, projection: { hash: 1 } }
          );
          prevHash = latestDoc?.hash || 'ROOT_GENESIS_HASH';
        }
      }

      env.prevHash = prevHash;
      env.hash = calculateEventHash(env);

      // Atualiza encadeamento para os próximos itens do mesmo lote e no Redis
      systemLastHashMap.set(systemKey, env.hash);
      await setLastHashForSystem(systemKey, env.hash).catch(() => {});

      validItems.push({ id: item.id, envelope: env });
    }

    const processedIds: string[] = [];
    let insertedCount = 0;

    // 3. Inserção em lote no MongoDB Atlas com ordered: false para idempotência
    if (validItems.length > 0) {
      const docsToInsert = validItems.map((item) => item.envelope);

      try {
        const insertResult = await collection.insertMany(docsToInsert, { ordered: false });
        insertedCount = insertResult.insertedCount;
        validItems.forEach((item) => processedIds.push(item.id));
      } catch (err: unknown) {
        if (err instanceof MongoBulkWriteError) {
          // Erro E11000 (duplicate key): comportamento idempotente esperado
          const rawErrors = err.writeErrors;
          const writeErrors: Array<{ code?: number; index?: number; errmsg?: string }> = Array.isArray(rawErrors)
            ? rawErrors
            : rawErrors
            ? [rawErrors as unknown as { code?: number; index?: number; errmsg?: string }]
            : [];
          const onlyDuplicates = writeErrors.every((e) => e.code === 11000);

          if (onlyDuplicates) {
            insertedCount = validItems.length - writeErrors.length;
            validItems.forEach((item) => processedIds.push(item.id));
          } else {
            // Houve erros que não são duplicatas -> separar para DLQ
            const failedIndexes = new Set(writeErrors.filter((e) => e.code !== 11000).map((e) => e.index));

            for (let i = 0; i < validItems.length; i++) {
              if (failedIndexes.has(i)) {
                poisonPills.push({
                  id: validItems[i].id,
                  rawPayload: JSON.stringify(validItems[i].envelope),
                  reason: `Mongo write error: ${writeErrors.find((e) => e.index === i)?.errmsg}`,
                });
              } else {
                processedIds.push(validItems[i].id);
              }
            }
          }
        } else {
          console.error('[DrainAudit] Erro grave ao gravar no MongoDB:', err);
          throw err;
        }
      }
    }

    // 4. Mover poison pills para a DLQ
    for (const pill of poisonPills) {
      try {
        await pushToDLQ(pill.id, pill.rawPayload, pill.reason, 3);
        processedIds.push(pill.id);
      } catch (dlqErr) {
        console.error('[DrainAudit] Falha ao enviar para DLQ:', dlqErr);
      }
    }

    // 5. Confirmar e remover mensagens processadas do Upstash Redis
    if (processedIds.length > 0) {
      await ackAuditMessages(processedIds);
    }

    const stats = await getQueueStats();

    return {
      success: true,
      processed: validItems.length,
      inserted: insertedCount,
      dlq: poisonPills.length,
      remainingInStream: stats.streamLength,
      stats,
    };
  } finally {
    // 6. Garante liberação da trava atômica distribuída
    await releaseDrainLock();
  }
}

