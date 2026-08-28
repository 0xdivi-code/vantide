/**
 * Authentication for the admin API.
 *
 * Accepted credentials, in order:
 *   1. `x-admin-api-key` — machine-to-machine (cron, CLI, monitoring).
 *   2. `Authorization: Bearer <Supabase access token>` — the token the admin
 *      panel receives from Supabase email/password sign-in. Verified with
 *      HS256 against `SUPABASE_JWT_SECRET`, then checked against the
 *      `admin_operators` table (or `ADMIN_ALLOWLIST_EMAILS`).
 *
 * No secret is ever sent to the browser; the panel only ever holds the
 * short-lived user access token that Supabase already gave it.
 */

import type { AdminApiEnv } from "./env";
import { supabaseEnabled } from "./env";
import { JwtError, verifyHs256 } from "./jwt";
import { selectRows } from "./supabase";
import { forbidden, unauthorized, type AdminCaller } from "./types";

const ADMIN_METADATA_ROLES = new Set(["admin", "operator", "owner", "superadmin"]);

function bearerToken(headers: Record<string, string>): string | undefined {
  const header = headers.authorization ?? headers.Authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token.trim();
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function isAdminMetadata(metadata: Record<string, unknown> | undefined): boolean {
  if (!metadata) return false;
  if (metadata.admin === true) return true;
  const role = metadata.role ?? metadata.admin_role;
  return typeof role === "string" && ADMIN_METADATA_ROLES.has(role.toLowerCase());
}

async function isOperatorByEmail(env: AdminApiEnv, email: string): Promise<boolean> {
  if (!supabaseEnabled(env)) return false;
  try {
    const { rows } = await selectRows(env, "admin_operators", {
      select: "id,email,is_active",
      filters: { email: email.toLowerCase() },
      limit: 1,
    });
    return rows.some((row) => row.is_active !== false);
  } catch (error) {
    console.warn("[admin-api] operator lookup failed:", error);
    return false;
  }
}

export async function authenticate(
  headers: Record<string, string>,
  env: AdminApiEnv
): Promise<AdminCaller> {
  const apiKey = headers["x-admin-api-key"];
  if (apiKey && env.adminApiKey && constantTimeEquals(apiKey, env.adminApiKey)) {
    return { id: "service", email: "service@local", role: "service", via: "service" };
  }

  const token = bearerToken(headers);
  if (!token) {
    if (!env.requireAuth) {
      return { id: "dev", email: "dev@localhost", role: "admin", via: "service" };
    }
    throw unauthorized("Missing credentials. Sign in to the admin panel, then retry.");
  }

  if (!env.supabaseJwtSecret) {
    throw unauthorized(
      "The server cannot verify Supabase tokens because SUPABASE_JWT_SECRET is not set."
    );
  }

  let claims;
  try {
    claims = verifyHs256(token, env.supabaseJwtSecret);
  } catch (error) {
    const message = error instanceof JwtError ? error.message : "The session token is invalid.";
    throw unauthorized(message);
  }

  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const id = typeof claims.sub === "string" ? claims.sub : email || "unknown";
  if (!email) throw unauthorized("The Supabase token has no email claim.");

  const granted =
    isAdminMetadata(claims.app_metadata) ||
    env.allowlistEmails.includes(email) ||
    (await isOperatorByEmail(env, email));

  if (!granted) {
    throw forbidden(
      `${email} is signed in but is not an operator. Add the account to admin_operators, set app_metadata.role = "admin" in Supabase, or list it in ADMIN_ALLOWLIST_EMAILS.`
    );
  }

  const role =
    typeof claims.app_metadata?.role === "string"
      ? claims.app_metadata.role
      : env.allowlistEmails.includes(email)
        ? "admin"
        : "operator";

  return { id, email, role, via: "jwt" };
}
