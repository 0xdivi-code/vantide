/**
 * Data access for the admin resources.
 *
 * Two interchangeable backends behind one interface:
 *   - MongoDB (production)
 *   - an in-process store seeded from `seed.ts` (zero-config / local dev),
 *     optionally persisted to `ADMIN_DATA_FILE`
 *
 * Every list endpoint understands the same query contract used by the admin
 * screens: `limit`, `offset`, `order`, `q` and any `column=value` filter.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AdminApiEnv } from "./env";
import { ensureMongoIndexes, mongoEnabled, mongoCollection } from "./mongodb";
import { buildSeedData, type Row } from "./seed";
import { notFound } from "./types";

export const RESOURCES = [
  "users",
  "kyc",
  "treasury",
  "funding",
  "referrals",
  "rewards",
  "notifications",
  "cms",
  "fees",
  "security",
  "support",
  "system",
] as const;

export type ResourceName = (typeof RESOURCES)[number];

export function isResourceName(value: string): value is ResourceName {
  return (RESOURCES as readonly string[]).includes(value);
}

/** resource → MongoDB collection */
export const RESOURCE_TABLES: Record<ResourceName, string> = {
  users: "admin_users",
  kyc: "admin_kyc",
  treasury: "admin_treasury",
  funding: "admin_funding",
  referrals: "admin_referrals",
  rewards: "admin_rewards",
  notifications: "admin_notifications",
  cms: "admin_cms",
  fees: "admin_fees",
  security: "admin_security_events",
  support: "admin_support_tickets",
  system: "admin_system_flags",
};

/** Column used for `order=` when the caller does not ask for one. */
const DEFAULT_ORDER: Partial<Record<ResourceName, string>> = {
  users: "created_at.desc",
  kyc: "submitted_at.desc",
  funding: "created_at.desc",
  security: "created_at.desc",
  support: "created_at.desc",
  notifications: "created_at.desc",
};

const RESERVED_PARAMS = new Set(["limit", "offset", "order", "q", "search"]);
const MAX_LIMIT = 500;

export interface ListParams {
  limit: number;
  offset: number;
  order?: string;
  q?: string;
  filters: Record<string, string>;
}

export function parseListParams(query: Record<string, string>, resource: ResourceName): ListParams {
  const rawLimit = Number(query.limit ?? "100");
  const rawOffset = Number(query.offset ?? "0");
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_LIMIT) : 100;
  const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;

  const filters: Record<string, string> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (RESERVED_PARAMS.has(key)) return;
    if (!/^[a-z_][a-z0-9_]*$/i.test(key)) return;
    filters[key] = value;
  });

  return {
    limit,
    offset,
    order: query.order || DEFAULT_ORDER[resource],
    q: query.q ?? query.search,
    filters,
  };
}

export interface ListResult {
  rows: Row[];
  total: number | undefined;
  limit: number;
  offset: number;
  store: "mongodb" | "memory";
  updated_at: number;
}

/* ------------------------------------------------------------------ */
/* Memory store                                                       */
/* ------------------------------------------------------------------ */

interface MemorySnapshot {
  tables: Record<string, Row[]>;
  audit: AuditEntry[];
}

export interface AuditEntry {
  id: string;
  ts: number;
  actor: string;
  action: string;
  resource: string;
  target?: string;
  details?: unknown;
}

let snapshot: MemorySnapshot | undefined;

function emptySnapshot(): MemorySnapshot {
  return { tables: buildSeedData(), audit: [] };
}

function loadSnapshot(env: AdminApiEnv): MemorySnapshot {
  if (snapshot) return snapshot;
  if (env.dataFile && existsSync(env.dataFile)) {
    try {
      const parsed = JSON.parse(readFileSync(env.dataFile, "utf8")) as Partial<MemorySnapshot>;
      snapshot = {
        tables: { ...buildSeedData(), ...(parsed.tables ?? {}) },
        audit: Array.isArray(parsed.audit) ? parsed.audit : [],
      };
      return snapshot;
    } catch (error) {
      console.warn(`[admin-api] could not read ${env.dataFile}, falling back to seed data:`, error);
    }
  }
  snapshot = emptySnapshot();
  return snapshot;
}

function persistSnapshot(env: AdminApiEnv): void {
  if (!env.dataFile || !snapshot) return;
  try {
    writeFileSync(env.dataFile, JSON.stringify(snapshot, null, 2));
  } catch (error) {
    console.warn(`[admin-api] could not write ${env.dataFile}:`, error);
  }
}

/** Test / hot-reload helper. */
export function resetMemoryStore(): void {
  snapshot = undefined;
}

