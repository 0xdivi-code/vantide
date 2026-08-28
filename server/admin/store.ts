/**
 * Data access for the admin resources.
 *
 * Two interchangeable backends behind one interface:
 *   - Supabase Postgres through PostgREST (production)
 *   - an in-process store seeded from `seed.ts` (zero-config / local dev),
 *     optionally persisted to `ADMIN_DATA_FILE`
 *
 * Every list endpoint understands the same query contract used by the admin
 * screens: `limit`, `offset`, `order`, `q` and any `column=value` filter.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { AdminApiEnv } from "./env";
import { supabaseEnabled } from "./env";
import { buildSeedData, type Row } from "./seed";
import { insertRow, patchRow, selectRows } from "./supabase";
import { badRequest, notFound } from "./types";

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

/** resource → Postgres table (see server/admin/supabase/schema.sql) */
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
  store: "supabase" | "memory";
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
/* Read                                                               */
/* ------------------------------------------------------------------ */

export async function listResource(
  env: AdminApiEnv,
  resource: ResourceName,
  params: ListParams
): Promise<ListResult> {
  if (supabaseEnabled(env)) {
    const { rows, count } = await selectRows(env, RESOURCE_TABLES[resource], {
      select: "*",
      filters: params.filters,
      order: params.order,
      limit: params.limit,
      offset: params.offset,
      countExact: true,
    });
    const filtered = params.q
      ? rows.filter((row) => matchesSearch(row, params.q!.toLowerCase()))
      : rows;
    return {
      rows: filtered,
      total: params.q ? undefined : count ?? filtered.length,
      limit: params.limit,
      offset: params.offset,
      store: "supabase",
      updated_at: Date.now(),
    };
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
  if (supabaseEnabled(env)) {
    const { rows } = await selectRows(env, RESOURCE_TABLES[resource], {
      select: "*",
      filters: { id },
      limit: 1,
    });
    return rows[0];
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
  if (supabaseEnabled(env)) {
    const created = await insertRow(env, RESOURCE_TABLES[resource], values);
    if (!created) throw badRequest("Supabase did not return the created record.");
    return created;
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
  if (supabaseEnabled(env)) {
    const updated = await patchRow(env, RESOURCE_TABLES[resource], { id }, { ...patch, updated_at: new Date().toISOString() });
    if (!updated) throw notFound(`No ${resource} record with id "${id}".`);
    return updated;
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

export function recordAudit(
  env: AdminApiEnv,
  entry: Omit<AuditEntry, "id" | "ts">
): AuditEntry {
  const record: AuditEntry = {
    id: `aud_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
    ts: Date.now(),
    ...entry,
  };
  const store = loadSnapshot(env);
  store.audit.unshift(record);
  if (store.audit.length > 500) store.audit.length = 500;
  persistSnapshot(env);
  return record;
}

export function readAudit(env: AdminApiEnv, limit = 50): AuditEntry[] {
  return loadSnapshot(env).audit.slice(0, limit);
}
