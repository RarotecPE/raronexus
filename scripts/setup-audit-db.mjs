import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('d:/_RaroSpace/raronexus/.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const uriMatch = envContent.match(/MONGODB_URI=["']?([^"'\r\n]+)["']?/);

if (!uriMatch) {
  console.error('MONGODB_URI não encontrado no .env');
  process.exit(1);
}

const uri = uriMatch[1];
const client = new MongoClient(uri);

async function setupDatabase() {
  try {
    await client.connect();
    console.log('Conectado ao MongoDB Atlas com sucesso.');

    const db = client.db('rarotec_audit');
    const collectionName = 'audit_events';

    // Verificar se collection existe, se não, criar
    const collections = await db.listCollections({ name: collectionName }).toArray();
    if (collections.length === 0) {
      console.log(`Criando collection "${collectionName}"...`);
      await db.createCollection(collectionName);
    } else {
      console.log(`Collection "${collectionName}" já existe.`);
    }

    const collection = db.collection(collectionName);

    console.log('Criando os 7 índices essenciais de auditoria...');

    // 1. Timeline Geral e Feed do Painel
    await collection.createIndex({ timestamp: -1 }, { name: 'idx_timestamp_desc' });
    console.log('✓ Índice 1/7 criado: { timestamp: -1 }');

    // 2. Filtro por Sistema de Origem
    await collection.createIndex({ system: 1, timestamp: -1 }, { name: 'idx_system_timestamp' });
    console.log('✓ Índice 2/7 criado: { system: 1, timestamp: -1 }');

    // 3. Rastreamento por Colaborador
    await collection.createIndex({ 'actor.userId': 1, timestamp: -1 }, { name: 'idx_actor_timestamp' });
    console.log('✓ Índice 3/7 criado: { "actor.userId": 1, timestamp: -1 }');

    // 4. Filtro por Ação Específica
    await collection.createIndex({ action: 1, timestamp: -1 }, { name: 'idx_action_timestamp' });
    console.log('✓ Índice 4/7 criado: { action: 1, timestamp: -1 }');

    // 5. Filtro de Gravidade
    await collection.createIndex({ severity: 1, timestamp: -1 }, { name: 'idx_severity_timestamp' });
    console.log('✓ Índice 5/7 criado: { severity: 1, timestamp: -1 }');

    // 6. Busca Cirúrgica por Alvo (Multikey)
    await collection.createIndex(
      { 'targets.type': 1, 'targets.id': 1, timestamp: -1 },
      { name: 'idx_targets_type_id_timestamp' }
    );
    console.log('✓ Índice 6/7 criado: { "targets.type": 1, "targets.id": 1, timestamp: -1 }');

    // 7. Busca Instantânea por Palavra-Chave / Token
    await collection.createIndex({ searchTokens: 1, timestamp: -1 }, { name: 'idx_searchTokens_timestamp' });
    console.log('✓ Índice 7/7 criado: { searchTokens: 1, timestamp: -1 }');

    const indexes = await collection.indexes();
    console.log('\nTodos os índices ativos na collection:');
    for (const idx of indexes) {
      console.log(` - ${idx.name}: ${JSON.stringify(idx.key)}`);
    }

    console.log('\nFase 1 concluída com 100% de sucesso!');
  } catch (error) {
    console.error('Erro ao configurar banco de auditoria:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupDatabase();

