/** MongoDB-backed email/password auth using random opaque sessions (no JWT keys). */
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { AdminApiEnv } from "./env";
import { ensureMongoIndexes, mongoCollection, mongoEnabled } from "./mongodb";
import { forbidden, unauthorized, type AdminCaller } from "./types";

const scrypt = promisify(scryptCallback);
const DUMMY_PASSWORD_HASH = "scrypt:00000000000000000000000000000000:8b1c769e37d3ca9b2b5d6bad52361de586b1abb687acda8fa5bfca36e7266cb7305e94d424081ddd1665f5f649eda29e1516dc83ff1f161a5368a973d20c2e96";
interface Operator { id: string; email: string; passwordHash: string; role: string; isActive: boolean; }
interface Session { tokenHash: string; operatorId: string; email: string; role: string; expiresAt: Date; }

function bearer(headers: Record<string, string>): string | undefined {
  const value = headers.authorization ?? headers.Authorization;
  return value?.toLowerCase().startsWith("bearer ") ? value.slice(7).trim() : undefined;
}
function equal(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const result = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt.toString("hex")}:${result.toString("hex")}`;
}
async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encoded.split(":");
  if (algorithm !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function bootstrap(env: AdminApiEnv): Promise<void> {
  await ensureMongoIndexes(env);
  if (!env.adminBootstrapEmail || !env.adminBootstrapPassword) return;
  const operators = await mongoCollection<Operator>(env, "admin_operators");
  if (await operators.findOne({ email: env.adminBootstrapEmail })) return;
  await operators.insertOne({
    id: `op_${randomBytes(10).toString("hex")}`,
    email: env.adminBootstrapEmail,
    passwordHash: await hashPassword(env.adminBootstrapPassword),
    role: "admin",
    isActive: true,
  });
}

export async function login(env: AdminApiEnv, email: string, password: string) {
  if (!mongoEnabled(env)) throw unauthorized("MongoDB auth is not configured on the server.");
  await bootstrap(env);
  const normalized = email.trim().toLowerCase();
  const operator = await (await mongoCollection<Operator>(env, "admin_operators")).findOne({ email: normalized });
  // Always perform scrypt work to reduce user-enumeration timing differences.
  const valid = operator ? await verifyPassword(password, operator.passwordHash) : await verifyPassword(password, DUMMY_PASSWORD_HASH);
  if (!operator || !valid) throw unauthorized("That email and password combination was not accepted.");
  if (!operator.isActive) throw forbidden("This operator account is disabled.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 3_600_000);
  await (await mongoCollection<Session>(env, "admin_sessions")).insertOne({
    tokenHash: tokenHash(token), operatorId: operator.id, email: operator.email, role: operator.role, expiresAt,
  });
  return { access_token: token, expires_at: expiresAt.getTime(), user: { id: operator.id, email: operator.email, role: operator.role } };
}

export async function logout(env: AdminApiEnv, token: string | undefined): Promise<void> {
  if (token && mongoEnabled(env)) await (await mongoCollection<Session>(env, "admin_sessions")).deleteOne({ tokenHash: tokenHash(token) });
}
export async function refresh(env: AdminApiEnv, token: string) {
  const caller = await sessionCaller(env, token);
  await logout(env, token);
  const next = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.sessionTtlHours * 3_600_000);
  await (await mongoCollection<Session>(env, "admin_sessions")).insertOne({ tokenHash: tokenHash(next), operatorId: caller.id, email: caller.email, role: caller.role, expiresAt });
  return { access_token: next, expires_at: expiresAt.getTime(), user: { id: caller.id, email: caller.email, role: caller.role } };
}
async function sessionCaller(env: AdminApiEnv, token: string): Promise<AdminCaller> {
  if (!mongoEnabled(env)) throw unauthorized("MongoDB is not configured on the server.");
  const session = await (await mongoCollection<Session>(env, "admin_sessions")).findOne({ tokenHash: tokenHash(token), expiresAt: { $gt: new Date() } });
  if (!session) throw unauthorized("Your session is invalid or expired. Sign in again.");
  return { id: session.operatorId, email: session.email, role: session.role, via: "session" };
}
export async function authenticate(headers: Record<string, string>, env: AdminApiEnv): Promise<AdminCaller> {
  const apiKey = headers["x-admin-api-key"];
  if (apiKey && env.adminApiKey && equal(apiKey, env.adminApiKey)) return { id: "service", email: "service@local", role: "service", via: "service" };
  const token = bearer(headers);
  if (!token) {
    if (!env.requireAuth) return { id: "dev", email: "dev@localhost", role: "admin", via: "service" };
    throw unauthorized("Missing credentials. Sign in to the admin panel, then retry.");
  }
  return sessionCaller(env, token);
}
export function bearerToken(headers: Record<string, string>): string | undefined { return bearer(headers); }
