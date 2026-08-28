/**
 * Framework-agnostic contracts for the Vantide admin API.
 *
 * The same `handleAdminRequest()` implementation is mounted by three
 * adapters, so behaviour is identical everywhere:
 *   - `api/admin/[...path].ts`  → Vercel / Node serverless functions
 *   - `vite-plugins/admin-api.ts` → `vite dev` / `vite preview` middleware
 *   - `server/standalone.ts`    → plain `node:http` server for any host
 */

export interface AdminRequest {
  /** Uppercase HTTP method. */
  method: string;
  /** Path relative to the API base, always starting with "/". */
  path: string;
  query: Record<string, string>;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  /** Parsed JSON body, or the raw string when the payload was not JSON. */
  body: unknown;
}

export interface AdminResponse {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
}

export interface AdminCaller {
  id: string;
  email: string;
  role: string;
  /** "jwt" when a Supabase access token was verified, "service" for the API key. */
  via: "jwt" | "service";
}

export interface AdminContext {
  caller: AdminCaller;
  /** "supabase" when rows come from Postgres, "memory" for the bundled store. */
  dataMode: DataMode;
}

export type DataMode = "supabase" | "memory";

export type AdminHandler = (
  request: AdminRequest,
  context: AdminContext
) => Promise<AdminResponse> | AdminResponse;

export class AdminHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = "AdminHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AdminHttpError {
  return new AdminHttpError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Sign in to the admin panel to continue."): AdminHttpError {
  return new AdminHttpError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Your account is not allowed to use the admin API."): AdminHttpError {
  return new AdminHttpError(403, "FORBIDDEN", message);
}

export function notFound(message = "Not found."): AdminHttpError {
  return new AdminHttpError(404, "NOT_FOUND", message);
}

export function methodNotAllowed(method: string): AdminHttpError {
  return new AdminHttpError(405, "METHOD_NOT_ALLOWED", `${method} is not supported on this endpoint.`);
}
