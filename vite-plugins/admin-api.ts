/**
 * Vite plugin that mounts the admin API inside `vite dev` and `vite preview`.
 *
 * This is what makes `VITE_ADMIN_API_URL: "/api/admin"` work locally without
 * running a second process: the same router that ships to Vercel is served
 * same-origin by the dev server, so paths and CORS behave exactly like
 * production.
 *
 * Server-side variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * SUPABASE_JWT_SECRET, …) are read from `.env` / `.env.local` with Vite's own
 * `loadEnv`, because Vite only exposes `VITE_*` variables to the browser and
 * never writes `.env` files into `process.env`. Real environment variables
 * still win, so a shell export overrides the file.
 */

import type { Plugin } from "vite";
import { loadEnv } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { serveNodeRequest } from "../server/admin/node";
import { readAdminApiEnv, type AdminApiEnv } from "../server/admin/env";

export interface AdminApiPluginOptions {
  /** URL prefix the API is served under. Must match VITE_ADMIN_API_URL. */
  base?: string;
  enabled?: boolean;
}

/** `.env` files + real environment variables, shell winning. */
function resolveEnv(mode: string, root: string): AdminApiEnv {
  const fromFiles = loadEnv(mode, root, "");
  return readAdminApiEnv({ ...fromFiles, ...process.env });
}

export function adminApiPlugin(options: AdminApiPluginOptions = {}): Plugin {
  const base = (options.base ?? "/api/admin").replace(/\/+$/, "");
  const enabled = options.enabled ?? process.env.ADMIN_API_DISABLED !== "true";
  let env: AdminApiEnv = readAdminApiEnv();

  const middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0] ?? "/";
    if (!enabled || (pathname !== base && !pathname.startsWith(`${base}/`))) {
      next();
      return;
    }
    serveNodeRequest(req, res, url, { env, base }).catch((error) => {
      console.error("[admin-api] middleware error:", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ success: false, code: "INTERNAL_ERROR", message: "Admin API middleware error." }));
      } else {
        res.end();
      }
    });
  };

  const logStatus = (logger: { info: (msg: string) => void }) => {
    logger.info(
      `  ➜  admin API  ${base} (${env.supabaseUrl ? "supabase" : "memory store"}, ` +
        `jwt ${env.supabaseJwtSecret ? "on" : "off"})`
    );
  };

  return {
    name: "vantide-admin-api",
    configureServer(server) {
      env = resolveEnv(server.config.mode, server.config.root);
      server.middlewares.use(middleware);
      logStatus(server.config.logger);
    },
    configurePreviewServer(server) {
      env = resolveEnv(server.config.mode, server.config.root);
      server.middlewares.use(middleware);
      logStatus(server.config.logger);
    },
  };
}

export default adminApiPlugin;
