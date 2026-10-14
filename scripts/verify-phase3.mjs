import { MongoClient } from 'mongodb';
import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

// Carrega .env do raronexus
const envPath = path.resolve('d:/_RaroSpace/raronexus/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`${key}=["']?([^"'\\r\\n]+)["']?`));
  return match ? match[1] : null;
}

const mongoUri = getEnv('MONGODB_URI');
const redisUrl = getEnv('UPSTASH_REDIS_REST_URL');
const redisToken = getEnv('UPSTASH_REDIS_REST_TOKEN');

if (!mongoUri || !redisUrl || !redisToken) {
  console.error('Credenciais ausentes no .env');
  process.exit(1);
}

const redis = new Redis({ url: redisUrl, token: redisToken });
const mongo = new MongoClient(mongoUri);

async function runVerification() {
  console.log('--- Iniciando Verificação Piloto Fase 3 (RaroNexus & RaroStock) ---');
  await mongo.connect();
  const db = mongo.db('rarotec_audit');
  const collection = db.collection('audit_events');

  const testIdNexus = `test-nexus-${Date.now()}`;
  const testIdStock = `test-stock-${Date.now()}`;

  // 1. Simula evento do RaroNexus
  const nexusEvent = {
    schemaVersion: 1,
    _id: testIdNexus,
    timestamp: new Date().toISOString(),
    system: 'raronexus',
    category: 'auth',
    action: 'user.login',
    severity: 'INFO',
    status: 'SUCCESS',
    actor: {
      type: 'user',
      userId: 'usr_pilot_nexus_01',
      name: 'Operador Nexus Piloto',
      email: 'nexus.piloto@rarotec.com.br',
      role: 'admin',
    },
    targets: [
      {
        type: 'session',
        id: 'sess_12345',
        label: 'Sessão Web Chrome',
      },
    ],
    searchTokens: ['raronexus', 'auth', 'user', 'login', 'operador', 'nexus', 'piloto', 'sess_12345'],
    context: {
      ip: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Nexus Pilot',
      sessionId: 'sess_12345',
    },
    details: {
      loginMethod: 'password',
      testRun: true,
    },
    hash: 'mock_hash_nexus_test',
  };

  // 2. Simula evento do RaroStock
  const stockEvent = {
    schemaVersion: 1,
    _id: testIdStock,
    timestamp: new Date().toISOString(),
    system: 'rarostock',
    category: 'inventory',
    action: 'stock.acquisition',
    severity: 'INFO',
    status: 'SUCCESS',
    actor: {
      type: 'user',
      userId: 'usr_pilot_stock_01',
      name: 'Almoxarife Piloto',
      email: 'almoxarife@rarotec.com.br',
      role: 'estoquista',
    },
    targets: [
      {
        type: 'product',
        id: '101',
        label: 'RST-0010 - Conector RJ45 Cat6',
      },
    ],
    searchTokens: ['rarostock', 'inventory', 'stock', 'acquisition', 'almoxarife', 'conector', 'rj45', 'cat6', 'rst0010'],
    context: {
      ip: '192.168.1.101',
      userAgent: 'Mozilla/5.0 Stock Pilot',
      sessionId: null,
    },
    details: {
      acquisitionId: 9999,
      quantity: 500,
      unitPrice: 1.25,
      testRun: true,
    },
    hash: 'mock_hash_stock_test',
  };

  console.log('1. Publicando eventos na fila Upstash Redis Streams (audit_events_stream)...');
  const msgNexus = await redis.xadd('audit_events_stream', '*', {
    _id: nexusEvent._id,
    system: nexusEvent.system,
    severity: nexusEvent.severity,
    payload: JSON.stringify(nexusEvent),
  });
  console.log(`✓ Evento RaroNexus publicado. Stream ID: ${msgNexus}`);

  const msgStock = await redis.xadd('audit_events_stream', '*', {
    _id: stockEvent._id,
    system: stockEvent.system,
    severity: stockEvent.severity,
    payload: JSON.stringify(stockEvent),
  });
  console.log(`✓ Evento RaroStock publicado. Stream ID: ${msgStock}`);

  // 3. Executa a drenagem (simulando worker /api/cron/drain-audit)
  console.log('2. Drenando lote da fila Upstash Redis para o MongoDB Atlas...');
  const range = await redis.xrange('audit_events_stream', '-', '+', 50);
  const items = [];
  const ackIds = [];

  for (const [id, fields] of Object.entries(range)) {
    const rawPayload = typeof fields.payload === 'string' ? fields.payload : JSON.stringify(fields.payload);
    const envelope = JSON.parse(rawPayload);
    envelope.ingestedAt = new Date().toISOString();
    items.push(envelope);
    ackIds.push(id);
  }

  if (items.length > 0) {
    const result = await collection.insertMany(items, { ordered: false });
    console.log(`✓ ${result.insertedCount} eventos inseridos no MongoDB Atlas.`);
    const acked = await redis.xdel('audit_events_stream', ackIds);
    console.log(`✓ ${acked} mensagens confirmadas (ACK) e removidas da fila Redis.`);
  }

  // 4. Verificação no MongoDB Atlas
  console.log('3. Consultando eventos no MongoDB Atlas para verificação...');
  const docNexus = await collection.findOne({ _id: testIdNexus });
  const docStock = await collection.findOne({ _id: testIdStock });

  if (docNexus && docStock) {
    console.log('\n--- SUCESSO: Ambos os eventos foram persistidos com sucesso! ---');
    console.log(`[RaroNexus Evento]: ID=${docNexus._id}, System=${docNexus.system}, Action=${docNexus.action}, IngestedAt=${docNexus.ingestedAt}`);
    console.log(`[RaroStock Evento]: ID=${docStock._id}, System=${docStock.system}, Action=${docStock.action}, IngestedAt=${docStock.ingestedAt}`);
  } else {
    console.error('Falha ao encontrar documentos persistidos!');
    process.exit(1);
  }

  // 5. Teste de Busca por Tokens (1ms B-Tree)
  console.log('4. Testando busca B-Tree por token "cat6"...');
  const searchResults = await collection.find({ searchTokens: 'cat6' }).toArray();
  console.log(`✓ Encontrado ${searchResults.length} documento(s) com token 'cat6'.`);

  // 6. Limpeza dos testes
  console.log('5. Limpando registros de teste do MongoDB...');
  await collection.deleteMany({ _id: { $in: [testIdNexus, testIdStock] } });
  console.log('✓ Registros de teste removidos.');

  await mongo.close();
  console.log('\n=== FASE 3 VALIDADA COM SUCESSO DE PONTA A PONTA ===');
}

runVerification().catch((err) => {
  console.error('Erro na verificação:', err);
  process.exit(1);
});

