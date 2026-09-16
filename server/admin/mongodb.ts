/** Shared MongoDB connection and collection helpers for the admin API. */
import { MongoClient, type Collection, type Document } from "mongodb";
import type { AdminApiEnv } from "./env";

let cachedUri: string | undefined;
let cachedClient: MongoClient | undefined;
let connecting: Promise<MongoClient> | undefined;

export function mongoEnabled(env: AdminApiEnv): boolean {
  return Boolean(env.mongodbUri);
}

async function clientFor(env: AdminApiEnv): Promise<MongoClient> {
  if (!env.mongodbUri) throw new Error("MONGODB_URI is not configured.");
  if (cachedClient && cachedUri === env.mongodbUri) return cachedClient;
  if (!connecting || cachedUri !== env.mongodbUri) {
    if (cachedClient) void cachedClient.close();
    cachedUri = env.mongodbUri;
    const client = new MongoClient(env.mongodbUri, { maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 });
    connecting = client.connect().then((connected) => {
      cachedClient = connected;
      return connected;
    }).catch((error) => {
      connecting = undefined;
      throw error;
    });
  }
  return connecting;
}

export async function mongoCollection<T extends Document = Document>(
  env: AdminApiEnv,
  name: string
): Promise<Collection<T>> {
  const client = await clientFor(env);
  return client.db(env.mongodbDatabase).collection<T>(name);
}

export async function ensureMongoIndexes(env: AdminApiEnv): Promise<void> {
  if (!mongoEnabled(env)) return;
  const [operators, sessions] = await Promise.all([
    mongoCollection(env, "admin_operators"),
    mongoCollection(env, "admin_sessions"),
  ]);
  await Promise.all([
    operators.createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
