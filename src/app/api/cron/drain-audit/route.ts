import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { getQueueStats } from '@/lib/audit/queue';
import { drainAuditBatch } from '@/lib/audit/drain';

// Desativar cache para endpoint de cron
export const dynamic = 'force-dynamic';

async function verifyAuth(request: NextRequest, bodyText: string): Promise<boolean> {
  const authHeader = request.headers.get('authorization');
  const systemSecret = process.env.AUDIT_SYSTEM_SECRET;

  // 1. Autenticação via Bearer token (comparação em tempo constante contra timing attacks)
  if (systemSecret && authHeader) {
    const expected = `Bearer ${systemSecret}`;
    if (
      authHeader.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
    ) {
      return true;
    }
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

    const result = await drainAuditBatch({ batchSize: 100 });
    return NextResponse.json(result);
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
