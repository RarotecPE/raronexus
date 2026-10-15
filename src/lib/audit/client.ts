import { generateUUIDv7 } from './uuid';
import { sanitizeData } from './sanitizer';
import { extractSearchTokens } from './tokens';
import { calculateEventHash } from './hash';
import { pushAuditEventToQueue } from './queue';
import { AuditEnvelope, LogAuditOptions } from './types';

// Cache do último hash por sistema para encadeamento
const lastHashBySystem: Record<string, string> = {};

/**
 * Tenta registrar uma callback no ciclo de vida `after()` do Next.js 15+ (Serverless safe).
 * Se não estiver em contexto de requisição HTTP, executa como Promise independente.
 */
function runInBackground(fn: () => Promise<void>): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nextServer = require('next/server');
    if (typeof nextServer.after === 'function') {
      try {
        nextServer.after(fn);
        return;
      } catch {
        // Fora do request context do Next.js
      }
    }
  } catch {
    // next/server indisponível (ex: scripts avulsos ou workers)
  }

  // Fallback: executa sem travar o chamador, capturando erros
  fn().catch(err => {
    console.error('[AuditClient Fallback Error]:', err);
  });
}

/**
 * Compara dois objetos e extrai a lista de campos que foram modificados.
 */
export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Array<{ field: string; before: unknown; after: unknown }> {
  const changes: Array<{ field: string; before: unknown; after: unknown }> = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  for (const field of keys) {
    const valBefore = before?.[field];
    const valAfter = after?.[field];
    if (JSON.stringify(valBefore) !== JSON.stringify(valAfter)) {
      changes.push({
        field,
        before: valBefore === undefined ? null : valBefore,
        after: valAfter === undefined ? null : valAfter,
      });
    }
  }

  return changes;
}

/**
 * Monta e higieniza o envelope canônico de auditoria.
 */
export function buildAuditEnvelope(options: LogAuditOptions): AuditEnvelope {
  const _id = generateUUIDv7();
  const timestamp = new Date().toISOString();

  // Sanitização LGPD
  const sanitizedDetails = sanitizeData(options.details || {});

  // Sanitização e cálculo de Diff (Antes vs Depois)
  const sanitizedDiff = options.diff
    ? {
        before: sanitizeData(options.diff.before) as Record<string, unknown>,
        after: sanitizeData(options.diff.after) as Record<string, unknown>,
      }
    : undefined;

  let changes = options.changes;
  if (!changes && sanitizedDiff) {
    changes = computeChanges(sanitizedDiff.before, sanitizedDiff.after);
  }
  const sanitizedChanges = changes ? sanitizeData(changes) : undefined;

  const targets = (options.targets || []).map(t => ({
    type: t.type,
    id: String(t.id),
    label: sanitizeData(t.label),
  }));

  const partialEnvelope: Omit<AuditEnvelope, 'hash'> = {
    schemaVersion: 1,
    _id,
    correlationId: options.correlationId,
    timestamp,
    system: options.system,
    category: options.category,
    action: options.action,
    severity: options.severity || 'INFO',
    status: options.status || 'SUCCESS',
    actor: {
      type: options.actor.type,
      userId: options.actor.userId ? String(options.actor.userId) : undefined,
      name: options.actor.name,
      email: options.actor.email,
      role: options.actor.role,
    },
    targets,
    context: {
      ip: options.context?.ip ?? null,
      userAgent: options.context?.userAgent ?? null,
      sessionId: options.context?.sessionId ?? null,
    },
    changes: sanitizedChanges,
    diff: sanitizedDiff,
    details: sanitizedDetails as Record<string, unknown>,
    prevHash: lastHashBySystem[options.system] || undefined,
  };

  // Cálculo da cadeia de integridade (Hash Chaining)
  const hash = calculateEventHash(partialEnvelope);
  lastHashBySystem[options.system] = hash;

  const envelope: AuditEnvelope = {
    ...partialEnvelope,
    hash,
    searchTokens: extractSearchTokens(partialEnvelope),
  };

  return envelope;
}

/**
 * Cliente de auditoria corporativa unificada.
 */
export class AuditClient {
  /**
   * Dispara um evento de auditoria de forma assíncrona e não-bloqueante.
   * Utiliza a primitiva `after()` do Next.js quando em requisição Serverless,
   * garantindo que a resposta ao usuário tenha p95 < 50ms sem congelamento de CPU.
   */
  log(options: LogAuditOptions): void {
    const envelope = buildAuditEnvelope(options);

    runInBackground(async () => {
      try {
        await pushAuditEventToQueue(envelope);
      } catch (error) {
        // Contingência resiliente: o sistema principal NUNCA é interrompido por falha de fila
        console.error('[AuditClient Queue Failure - Contingency Log]:', {
          _id: envelope._id,
          system: envelope.system,
          action: envelope.action,
          error: error instanceof Error ? error.message : String(error),
          timestamp: envelope.timestamp,
        });
      }
    });
  }

  /**
   * Versão com await síncrono para scripts, testes e ações de severidade CRITICAL.
   */
  async logAsync(options: LogAuditOptions): Promise<AuditEnvelope> {
    const envelope = buildAuditEnvelope(options);
    await pushAuditEventToQueue(envelope);
    return envelope;
  }
}

export const auditClient = new AuditClient();

