/**
 * Vercel / Node serverless entrypoint.
 *
 * Vercel maps `api/admin/[...path].ts` to `/api/admin/*`, which is exactly
 * the same-origin base the admin panel expects
 * (`VITE_ADMIN_API_URL: "/api/admin"` in public/config.js).
 *
 * Deploy notes:
 *   - Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_JWT_SECRET as
 *     *server* environment variables in the Vercel project settings.
 *   - Add ADMIN_API_ALLOWED_ORIGINS if the dapp is served from a different
 *     origin than this API.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readAdminApiEnv } from "../../server/admin/env";
import { serveNodeRequest } from "../../server/admin/node";

export const config = {
  runtime: "nodejs20.x",
};

const env = readAdminApiEnv();

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await serveNodeRequest(req, res, req.url ?? "/api/admin", { env, base: "/api/admin" });
}
