/**
 * Admin API test-suite. Exercises the real router that Vercel, the Vite dev
 * middleware and the standalone server all call — no mocks, no re-implementation.
 *
 *   yarn test:api
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- responses are untyped JSON by design */

import { test } from "node:test";
import assert from "node:assert/strict";

import { handleAdminRequest } from "../server/admin/router";
import { signHs256 } from "../server/admin/jwt";
import { readAdminApiEnv, type AdminApiEnv } from "../server/admin/env";
import { RESOURCES, resetMemoryStore } from "../server/admin/store";
import type { AdminRequest, AdminResponse } from "../server/admin/types";

const JWT_SECRET = "test-only-supabase-jwt-secret";
const API_KEY = "test-only-admin-api-key";

function env(overrides: Record<string, string | undefined> = {}): AdminApiEnv {
  return readAdminApiEnv({
    NODE_ENV: "test",
    SUPABASE_JWT_SECRET: JWT_SECRET,
    ADMIN_API_KEY: API_KEY,
    ADMIN_ALLOWLIST_EMAILS: "allowlisted@vantide.io",
    ...overrides,
  });
}

function adminToken(email = "ops@vantide.io", appMetadata: Record<string, unknown> = { role: "admin" }) {
  return signHs256(
    { sub: `user_${email}`, email, role: "authenticated", app_metadata: appMetadata },
    JWT_SECRET,
    { expiresInSec: 600 }
  );
}

async function call(
  path: string,
  init: {
    method?: string;
    token?: string;
    apiKey?: string;
    body?: unknown;
    headers?: Record<string, string>;
    environment?: AdminApiEnv;
  } = {}
): Promise<{ status: number; body: any; headers: Record<string, string> }> {
  const [pathname, search = ""] = path.split("?");
  const query: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    query[key] = value;
  });

  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  if (init.apiKey) headers["x-admin-api-key"] = init.apiKey;

  const request: AdminRequest = {
    method: init.method ?? "GET",
    path: pathname!,
    query,
    headers,
    body: init.body,
  };

  const response: AdminResponse = await handleAdminRequest(request, {
    env: init.environment ?? env(),
    base: "/api/admin",
  });

  return {
    status: response.status,
    body: response.body as any,
    headers: response.headers ?? {},
  };
}

function reset() {
  resetMemoryStore();
}

/* ------------------------------------------------------------------ */

test("GET /health is public and reports the active store", async () => {
  const response = await call("/health");
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.status, "ok");
  assert.equal(response.body.data.store, "memory");
  assert.equal(response.body.data.jwtVerification, true);
});

test("GET / describes the endpoint surface", async () => {
  const response = await call("/");
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.data.endpoints));
  assert.ok(response.body.data.endpoints.length > 5);
});

test("private resources reject anonymous callers with 401", async () => {
  reset();
  const response = await call("/users");
  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
  assert.equal(response.body.code, "UNAUTHORIZED");
});

test("tokens signed with another secret are rejected", async () => {
  reset();
  const foreign = signHs256({ sub: "x", email: "ops@vantide.io", app_metadata: { role: "admin" } }, "wrong-secret");
  const response = await call("/users", { token: foreign });
  assert.equal(response.status, 401);
});

test("expired tokens are rejected", async () => {
  reset();
  const expired = signHs256(
    { sub: "x", email: "ops@vantide.io", app_metadata: { role: "admin" } },
    JWT_SECRET,
    { expiresInSec: -60, issuedAt: Math.floor(Date.now() / 1000) - 3600 }
  );
  const response = await call("/users", { token: expired });
  assert.equal(response.status, 401);
});

test("signed-in users without operator access get 403", async () => {
  reset();
  const response = await call("/users", { token: adminToken("customer@example.com", {}) });
  assert.equal(response.status, 403);
  assert.equal(response.body.code, "FORBIDDEN");
});

test("allowlisted emails are granted access", async () => {
  reset();
  const response = await call("/me", { token: adminToken("allowlisted@vantide.io", {}) });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.email, "allowlisted@vantide.io");
});

