/**
 * Standalone admin API server.
 *
 * Use this when the dapp is hosted somewhere that cannot run server code
 * (GitHub Pages, S3, IPFS, …). Point `VITE_ADMIN_API_URL` at this host and
 * list the dapp origin in `ADMIN_API_ALLOWED_ORIGINS`.
 *
 *   ADMIN_API_ALLOWED_ORIGINS=https://your-dapp.example \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_JWT_SECRET=... \
 *   npx tsx server/standalone.ts
 *
 * Listens on 0.0.0.0 so it works behind container proxies.
 */

import { createServer } from "node:http";
import { loadDotEnv, readAdminApiEnv, publicEnvSummary } from "./admin/env";
import { serveNodeRequest } from "./admin/node";

const dotenvKeys = loadDotEnv();
if (dotenvKeys.length > 0) {
  console.log(`[admin-api] loaded from .env: ${dotenvKeys.join(", ")}`);
}

const env = readAdminApiEnv();
const base = (process.env.ADMIN_API_BASE ?? "/api/admin").replace(/\/+$/, "");
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

const server = createServer((req, res) => {
  const url = req.url ?? "/";
  const pathname = url.split("?")[0] ?? "/";

  if (pathname !== base && !pathname.startsWith(`${base}/`)) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ success: false, code: "NOT_FOUND", message: `Nothing is served at ${pathname}.` }));
    return;
  }

  serveNodeRequest(req, res, url, { env, base }).catch((error) => {
    console.error("[admin-api] server error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ success: false, code: "INTERNAL_ERROR", message: "Unexpected server error." }));
    } else {
      res.end();
    }
  });
});

server.listen(port, host, () => {
  console.log(`[admin-api] listening on http://${host}:${port}${base}`);
  console.log(`[admin-api] ${JSON.stringify(publicEnvSummary(env))}`);
  if (!env.supabaseUrl) {
    console.log("[admin-api] SUPABASE_URL is not set — serving the bundled memory store.");
  }
  if (!env.supabaseJwtSecret && env.requireAuth) {
    console.log("[admin-api] SUPABASE_JWT_SECRET is not set — Supabase sign-ins will be rejected.");
  }
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
