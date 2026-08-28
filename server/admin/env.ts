/**
 * Environment resolution for the admin API.
 *
 * Every secret lives here and nowhere near `VITE_*` / `public/config.js`:
 * build-time variables are shipped to every browser.
 */

import { readFileSync } from "node:fs";

export interface AdminApiEnv {
  /** Supabase project URL, e.g. https://xyzcompany.supabase.co */
  supabaseUrl?: string;
  /** service_role key — server only, used to read/write the admin tables. */
  supabaseServiceKey?: string;
  /** JWT secret from Supabase → Settings → API. Used to verify admin tokens. */
  supabaseJwtSecret?: string;
  /** Escape hatch API key accepted as `x-admin-api-key` for cron jobs / CLI. */
  adminApiKey?: string;
  /** Comma separated browser origins allowed to call the API cross-origin. */
  allowedOrigins: string[];
  /** Comma separated emails granted admin access even without app_metadata. */
  allowlistEmails: string[];
  /** When set, the bundled memory store is persisted to this JSON file. */
  dataFile?: string;
  /** Set to "false" to serve data without authentication (local hacking only). */
  requireAuth: boolean;
  /** Set to "false" to reject requests when Supabase is not configured. */
  allowMemoryStore: boolean;
  nodeEnv: string;
}

type EnvSource = Record<string, string | undefined>;

function list(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function url(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    return parsed.href.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function flag(value: string | undefined, fallback: boolean): boolean {
  const normalized = value?.trim().toLowerCase();
  if (normalized === undefined || normalized === "") return fallback;
  return !(normalized === "false" || normalized === "0" || normalized === "no");
}

export function readAdminApiEnv(source: EnvSource = process.env): AdminApiEnv {
  return {
    supabaseUrl: url(source.SUPABASE_URL ?? source.VITE_SUPABASE_URL),
    supabaseServiceKey: source.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
    supabaseJwtSecret: source.SUPABASE_JWT_SECRET?.trim() || undefined,
    adminApiKey: source.ADMIN_API_KEY?.trim() || undefined,
    allowedOrigins: list(source.ADMIN_API_ALLOWED_ORIGINS),
    allowlistEmails: list(source.ADMIN_ALLOWLIST_EMAILS).map((email) => email.toLowerCase()),
    dataFile: source.ADMIN_DATA_FILE?.trim() || undefined,
    requireAuth: flag(source.ADMIN_API_REQUIRE_AUTH, true),
    allowMemoryStore: flag(source.ADMIN_API_ALLOW_MEMORY_STORE, true),
    nodeEnv: source.NODE_ENV ?? "development",
  };
}

export function supabaseEnabled(env: AdminApiEnv): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceKey);
}

/**
 * Minimal `.env` loader (no dependency, works on any Node >= 18).
 *
 * Reads the given files in order; earlier files win, and a variable that is
 * already present in the real environment is never overwritten, so a shell
 * export always beats the file. Used by `server/standalone.ts` — Vite has its
 * own loader for `yarn dev` (see vite-plugins/admin-api.ts).
 */
export function loadDotEnv(files: string[] = [".env.local", ".env"]): string[] {
  const loaded: string[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue; // file is optional
    }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (!key || process.env[key] !== undefined) continue;
      let value = rawValue.trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
        (value.startsWith("'") && value.endsWith("'") && value.length > 1)
      ) {
        value = value.slice(1, -1);
      } else {
        // Strip trailing comments only on unquoted values.
        value = value.replace(/\s+#.*$/, "").trim();
      }
      process.env[key] = value;
      loaded.push(key);
    }
  }
  return loaded;
}

/** Diagnostics that are safe to expose to the browser. */
export function publicEnvSummary(env: AdminApiEnv) {
  return {
    supabaseConfigured: supabaseEnabled(env),
    jwtVerification: Boolean(env.supabaseJwtSecret),
    allowlistEmails: env.allowlistEmails.length,
    authRequired: env.requireAuth,
    store: supabaseEnabled(env) ? "supabase" : "memory",
  };
}