test("app_metadata.role = admin is granted access", async () => {
  reset();
  const response = await call("/me", { token: adminToken() });
  assert.equal(response.status, 200);
  assert.equal(response.body.data.authenticatedVia, "jwt");
  assert.deepEqual(response.body.data.resources, [...RESOURCES]);
});

test("the machine API key works without a JWT", async () => {
  reset();
  const response = await call("/overview", { apiKey: API_KEY });
  assert.equal(response.status, 200);
  assert.ok(response.body.data.users.total > 0);
});

test("every resource returns tabular rows", async () => {
  reset();
  const token = adminToken();
  for (const resource of RESOURCES) {
    const response = await call(`/${resource}?limit=100`, { token });
    assert.equal(response.status, 200, `${resource} should return 200`);
    const rows = response.body.data.rows;
    assert.ok(Array.isArray(rows), `${resource} should return a rows array`);
    assert.ok(rows.length > 0, `${resource} should return seeded rows`);
    rows.forEach((row: any) => {
      assert.ok(row.id !== undefined && row.id !== null, `${resource} rows need an id`);
    });
  }
});

test("list endpoints honour limit, offset and column filters", async () => {
  reset();
  const token = adminToken();

  const limited = await call("/users?limit=3", { token });
  assert.equal(limited.body.data.rows.length, 3);
  assert.equal(limited.body.data.limit, 3);
  assert.ok(limited.body.data.total >= 3);

  const offset = await call("/users?limit=3&offset=3", { token });
  assert.notEqual(offset.body.data.rows[0].id, limited.body.data.rows[0].id);

  const filtered = await call("/notifications?status=unread&limit=4", { token });
  assert.ok(filtered.body.data.rows.length <= 4);
  filtered.body.data.rows.forEach((row: any) => assert.equal(row.status, "unread"));
});

test("detail endpoint returns a single record and 404s on unknown ids", async () => {
  reset();
  const token = adminToken();
  const list = await call("/treasury?limit=1", { token });
  const id = list.body.data.rows[0].id as string;

  const found = await call(`/treasury/${encodeURIComponent(id)}`, { token });
  assert.equal(found.status, 200);
  assert.equal(found.body.data.id, id);

  const missing = await call("/treasury/does-not-exist", { token });
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, "NOT_FOUND");
});

