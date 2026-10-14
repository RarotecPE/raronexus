import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { MongoBulkWriteError } from 'mongodb';
import { getAuditCollection } from '@/lib/audit/mongo';
import {
  readAuditBatchFromQueue,
  ackAuditMessages,
  pushToDLQ,
  getQueueStats,
} from '@/lib/audit/queue';
import { extractSearchTokens } from '@/lib/audit/tokens';
import { AuditEnvelope } from '@/lib/audit/types';

// Desativar cache para endpoint de cron
export const dynamic = 'force-dynamic';

async function verifyAuth(request: NextRequest, bodyText: string): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const systemSecret = process.env.AUDIT_SYSTEM_SECRET;

  // 1. Autenticação via Bearer token (chamadas manuais ou sistemas autorizados)
  if (systemSecret && authHeader === `Bearer ${systemSecret}`) {
    return true;
  }

  // 2. Autenticação via assinatura QStash
  const signature = request.headers.get('upstash-signature');
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (signature && currentKey && nextKey) {
    try {
      const receiver = new Receiver({
        currentSigningKey: currentKey,
        nextSigningKey: nextKey,
      });

      const isValid = await receiver.verify({
        signature,
        body: bodyText,
        url: request.url,
      });

      if (isValid) return true;
    } catch (err) {
      console.warn('[DrainAudit] Falha na validação da assinatura QStash:', err);
    }
  }

  // 3. Em desenvolvimento local, permitir se não houver cabeçalhos
  if (process.env.NODE_ENV === 'development' && !authHeader && !signature) {
    return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const isAuthorized = await verifyAuth(request, rawBody);

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // 1. Ler lote de até 100 mensagens da stream
    const batch = await readAuditBatchFromQueue(100);

    if (batch.length === 0) {
      const stats = await getQueueStats();
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'Fila vazia',
        stats,
      });
    }

    const collection = await getAuditCollection();
    const serverTimestamp = new Date().toISOString();

    const validItems: Array<{ id: string; envelope: AuditEnvelope }> = [];
    const poisonPills: Array<{ id: string; rawPayload: string; reason: string }> = [];

    // 2. Validação e enriquecimento (ingestedAt + searchTokens)
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
      // Carimbo com relógio confiável do servidor
      env.ingestedAt = serverTimestamp;

      // Garantir tokens de busca
      if (!env.searchTokens || env.searchTokens.length === 0) {
        env.searchTokens = extractSearchTokens(env);
      }

      validItems.push({ id: item.id, envelope: env });
    }

    const processedIds: string[] = [];
    let insertedCount = 0;

    // 3. Inserção em lote no MongoDB Atlas com ordered: false para idempotência
    if (validItems.length > 0) {
      const docsToInsert = validItems.map(item => item.envelope);

      try {
        const insertResult = await collection.insertMany(docsToInsert, { ordered: false });
        insertedCount = insertResult.insertedCount;
        validItems.forEach(item => processedIds.push(item.id));
      } catch (err: unknown) {
        if (err instanceof MongoBulkWriteError) {
          // Erro E11000 (duplicate key): comportamento idempotente esperado
          const rawErrors = err.writeErrors;
          const writeErrors: Array<{ code?: number; index?: number; errmsg?: string }> = Array.isArray(rawErrors)
            ? rawErrors
            : (rawErrors ? [rawErrors as unknown as { code?: number; index?: number; errmsg?: string }] : []);
          const onlyDuplicates = writeErrors.every((e) => e.code === 11000);

          if (onlyDuplicates) {
            // Todos os erros foram de chave duplicada -> considera todos com sucesso
            insertedCount = validItems.length - writeErrors.length;
            validItems.forEach(item => processedIds.push(item.id));
          } else {
            // Houve erros que não são duplicatas -> separar os com falha para DLQ
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
          // Erro inesperado no MongoDB (ex: queda de rede)
          console.error('[DrainAudit] Erro grave ao gravar no MongoDB:', err);
          throw err;
        }
      }
    }

    // 4. Mover poison pills para a DLQ
    for (const pill of poisonPills) {
      try {
        await pushToDLQ(pill.id, pill.rawPayload, pill.reason, 3);
        // Remove da stream principal para não bloquear a esteira
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

    return NextResponse.json({
      success: true,
      processed: validItems.length,
      inserted: insertedCount,
      dlq: poisonPills.length,
      remainingInStream: stats.streamLength,
      stats,
    });
  } catch (error) {
    console.error('[DrainAudit Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno ao processar auditoria' },
      { status: 500 }
    );
  }
}

// Permite acionamento via GET para health check ou verificação de status
export async function GET(request: NextRequest) {
  const isAuthorized = await verifyAuth(request, '');
  if (!isAuthorized) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const stats = await getQueueStats();
  return NextResponse.json({
    status: 'online',
    queue: stats,
    timestamp: new Date().toISOString(),
  });
}
