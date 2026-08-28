/**
 * The admin API router. Framework-agnostic: it takes a plain request object
 * and returns a plain response object, so Vercel functions, the Vite dev
 * middleware and the standalone Node server all share this exact code.
 */

import { authenticate } from "./auth";
import type { AdminApiEnv } from "./env";
import { publicEnvSummary, readAdminApiEnv } from "./env";
import {
  RESOURCES,
  createRow,
  findRow,
  isResourceName,
  listResource,
  parseListParams,
  readAudit,
  recordAudit,
  updateRow,
  type ResourceName,
} from "./store";
import {
  AdminHttpError,
  badRequest,
  methodNotAllowed,
  notFound,
  unauthorized,
  type AdminCaller,
  type AdminContext,
  type AdminRequest,
  type AdminResponse,
  type DataMode,
} from "./types";

export const ADMIN_API_VERSION = "1.0.0";
export const SESSION_HEADER = "x-admin-session";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export interface RouterOptions {
  env?: AdminApiEnv;
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): AdminResponse {
  return { status, headers: { ...JSON_HEADERS, ...headers }, body };
}

function ok(data: unknown, meta: Record<string, unknown> = {}, headers: Record<string, string> = {}): AdminResponse {
  return json(200, { success: true, data, meta: { api: ADMIN_API_VERSION, ...meta } }, headers);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/* ------------------------------------------------------------------ */
/* Handlers                                                           */
/* ------------------------------------------------------------------ */

function health(env: AdminApiEnv): AdminResponse {
  return ok(
    {
      status: "ok",
      version: ADMIN_API_VERSION,
      ts: Date.now(),
      ...publicEnvSummary(env),
    },
    { public: true }
  );
}

function me(context: AdminContext, env: AdminApiEnv): AdminResponse {
  return ok({
    id: context.caller.id,
    email: context.caller.email,
    role: context.caller.role,
    authenticatedVia: context.caller.via,
    dataStore: context.dataMode,
    resources: RESOURCES,
    server: publicEnvSummary(env),
  });
}

async function overview(env: AdminApiEnv, context: AdminContext) {
  const [users, kyc, treasury, funding, support, notifications, security] = await Promise.all([
    listResource(env, "users", parseListParams({ limit: "500" }, "users")),
    listResource(env, "kyc", parseListParams({ limit: "500" }, "kyc")),
    listResource(env, "treasury", parseListParams({ limit: "100" }, "treasury")),
    listResource(env, "funding", parseListParams({ limit: "500" }, "funding")),
    listResource(env, "support", parseListParams({ limit: "500" }, "support")),
    listResource(env, "notifications", parseListParams({ limit: "500" }, "notifications")),
    listResource(env, "security", parseListParams({ limit: "100" }, "security")),
  ]);

  const sum = (rows: Record<string, unknown>[], key: string): number =>
    rows.reduce((total, row) => {
      const value = Number(row[key]);
      return Number.isFinite(value) ? total + value : total;
    }, 0);

  const countWhere = (rows: Record<string, unknown>[], key: string, value: string): number =>
    rows.filter((row) => String(row[key]).toLowerCase() === value).length;

  const wallets = treasury.rows;
  const criticalWallets = wallets.filter((row) => row.status === "critical" || row.status === "warning");

  return ok(
    {
      generated_at: Date.now(),
      users: {
        total: users.total ?? users.rows.length,
        suspended: countWhere(users.rows, "status", "suspended"),
        pending: countWhere(users.rows, "status", "pending"),
        equity_usdc: Math.round(sum(users.rows, "equity_usdc") * 100) / 100,
        volume_30d_usdc: Math.round(sum(users.rows, "volume_30d_usdc") * 100) / 100,
      },
      kyc: {
        total: kyc.total ?? kyc.rows.length,
        pending: countWhere(kyc.rows, "status", "pending"),
        in_review: countWhere(kyc.rows, "status", "in_review"),
        rejected: countWhere(kyc.rows, "status", "rejected"),
      },
      treasury: {
        total_usdc: Math.round(sum(wallets, "balance_usdc") * 100) / 100,
        hot_usdc: Math.round(sum(wallets.filter((row) => row.type === "hot"), "balance_usdc") * 100) / 100,
        cold_usdc: Math.round(sum(wallets.filter((row) => row.type === "cold"), "balance_usdc") * 100) / 100,
        insurance_usdc: Math.round(sum(wallets.filter((row) => row.type === "insurance"), "balance_usdc") * 100) / 100,
        alerts: criticalWallets.map((row) => ({ id: row.id, label: row.label, status: row.status })),
      },
      funding: {
        deposits_pending: countWhere(funding.rows.filter((row) => row.type === "deposit"), "status", "pending"),
        withdrawals_pending: countWhere(
          funding.rows.filter((row) => row.type === "withdrawal"),
          "status",
          "pending"
        ),
        volume_usdc: Math.round(sum(funding.rows, "amount_usdc") * 100) / 100,
      },
      support: {
        open: countWhere(support.rows, "status", "open"),
        escalated: countWhere(support.rows, "status", "escalated"),
        unassigned: support.rows.filter((row) => !row.assignee).length,
      },
      notifications: { unread: countWhere(notifications.rows, "status", "unread") },
      security: { flagged: countWhere(security.rows, "status", "flagged") },
    },
    { store: context.dataMode }
  );
}

async function list(env: AdminApiEnv, resource: ResourceName, query: Record<string, string>, context: AdminContext) {
  const params = parseListParams(query, resource);
  const result = await listResource(env, resource, params);
  return ok(result, { resource, ...result, store: context.dataMode });
}

async function detail(env: AdminApiEnv, resource: ResourceName, id: string, context: AdminContext) {
  const row = await findRow(env, resource, id);
  if (!row) throw notFound(`No ${resource} record with id "${id}".`);
  return ok(row, { resource, id, store: context.dataMode });
}

async function patch(
  env: AdminApiEnv,
  resource: ResourceName,
  id: string,
  body: unknown,
  caller: AdminCaller
) {
  const patchValues = asRecord(body);
  if (!patchValues || Object.keys(patchValues).length === 0) {
    throw badRequest("Send a JSON object with the fields to update.");
  }
  const safe: Record<string, unknown> = { ...patchValues };
  delete safe.id;
  delete safe.created_at;
  const updated = await updateRow(env, resource, id, safe);
  recordAudit(env, {
    actor: caller.email,
    action: "update",
    resource,
    target: id,
    details: Object.keys(safe),
  });
  return ok(updated, { resource, id });
}

async function create(
  env: AdminApiEnv,
  resource: ResourceName,
  body: unknown,
  caller: AdminCaller
) {
  const values = asRecord(body);
  if (!values || Object.keys(values).length === 0) {
    throw badRequest("Send a JSON object with the fields to create.");
  }
  const created = await createRow(env, resource, values);
  recordAudit(env, {
    actor: caller.email,
    action: "create",
    resource,
    target: String(created.id ?? ""),
    details: Object.keys(values),
  });
  return json(201, { success: true, data: created, meta: { resource, api: ADMIN_API_VERSION } });
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                           */
/* ------------------------------------------------------------------ */

const PUBLIC_PATHS = new Set(["/health", "/"]);

interface RouteMatch {
  resource: ResourceName;
  id?: string;
}

function matchRoute(path: string): RouteMatch | undefined {
  const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments.length === 0) return undefined;
  const [first, second] = segments;
  if (!first || !isResourceName(first)) return undefined;
  if (segments.length === 1) return { resource: first };
  if (segments.length === 2 && second) return { resource: first, id: second };
  return undefined;
}

export async function route(
  request: AdminRequest,
  env: AdminApiEnv
): Promise<AdminResponse> {
  const method = request.method.toUpperCase();
  const path = request.path || "/";

  if (method === "OPTIONS") {
    return { status: 204, headers: {}, body: "" };
  }

  if (method !== "GET" && method !== "POST" && method !== "PATCH" && method !== "PUT" && method !== "DELETE") {
    throw methodNotAllowed(method);
  }

  if (PUBLIC_PATHS.has(path) || path === "/health") {
    if (method !== "GET") throw methodNotAllowed(method);
    if (path === "/") {
      return ok({
        name: "Vantide Admin API",
        version: ADMIN_API_VERSION,
        docs: "docs/admin-api.md",
        endpoints: [
          "GET /health",
          "GET /me",
          "GET /overview",
          "GET /audit",
          `GET /{${RESOURCES.join("|")}}`,
          "GET /{resource}/{id}",
          "POST /{resource}",
          "PATCH /{resource}/{id}",
        ],
      });
    }
    return health(env);
  }

  const caller = await authenticate(request.headers, env);
  const dataMode: DataMode = env.supabaseUrl && env.supabaseServiceKey ? "supabase" : "memory";

  if (dataMode === "memory" && !env.allowMemoryStore) {
    throw new AdminHttpError(
      503,
      "STORE_DISABLED",
      "Supabase is not configured and ADMIN_API_ALLOW_MEMORY_STORE=false. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server."
    );
  }

  const context: AdminContext = { caller, dataMode };

  if (path === "/me") {
    if (method !== "GET") throw methodNotAllowed(method);
    return me(context, env);
  }

  if (path === "/overview") {
    if (method !== "GET") throw methodNotAllowed(method);
    return overview(env, context);
  }

  if (path === "/audit") {
    if (method !== "GET") throw methodNotAllowed(method);
    const limit = Number(request.query.limit ?? "50");
    return ok({ rows: readAudit(env, Number.isFinite(limit) ? limit : 50) }, { store: dataMode });
  }

  const match = matchRoute(path);
  if (!match) throw notFound(`No admin API endpoint for ${method} ${path}.`);

  if (method === "GET" && !match.id) return list(env, match.resource, request.query, context);
  if (method === "GET" && match.id) return detail(env, match.resource, match.id, context);
  if ((method === "POST" || method === "PUT") && !match.id) {
    return create(env, match.resource, request.body, caller);
  }
  if ((method === "PATCH" || method === "PUT") && match.id) {
    return patch(env, match.resource, match.id, request.body, caller);
  }

  throw methodNotAllowed(method);
}

/* ------------------------------------------------------------------ */
/* CORS                                                               */
/* ------------------------------------------------------------------ */

export function corsHeaders(request: AdminRequest, env: AdminApiEnv): Record<string, string> {
  const origin = request.headers.origin;
  const headers: Record<string, string> = {
    vary: "Origin",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "Content-Type,Authorization,x-admin-api-key",
    "access-control-max-age": "86400",
  };
  if (!origin) return headers;

  const allowed = env.allowedOrigins.some(
    (entry) => entry === "*" || entry.toLowerCase() === origin.toLowerCase()
  );
  let sameOrigin = false;
  try {
    sameOrigin = new URL(origin).origin === origin;
  } catch {
    sameOrigin = false;
  }

  if (allowed || (sameOrigin && env.allowedOrigins.length === 0)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
  }
  return headers;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                        */
/* ------------------------------------------------------------------ */

export interface HandleOptions extends RouterOptions {
  /** Base path the API is mounted at, e.g. "/api/admin". */
  base?: string;
}

export async function handleAdminRequest(
  request: AdminRequest,
  options: HandleOptions = {}
): Promise<AdminResponse> {
  const env = options.env ?? readAdminApiEnv();
  const cors = corsHeaders(request, env);

  try {
    const response = await route(request, env);
    return { ...response, headers: { ...cors, ...(response.headers ?? {}) } };
  } catch (error) {
    if (error instanceof AdminHttpError) {
      return {
        status: error.status,
        headers: { ...cors, ...JSON_HEADERS },
        body: {
          success: false,
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      };
    }
    console.error("[admin-api] unhandled error:", error);
    const message =
      env.nodeEnv === "production"
        ? "The admin API hit an unexpected error."
        : error instanceof Error
          ? error.message
          : "Unknown error";
    return {
      status: 500,
      headers: { ...cors, ...JSON_HEADERS },
      body: { success: false, code: "INTERNAL_ERROR", message },
    };
  }
}

/** Convenience for adapters that only have an auth header. */
export function requireBearer(headers: Record<string, string>): string {
  const header = headers.authorization;
  if (!header?.toLowerCase().startsWith("bearer ")) throw unauthorized();
  return header.slice(7).trim();
}