function matchesFilters(row: Row, filters: Record<string, string>): boolean {
  return Object.entries(filters).every(([column, expected]) => {
    const value = row[column];
    if (value === undefined || value === null) return false;
    return String(value).toLowerCase() === expected.toLowerCase();
  });
}

function matchesSearch(row: Row, needle: string): boolean {
  return JSON.stringify(row).toLowerCase().includes(needle);
}

function sortRows(rows: Row[], order: string | undefined): Row[] {
  if (!order) return rows;
  const [columnRaw, directionRaw] = order.split(".");
  const column = columnRaw!;
  const descending = (directionRaw ?? "asc").toLowerCase() !== "asc";
  return [...rows].sort((a, b) => {
    const left = a[column];
    const right = b[column];
    if (left === right) return 0;
    if (left === null || left === undefined) return 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === "number" && typeof right === "number") {
      return descending ? right - left : left - right;
    }
    const comparison = String(left).localeCompare(String(right));
    return descending ? -comparison : comparison;
  });
}

/* ------------------------------------------------------------------ */
/* MongoDB first-run seed                                             */
/* ------------------------------------------------------------------ */

/**
 * Tracks which (uri, database) pairs we already attempted to seed this
 * process lifetime so empty-collection checks stay cheap after startup.
 */
const seededDatabases = new Set<string>();
let seeding: Promise<void> | undefined;

