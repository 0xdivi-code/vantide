/** Server-only admin API configuration. */
import { readFileSync } from "node:fs";

export interface AdminApiEnv {
  mongodbUri?: string;
  mongodbDatabase: string;
  adminApiKey?: string;
  adminBootstrapEmail?: string;
  adminBootstrapPassword?: string;
  sessionTtlHours: number;
  allowedOrigins: string[];
  dataFile?: string;
  requireAuth: boolean;
  allowMemoryStore: boolean;
  nodeEnv: string;
}
type EnvSource = Record<string, string | undefined>;
const list = (value?: string) => (value ?? "").split(",").map((v) => v.trim()).filter(Boolean);
const flag = (value: string | undefined, fallback: boolean) => value == null || value === "" ? fallback : !["false", "0", "no"].includes(value.toLowerCase());

export function readAdminApiEnv(source: EnvSource = process.env): AdminApiEnv {
  const ttl = Number(source.ADMIN_SESSION_TTL_HOURS ?? 24);
  return {
    mongodbUri: source.MONGODB_URI?.trim() || undefined,
    mongodbDatabase: source.MONGODB_DATABASE?.trim() || "vantide",
    adminApiKey: source.ADMIN_API_KEY?.trim() || undefined,
    adminBootstrapEmail: source.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() || undefined,
    adminBootstrapPassword: source.ADMIN_BOOTSTRAP_PASSWORD || undefined,
    sessionTtlHours: Number.isFinite(ttl) && ttl > 0 ? Math.min(ttl, 24 * 30) : 24,
    allowedOrigins: list(source.ADMIN_API_ALLOWED_ORIGINS),
    dataFile: source.ADMIN_DATA_FILE?.trim() || undefined,
    requireAuth: flag(source.ADMIN_API_REQUIRE_AUTH, true),
    allowMemoryStore: flag(source.ADMIN_API_ALLOW_MEMORY_STORE, true),
    nodeEnv: source.NODE_ENV ?? "development",
  };
}
export function publicEnvSummary(env: AdminApiEnv) {
  return { mongoConfigured: Boolean(env.mongodbUri), auth: "opaque-session", authRequired: env.requireAuth, store: env.mongodbUri ? "mongodb" : "memory" };
}

export function loadDotEnv(files = [".env.local", ".env"]): string[] {
  const loaded: string[] = [];
  for (const file of files) {
    let text: string;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match || process.env[match[1]!] !== undefined) continue;
      let value = match[2]!.trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, "").trim();
      process.env[match[1]!] = value;
      loaded.push(match[1]!);
    }
  }
  return loaded;
}
