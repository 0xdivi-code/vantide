/**
 * PostgREST access for the admin tables. Talks to Supabase over plain
 * `fetch` with the service_role key, so no client library is bundled.
 */

import type { AdminApiEnv } from "./env";
import { supabaseEnabled } from "./env";
import { AdminHttpError } from "./types";

export interface SupabaseQuery {
  select?: string;
  filters?: Record<string, string | number | boolean | undefined>;
  order?: string;
  limit?: number;
  offset?: number;
  countExact?: boolean;
  insert?: Record<string, unknown>;
  patch?: Record<string, unknown>;
  single?: boolean;
}

export interface SupabaseResult {
  rows: Record<string, unknown>[];
  count: number | undefined;
}

function buildQuery(query: SupabaseQuery): string {
  const params = new URLSearchParams();
  params.set("select", query.select ?? "*");
  Object.entries(query.filters ?? {}).forEach(([column, value]) => {
    if (value === undefined) return;
    params.append(column, `eq.${value}`);
  });
  if (query.order) params.set("order", query.order);
  if (typeof query.limit === "number") params.set("limit", String(query.limit));
  if (typeof query.offset === "number" && query.offset > 0) {
    params.set("offset", String(query.offset));
  }
  return params.toString();
}

async function request(
  env: AdminApiEnv,
  table: string,
  init: RequestInit,
  queryString = ""
): Promise<{ rows: Record<string, unknown>[]; count: number | undefined }> {
  const base = env.supabaseUrl;
  const key = env.supabaseServiceKey;
  if (!base || !key) {
    throw new AdminHttpError(500, "SUPABASE_NOT_CONFIGURED", "Supabase credentials are missing on the server.");
  }

  const response = await fetch(`${base}/rest/v1/${table}${queryString ? `?${queryString}` : ""}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Supabase request failed (${response.status}).`;
    throw new AdminHttpError(502, "SUPABASE_ERROR", message, payload);
  }

  if (payload === null || payload === undefined) return { rows: [], count: undefined };
  const rows = (Array.isArray(payload) ? payload : [payload]).filter(
    (row): row is Record<string, unknown> => typeof row === "object" && row !== null
  );

  const range = response.headers.get("content-range");
  let count: number | undefined;
  if (range) {
    const total = range.split("/")[1];
    if (total && total !== "*") count = Number(total);
  }
  return { rows, count: Number.isFinite(count) ? count : undefined };
}

export function canUseSupabase(env: AdminApiEnv): boolean {
  return supabaseEnabled(env);
}

export async function selectRows(
  env: AdminApiEnv,
  table: string,
  query: SupabaseQuery = {}
): Promise<SupabaseResult> {
  const headers: Record<string, string> = {};
  if (query.countExact) headers.Prefer = "count=exact";
  if (query.single) headers.Accept = "application/vnd.pgrst.object+json";
  const result = await request(
    env,
    table,
    { method: "GET", headers },
    buildQuery({ ...query, countExact: undefined, single: undefined })
  );
  return result;
}

export async function insertRow(
  env: AdminApiEnv,
  table: string,
  values: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> {
  const { rows } = await request(
    env,
    table,
    {
      method: "POST",
      body: JSON.stringify(values),
      headers: { Prefer: "return=representation" },
    },
    "select=*"
  );
  return rows[0];
}

export async function patchRow(
  env: AdminApiEnv,
  table: string,
  match: Record<string, string | number>,
  values: Record<string, unknown>
): Promise<Record<string, unknown> | undefined> {
  const query = new URLSearchParams();
  Object.entries(match).forEach(([column, value]) => query.append(column, `eq.${value}`));
  query.set("select", "*");
  const { rows } = await request(env, table, {
    method: "PATCH",
    body: JSON.stringify(values),
    headers: { Prefer: "return=representation" },
  }, query.toString());
  return rows[0];
}
