import { MongoClient, Db, Collection } from 'mongodb';
import { AuditEnvelope } from './types';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'rarotec_audit';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export async function getAuditClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error('MONGODB_URI não configurada no ambiente.');
  }

  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    global._mongoClientPromise = client.connect().catch((err) => {
      global._mongoClientPromise = undefined;
      throw err;
    });
  }

  return global._mongoClientPromise;
}

export async function getAuditDb(): Promise<Db> {
  const connectedClient = await getAuditClient();
  return connectedClient.db(dbName);
}

export async function getAuditCollection(): Promise<Collection<AuditEnvelope>> {
  const db = await getAuditDb();
  return db.collection<AuditEnvelope>('audit_events');
}

export default {
  then: (...args: Parameters<Promise<MongoClient>['then']>) => getAuditClient().then(...args),
  catch: (...args: Parameters<Promise<MongoClient>['catch']>) => getAuditClient().catch(...args),
};
