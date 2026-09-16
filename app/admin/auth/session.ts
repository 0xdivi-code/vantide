/** Admin email/password auth backed by opaque MongoDB sessions. */
import { getRuntimeConfig } from "@/utils/runtime-config";

export const ADMIN_SESSION_KEY = "vantide-admin-session";
export const ADMIN_AUTH_EVENT = "vantide:admin-auth-changed";
export const ADMIN_UNAUTHORIZED_EVENT = "vantide:admin-unauthorized";
export interface AdminUser { id: string; email: string; role?: string; }
export interface AdminSession { access_token: string; expires_at: number; user: AdminUser; }
export class AdminAuthError extends Error {
  readonly code: string; readonly status?: number;
  constructor(code: string, message: string, status?: number) { super(message); this.name = "AdminAuthError"; this.code = code; this.status = status; }
}
let currentSession: AdminSession | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const base = () => (getRuntimeConfig("VITE_ADMIN_API_URL")?.trim() || "/api/admin").replace(/\/+$/, "");
export function isAdminAuthConfigured(): boolean { return Boolean(getRuntimeConfig("VITE_ADMIN_API_URL")?.trim()); }
export function notifyUnauthorized(): void { window.dispatchEvent(new CustomEvent(ADMIN_UNAUTHORIZED_EVENT)); }
export function subscribeAdminAuth(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function emit() { listeners.forEach((listener) => listener()); window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EVENT)); }
function setSession(value: AdminSession | null) {
  currentSession = value; loaded = true;
  try { value ? localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(value)) : localStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* unavailable */ }
  emit();
}
function load(): AdminSession | null {
  if (loaded) return currentSession;
  loaded = true;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AdminSession;
      if (parsed.access_token && parsed.user?.email && parsed.expires_at) currentSession = parsed;
    }
  } catch { currentSession = null; }
  return currentSession;
}
export function getAdminSession() { return load(); }
export function getAdminAccessToken() { return load()?.access_token; }
export function isSessionExpired(session: AdminSession | null) { return !session || session.expires_at - 60_000 <= Date.now(); }
async function request(path: string, init: RequestInit): Promise<AdminSession | null> {
  const response = await fetch(`${base()}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) }, credentials: "include" });
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => undefined) as { data?: AdminSession; message?: string; code?: string } | undefined;
  if (!response.ok || !payload?.data) throw new AdminAuthError(payload?.code ?? "AUTH_FAILED", payload?.message ?? "Authentication failed.", response.status);
  return payload.data;
}
export async function signInWithPassword(email: string, password: string): Promise<AdminSession> {
  const session = await request("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
  if (!session) throw new AdminAuthError("BAD_RESPONSE", "The server returned no session.");
  setSession(session); return session;
}
let refreshing: Promise<AdminSession | null> | null = null;
export function refreshSession(): Promise<AdminSession | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const token = load()?.access_token; if (!token) return null;
    try { const session = await request("/auth/refresh", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); setSession(session); return session; }
    catch { setSession(null); return null; }
  })().finally(() => { refreshing = null; });
  return refreshing;
}
export async function signOut() {
  const token = load()?.access_token;
  try { if (token) await request("/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }); } catch { /* local logout still succeeds */ }
  setSession(null);
}
export async function handleUnauthorized() { return Boolean(await refreshSession()); }
export function clearLocalSession() { setSession(null); }