function seedKey(env: AdminApiEnv): string {
  return `${env.mongodbUri ?? ""}::${env.mongodbDatabase}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as {
    code?: number;
    codeName?: string;
    writeErrors?: Array<{ code?: number }>;
  };
  if (record.code === 11000 || record.codeName === "DuplicateKey") return true;
  return Array.isArray(record.writeErrors) && record.writeErrors.some((entry) => entry?.code === 11000);
}

/**
 * Insert seed rows into any operational collection that is still empty.
 * Never overwrites existing documents — once an operator writes real data
 * the collection stays authoritative.
 */
export async function ensureMongoSeed(env: AdminApiEnv): Promise<void> {
  if (!mongoEnabled(env) || !env.seedEmptyCollections) return;
  const key = seedKey(env);
  if (seededDatabases.has(key)) return;
  if (seeding) {
    await seeding;
    return;
  }

  seeding = (async () => {
    // Indexes first so concurrent seeds cannot double-insert the same `id`.
    await ensureMongoIndexes(env);

    const seed = buildSeedData();
    const inserted: string[] = [];
    await Promise.all(
      RESOURCES.map(async (resource) => {
        const collection = await mongoCollection<Row>(env, RESOURCE_TABLES[resource]);
        const count = await collection.countDocuments({}, { limit: 1 });
        if (count > 0) return;
        const rows = seed[resource] ?? [];
        if (rows.length === 0) return;
        try {
          // ordered:false so a partial unique-index collision cannot abort the batch
          await collection.insertMany(rows, { ordered: false });
          inserted.push(resource);
        } catch (error) {
          // Duplicate key from a racing peer is fine — the collection is no longer empty.
          if (!isDuplicateKeyError(error)) throw error;
        }
      })
    );
    if (inserted.length > 0) {
      console.info(
        `[admin-api] seeded empty MongoDB collections (${env.mongodbDatabase}): ${inserted.join(", ")}`
      );
    }
    seededDatabases.add(key);
  })()
    .catch((error) => {
      // Allow a later request to retry if the first attempt failed (e.g. brief Atlas blip).
      console.warn("[admin-api] MongoDB seed failed:", error);
      throw error;
    })
    .finally(() => {
      seeding = undefined;
    });

  await seeding;
}

/** Test helper: clear the in-process “already seeded” memo. */
export function resetMongoSeedState(): void {
  seededDatabases.clear();
  seeding = undefined;
}

/* ------------------------------------------------------------------ */
/* Read                                                               */
/* ------------------------------------------------------------------ */

export async function listResource(
  env: AdminApiEnv,
  resource: ResourceName,
  params: ListParams
): Promise<ListResult> {
  if (mongoEnabled(env)) {
    await ensureMongoSeed(env);
    const collection = await mongoCollection<Row>(env, RESOURCE_TABLES[resource]);
    const filter: Record<string, unknown> = { ...params.filters };
    const [column, direction = "asc"] = (params.order ?? "").split(".");
    let cursor = collection.find(filter, { projection: { _id: 0 } });
    if (column) cursor = cursor.sort({ [column]: direction === "asc" ? 1 : -1 });
    if (params.q) {
      const needle = params.q.trim().toLowerCase();
      const matching = (await cursor.toArray()).filter((row) => matchesSearch(row, needle));
      return { rows: matching.slice(params.offset, params.offset + params.limit), total: matching.length, limit: params.limit, offset: params.offset, store: "mongodb", updated_at: Date.now() };
    }
    const [rows, total] = await Promise.all([cursor.skip(params.offset).limit(params.limit).toArray(), collection.countDocuments(filter)]);
    return { rows, total, limit: params.limit, offset: params.offset, store: "mongodb", updated_at: Date.now() };
  }

  const table = loadSnapshot(env).tables[resource] ?? [];
  const needle = params.q?.trim().toLowerCase();
  const filtered = table.filter((row) => matchesFilters(row, params.filters) && (!needle || matchesSearch(row, needle)));
  const ordered = sortRows(filtered, params.order);
  return {
    rows: ordered.slice(params.offset, params.offset + params.limit),
    total: filtered.length,
    limit: params.limit,
    offset: params.offset,
    store: "memory",
    updated_at: Date.now(),
  };
}

export async function findRow(
  env: AdminApiEnv,
  resource: ResourceName,
  id: string
): Promise<Row | undefined> {
  if (mongoEnabled(env)) {
    await ensureMongoSeed(env);
    return (await (await mongoCollection<Row>(env, RESOURCE_TABLES[resource])).findOne({ id }, { projection: { _id: 0 } })) ?? undefined;
  }
  return (loadSnapshot(env).tables[resource] ?? []).find((row) => String(row.id) === id);
}

/* ------------------------------------------------------------------ */
/* Write                                                              */
/* ------------------------------------------------------------------ */

export async function createRow(
  env: AdminApiEnv,
  resource: ResourceName,
  values: Row
): Promise<Row> {
  if (mongoEnabled(env)) {
    // Seed sibling collections first so overview/list screens stay consistent
    // after the first mutation on a brand-new database.
    await ensureMongoSeed(env);
    const row: Row = { id: values.id ?? `${resource.slice(0, 3)}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, ...values, created_at: values.created_at ?? Date.now() };
    await (await mongoCollection<Row>(env, RESOURCE_TABLES[resource])).insertOne(row);
    return row;
  }

  const store = loadSnapshot(env);
  const table = (store.tables[resource] ??= []);
  const row: Row = {
    id: values.id ?? `${resource.slice(0, 3)}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
    ...values,
    created_at: values.created_at ?? Date.now(),
  };
  table.unshift(row);
  persistSnapshot(env);
  return row;
}

export async function updateRow(
  env: AdminApiEnv,
  resource: ResourceName,
  id: string,
  patch: Row
): Promise<Row> {
  if (mongoEnabled(env)) {
    await ensureMongoSeed(env);
    const result = await (await mongoCollection<Row>(env, RESOURCE_TABLES[resource])).findOneAndUpdate(
      { id }, { $set: { ...patch, updated_at: Date.now() } }, { returnDocument: "after", projection: { _id: 0 } }
    );
    if (!result) throw notFound(`No ${resource} record with id "${id}".`);
    return result;
  }

  const store = loadSnapshot(env);
  const table = store.tables[resource] ?? [];
  const index = table.findIndex((row) => String(row.id) === id);
  if (index === -1) throw notFound(`No ${resource} record with id "${id}".`);
  const next = { ...table[index]!, ...patch, updated_at: Date.now() };
  table[index] = next;
  persistSnapshot(env);
  return next;
}

/* ------------------------------------------------------------------ */
/* Audit log                                                          */
/* ------------------------------------------------------------------ */

export async function recordAudit(
  env: AdminApiEnv,
  entry: Omit<AuditEntry, "id" | "ts">
): Promise<AuditEntry> {
  const record: AuditEntry = { id: `aud_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, ts: Date.now(), ...entry };
  if (mongoEnabled(env)) {
    await (await mongoCollection<AuditEntry>(env, "admin_audit")).insertOne(record);
    return record;
  }
  const store = loadSnapshot(env);
  store.audit.unshift(record);
  if (store.audit.length > 500) store.audit.length = 500;
  persistSnapshot(env);
  return record;
}

export async function readAudit(env: AdminApiEnv, limit = 50): Promise<AuditEntry[]> {
  if (mongoEnabled(env)) return (await mongoCollection<AuditEntry>(env, "admin_audit")).find({}, { projection: { _id: 0 } }).sort({ ts: -1 }).limit(limit).toArray();
  return loadSnapshot(env).audit.slice(0, limit);
}
