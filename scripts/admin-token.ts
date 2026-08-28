/**
 * Mint an admin API token for curl / CI without signing in through the UI.
 *
 *   yarn api:token ops@vantide.io
 *
 * Reads SUPABASE_JWT_SECRET from the real environment or from
 * `.env.local` / `.env`, the same way the API server does.
 *
 * The printed token is a normal Supabase-shaped HS256 JWT, so it is accepted
 * by `/api/admin/*` exactly like a browser session. Useful for smoke tests:
 *
 *   curl -H "Authorization: Bearer $TOKEN" http://localhost:8787/api/admin/users
 */

import { signHs256 } from "../server/admin/jwt";
import { loadDotEnv } from "../server/admin/env";

loadDotEnv();

const email = process.argv[2];
const secret = process.env.SUPABASE_JWT_SECRET;
const ttl = Number(process.env.ADMIN_TOKEN_TTL_SEC ?? "3600");

if (!secret) {
  console.error("SUPABASE_JWT_SECRET must be set (Supabase → Project Settings → API → JWT Secret).");
  process.exit(1);
}
if (!email) {
  console.error("Usage: yarn api:token <email>");
  process.exit(1);
}

const token = signHs256(
  {
    sub: `local-${email.replace(/[^a-z0-9]+/gi, "-")}`,
    email,
    role: "authenticated",
    app_metadata: { role: "admin", provider: "email" },
    user_metadata: {},
  },
  secret,
  { expiresInSec: ttl }
);

console.log(token);