test("PATCH updates a record and writes an audit entry", async () => {
  reset();
  const token = adminToken();
  const list = await call("/users?limit=1", { token });
  const id = list.body.data.rows[0].id as string;

  const patched = await call(`/users/${encodeURIComponent(id)}`, {
    method: "PATCH",
    token,
    body: { status: "suspended" },
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.status, "suspended");

  const after = await call(`/users/${encodeURIComponent(id)}`, { token });
  assert.equal(after.body.data.status, "suspended");

  const audit = await call("/audit?limit=10", { token });
  assert.equal(audit.status, 200);
  assert.equal(audit.body.data.rows[0].action, "update");
  assert.equal(audit.body.data.rows[0].resource, "users");
  assert.equal(audit.body.data.rows[0].actor, "ops@vantide.io");
});

test("POST creates a record that shows up in the list", async () => {
  reset();
  const token = adminToken();
  const created = await call("/notifications", {
    method: "POST",
    token,
    body: { title: "Created by the test-suite", severity: "warning", status: "unread" },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.title, "Created by the test-suite");

  const listed = await call("/notifications?limit=100", { token });
  const ids = listed.body.data.rows.map((row: any) => row.id);
  assert.ok(ids.includes(created.body.data.id));
});

test("mutations reject empty bodies", async () => {
  reset();
  const token = adminToken();
  const response = await call("/notifications", { method: "POST", token, body: {} });
  assert.equal(response.status, 400);
  assert.equal(response.body.code, "BAD_REQUEST");
});

test("unknown paths and unsupported methods are reported clearly", async () => {
  reset();
  const token = adminToken();
  const missing = await call("/not-a-resource", { token });
  assert.equal(missing.status, 404);

  const disallowed = await call("/users", { method: "DELETE", token });
  assert.equal(disallowed.status, 405);
  assert.equal(disallowed.body.code, "METHOD_NOT_ALLOWED");
});

test("CORS preflight returns 204 and allows an explicitly listed origin", async () => {
  const response = await call("/users", {
    method: "OPTIONS",
    headers: { origin: "https://dapp.example" },
    environment: env({ ADMIN_API_ALLOWED_ORIGINS: "https://dapp.example" }),
  });
  assert.equal(response.status, 204);
  assert.equal(response.headers["access-control-allow-origin"], "https://dapp.example");
  assert.equal(response.headers["access-control-allow-credentials"], "true");
});

test("CORS headers are omitted for origins that are not allowed", async () => {
  const response = await call("/health", {
    headers: { origin: "https://evil.example" },
    environment: env({ ADMIN_API_ALLOWED_ORIGINS: "https://dapp.example" }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers["access-control-allow-origin"], undefined);
});

test("overview aggregates the store", async () => {
  reset();
  const response = await call("/overview", { token: adminToken() });
  assert.equal(response.status, 200);
  const data = response.body.data;
  assert.ok(data.users.total > 0);
  assert.ok(data.treasury.total_usdc > 0);
  assert.ok(Array.isArray(data.treasury.alerts));
  assert.ok(typeof data.kyc.pending === "number");
  assert.ok(typeof data.support.open === "number");
});

test("the memory store can be disabled so a missing Supabase config fails loudly", async () => {
  reset();
  const strict = env({ ADMIN_API_ALLOW_MEMORY_STORE: "false" });
  assert.equal(strict.allowMemoryStore, false);

  const response = await call("/users", { token: adminToken(), environment: strict });
  assert.equal(response.status, 503);
  assert.equal(response.body.code, "STORE_DISABLED");
});

test("readAdminApiEnv normalises URLs, lists and flags", () => {
  const parsed = readAdminApiEnv({
    SUPABASE_URL: "https://proj.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: " key ",
    ADMIN_API_ALLOWED_ORIGINS: "https://a.example, https://b.example",
    ADMIN_ALLOWLIST_EMAILS: "Ops@Vantide.io",
    ADMIN_API_REQUIRE_AUTH: "false",
  });
  assert.equal(parsed.supabaseUrl, "https://proj.supabase.co");
  assert.equal(parsed.supabaseServiceKey, "key");
  assert.deepEqual(parsed.allowedOrigins, ["https://a.example", "https://b.example"]);
  assert.deepEqual(parsed.allowlistEmails, ["ops@vantide.io"]);
  assert.equal(parsed.requireAuth, false);
});

test("loadDotEnv parses .env files without overriding real environment variables", async (t) => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { loadDotEnv } = await import("../server/admin/env");

  const dir = await mkdtemp(join(tmpdir(), "vantide-env-"));
  t.after(() => void rm(dir, { recursive: true, force: true }));

  await writeFile(
    join(dir, ".env"),
    [
      "# a comment",
      "",
      "PLAIN=from-dot-env",
      'QUOTED="with spaces"',
      "EXPORTED=export-style",
      "TRAILING=value # trailing comment",
      "ALREADY_SET=from-file",
      "not a valid line",
    ].join("\n")
  );

  const cwd = process.cwd();
  process.env.ALREADY_SET = "from-shell";
  try {
    process.chdir(dir);
    const loaded = loadDotEnv([".env"]);

    assert.deepEqual(loaded.sort(), ["EXPORTED", "PLAIN", "QUOTED", "TRAILING"]);
    assert.equal(process.env.PLAIN, "from-dot-env");
    assert.equal(process.env.QUOTED, "with spaces");
    assert.equal(process.env.EXPORTED, "export-style");
    assert.equal(process.env.TRAILING, "value");
    // A real environment variable always wins over the file.
    assert.equal(process.env.ALREADY_SET, "from-shell");
    assert.equal(process.env.not, undefined);
  } finally {
    process.chdir(cwd);
    for (const key of ["PLAIN", "QUOTED", "EXPORTED", "TRAILING", "ALREADY_SET"]) {
      delete process.env[key];
    }
  }
});

test("loadDotEnv returns nothing when no file exists", async () => {
  const { loadDotEnv } = await import("../server/admin/env");
  assert.deepEqual(loadDotEnv([".definitely-not-here"]), []);
});
