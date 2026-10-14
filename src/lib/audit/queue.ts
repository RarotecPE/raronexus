import { Redis } from '@upstash/redis';
import { AuditEnvelope } from './types';

export const AUDIT_STREAM_KEY = 'audit_events_stream';
export const AUDIT_DLQ_KEY = 'audit_events_dlq';
export const MAX_STREAM_LEN = 100000;

let _redis: Redis | null = null;

export function getAuditRedisClient(): Redis {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN não configurados.');
  }

  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Publica um envelope de auditoria no stream do Upstash Redis (Airbag buffer).
 * Aplica retenção aproximada MAXLEN ~ 100.000 para proteção de cota.
 */
export async function pushAuditEventToQueue(envelope: AuditEnvelope): Promise<string> {
  const redis = getAuditRedisClient();
  const payload = JSON.stringify(envelope);

  // XADD com MAXLEN ~ 100000
  const messageId = await redis.xadd(
    AUDIT_STREAM_KEY,
    '*',
    {
      _id: envelope._id,
      system: envelope.system,
      severity: envelope.severity,
      payload,
    },
    {
      trim: {
        type: 'MAXLEN',
        comparison: '~',
        threshold: MAX_STREAM_LEN,
      },
    }
  );

  return messageId;
}

/**
 * Lê um lote de mensagens pendentes da fila (do início ao fim).
 */
export async function readAuditBatchFromQueue(
  count = 50
): Promise<Array<{ id: string; envelope: AuditEnvelope; rawPayload: string }>> {
  const redis = getAuditRedisClient();

  // Lê os primeiros N itens da stream
  const range = (await redis.xrange(AUDIT_STREAM_KEY, '-', '+', count)) as Record<
    string,
    Record<string, unknown>
  >;

  if (!range || typeof range !== 'object') {
    return [];
  }

  const items: Array<{ id: string; envelope: AuditEnvelope; rawPayload: string }> = [];

  for (const [id, fields] of Object.entries(range)) {
    try {
      const rawPayload = typeof fields.payload === 'string' ? fields.payload : JSON.stringify(fields.payload);
      const envelope = JSON.parse(rawPayload) as AuditEnvelope;
      items.push({ id, envelope, rawPayload });
    } catch (parseErr) {
      console.error(`Erro ao desserializar mensagem de auditoria [${id}]:`, parseErr);
      // Itens não desserializáveis são marcados para DLQ
      items.push({
        id,
        envelope: null as unknown as AuditEnvelope,
        rawPayload: JSON.stringify(fields),
      });
    }
  }

  return items;
}

/**
 * Remove mensagens processadas da stream principal.
 */
export async function ackAuditMessages(ids: string[]): Promise<number> {
  if (!ids || ids.length === 0) return 0;
  const redis = getAuditRedisClient();
  const deleted = await redis.xdel(AUDIT_STREAM_KEY, ids);
  return deleted;
}

/**
 * Encaminha uma mensagem que falhou repetidamente para a Dead-Letter Queue (DLQ).
 */
export async function pushToDLQ(
  messageId: string,
  rawPayload: string,
  errorReason: string,
  attempts = 1
): Promise<string> {
  const redis = getAuditRedisClient();
  const dlqId = await redis.xadd(AUDIT_DLQ_KEY, '*', {
    original_id: messageId,
    error: errorReason,
    attempts,
    failed_at: new Date().toISOString(),
    payload: rawPayload,
  });
  return dlqId;
}

/**
 * Estatísticas da fila de auditoria.
 */
export async function getQueueStats(): Promise<{ streamLength: number; dlqLength: number }> {
  const redis = getAuditRedisClient();
  const [streamLength, dlqLength] = await Promise.all([
    redis.xlen(AUDIT_STREAM_KEY).catch(() => 0),
    redis.xlen(AUDIT_DLQ_KEY).catch(() => 0),
  ]);
  return { streamLength, dlqLength };
}
