import { MongoClient, Db, Collection } from 'mongodb';
import { AuditEnvelope } from './types';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'rarotec_audit';

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!uri) {
  // Em build time sem env, exportamos stub para não quebrar coleta estática de páginas
  clientPromise = Promise.reject(new Error('MONGODB_URI não configurada no ambiente.'));
} else {
  if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    clientPromise = client.connect();
  }
}

export default clientPromise;

export async function getAuditDb(): Promise<Db> {
  const connectedClient = await clientPromise;
  return connectedClient.db(dbName);
}

export async function getAuditCollection(): Promise<Collection<AuditEnvelope>> {
  const db = await getAuditDb();
  return db.collection<AuditEnvelope>('audit_events');
}

