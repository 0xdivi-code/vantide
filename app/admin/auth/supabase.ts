/**
 * Supabase email/password authentication for the admin panel.
 *
 * Talks directly to Supabase GoTrue (`{SUPABASE_URL}/auth/v1/*`) with the
 * project's anon key, so no extra dependency is added to the bundle. The
 * access token it returns is the same HS256 JWT the admin API verifies on
 * the server (`server/admin/auth.ts`) — one identity for the UI and the API.
 *
 * Only the anon key ever reaches the browser. The service_role key and the
 * JWT secret stay on the server.
 */

import { getRuntimeConfig } from "@/utils/runtime-config";

export const SUPABASE_URL_KEY = "VITE_SUPABASE_URL";
export const SUPABASE_ANON_KEY = "VITE_SUPABASE_ANON_KEY";
export const ADMIN_SESSION_KEY = "vantide-admin-session";
export const ADMIN_AUTH_EVENT = "vantide:admin-auth-changed";
/** Fired by the API client when the admin API answers 401. */
export const ADMIN_UNAUTHORIZED_EVENT = "vantide:admin-unauthorized";

export function notifyUnauthorized(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_UNAUTHORIZED_EVENT));
  }
}

/** Refresh this long before the token actually expires. */
const REFRESH_SKEW_MS = 60_000;

export interface AdminUser {
  id: string;
  email: string;
  role?: string;
  appMetadata?: Record<string, unknown>;
}

export interface AdminSession {
  access_token: string;
  refresh_token: string;
  /** Millisecond epoch. */
  expires_at: number;
  user: AdminUser;
}

export class SupabaseAuthError extends Error {
  readonly code: string;
  readonly status?: number;
  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = "SupabaseAuthError";
    this.code = code;
    this.status = status;
  }
}

export interface SupabaseAuthConfig {
  url: string;
  anonKey: string;
}

export function getSupabaseAuthConfig(): SupabaseAuthConfig | undefined {
  const url = getRuntimeConfig(SUPABASE_URL_KEY)?.trim().replace(/\/+$/, "");
  const anonKey = getRuntimeConfig(SUPABASE_ANON_KEY)?.trim();
  if (!url || !anonKey) return undefined;
  if (!/^https?:\/\//i.test(url)) return undefined;
  return { url, anonKey };
}

export function isSupabaseAuthConfigured(): boolean {
  return getSupabaseAuthConfig() !== undefined;
}

/* ------------------------------------------------------------------ */
/* Session store                                                      */
/* ------------------------------------------------------------------ */

let currentSession: AdminSession | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("[admin-auth] listener error", error);
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_AUTH_EVENT));
  }
}

export function subscribeAdminAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function normalizeSession(raw: unknown): AdminSession | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const accessToken = value.access_token ?? value.accessToken;
  const refreshToken = value.refresh_token ?? value.refreshToken;
  if (typeof accessToken !== "string" || !accessToken) return null;

  const user = (value.user ?? {}) as Record<string, unknown>;
  const metadata = (user.app_metadata ?? {}) as Record<string, unknown>;
  const email = typeof user.email === "string" ? user.email : "";
  const id = typeof user.id === "string" ? user.id : email || "unknown";

  const expiresIn = typeof value.expires_in === "number" ? value.expires_in : 3600;
  const expiresAt =
    typeof value.expires_at === "number"
      ? // GoTrue returns expires_at in seconds.
        value.expires_at * 1000
      : Date.now() + expiresIn * 1000;

  return {
    access_token: accessToken,
    refresh_token: typeof refreshToken === "string" ? refreshToken : "",
    expires_at: expiresAt,
    user: {
      id,
      email,
      role: typeof metadata.role === "string" ? metadata.role : undefined,
      appMetadata: metadata,
    },
  };
}

function readStoredSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    return normalizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredSession(session: AdminSession | null): void {
  if (typeof window === "undefined") return;
  try {
    if (session) window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch (error) {
    console.warn("[admin-auth] could not persist the session:", error);
  }
}

function setSession(session: AdminSession | null): void {
  currentSession = session;
  loaded = true;
  writeStoredSession(session);
  emit();
}

function ensureLoaded(): AdminSession | null {
  if (!loaded) {
    currentSession = readStoredSession();
    loaded = true;
  }
  return currentSession;
}

export function getAdminSession(): AdminSession | null {
  return ensureLoaded();
}

export function getAdminUser(): AdminUser | null {
  return ensureLoaded()?.user ?? null;
}

export function isSessionExpired(session: AdminSession | null): boolean {
  if (!session) return true;
  return session.expires_at - REFRESH_SKEW_MS <= Date.now();
}

/**
 * Token for `Authorization: Bearer …`. Kicks off a refresh when the token is
 * about to expire so the next request carries a fresh one.
 */
export function getAdminAccessToken(): string | undefined {
  const session = ensureLoaded();
  if (!session) return undefined;
  if (isSessionExpired(session)) {
    void refreshSession().catch(() => {
      /* handled by the auth context via the 401 path */
    });
  }
  return session.access_token;
}

/* ------------------------------------------------------------------ */
/* GoTrue calls                                                       */
/* ------------------------------------------------------------------ */

interface GoTrueErrorBody {
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
  code?: string;
}

function describe(status: number, body: GoTrueErrorBody | undefined, fallback: string): SupabaseAuthError {
  const raw =
    body?.error_description ?? body?.message ?? body?.msg ?? (typeof body?.error === "string" ? body.error : undefined);

  if (status === 400 || status === 401 || status === 403) {
    const normalized = (raw ?? "").toLowerCase();
    if (normalized.includes("invalid login credentials") || normalized.includes("invalid_grant")) {
      return new SupabaseAuthError("INVALID_CREDENTIALS", "That email and password combination was not accepted.", status);
    }
    if (normalized.includes("email not confirmed")) {
      return new SupabaseAuthError("EMAIL_NOT_CONFIRMED", "Confirm your email address in Supabase before signing in.", status);
    }
    if (normalized.includes("user not found")) {
      return new SupabaseAuthError("USER_NOT_FOUND", "No admin account exists for that email.", status);
    }
  }
  if (status === 429) {
    return new SupabaseAuthError("RATE_LIMITED", "Too many sign-in attempts. Wait a minute and try again.", status);
  }
  return new SupabaseAuthError(
    body?.code ?? body?.error ?? "AUTH_FAILED",
    raw && raw.trim() ? raw : fallback,
    status
  );
}

async function goTrue<T>(
  config: SupabaseAuthConfig,
  path: string,
  init: RequestInit = {}
): Promise<{ status: number; payload: T | undefined }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${config.url}/auth/v1/${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        apikey: config.anonKey,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    let payload: T | undefined;
    if (text) {
      try {
        payload = JSON.parse(text) as T;
      } catch {
        payload = undefined;
      }
    }
    return { status: response.status, payload };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new SupabaseAuthError("TIMEOUT", "Supabase did not respond in time. Check your connection.");
    }
    throw new SupabaseAuthError(
      "NETWORK",
      "Could not reach Supabase. Verify VITE_SUPABASE_URL and that the project allows this origin."
    );
  } finally {
    clearTimeout(timeout);
  }
}

function requireConfig(): SupabaseAuthConfig {
  const config = getSupabaseAuthConfig();
  if (!config) {
    throw new SupabaseAuthError(
      "NOT_CONFIGURED",
      `Set ${SUPABASE_URL_KEY} and ${SUPABASE_ANON_KEY} in public/config.js to enable admin sign-in.`
    );
  }
  return config;
}

export async function signInWithPassword(email: string, password: string): Promise<AdminSession> {
  const config = requireConfig();
  const { status, payload } = await goTrue<Record<string, unknown>>(config, "token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (status !== 200 || !payload) {
    throw describe(status, payload as GoTrueErrorBody | undefined, "Sign-in failed.");
  }
  const session = normalizeSession(payload);
  if (!session) {
    throw new SupabaseAuthError("BAD_RESPONSE", "Supabase returned an unusable session payload.", status);
  }
  setSession(session);
  return session;
}

let refreshPromise: Promise<AdminSession | null> | null = null;

export function refreshSession(): Promise<AdminSession | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const session = ensureLoaded();
    if (!session?.refresh_token) return null;

    let config: SupabaseAuthConfig;
    try {
      config = requireConfig();
    } catch {
      return null;
    }

    const { status, payload } = await goTrue<Record<string, unknown>>(config, "token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });

    if (status !== 200 || !payload) {
      // The refresh token is gone or revoked — force a fresh sign-in.
      setSession(null);
      return null;
    }
    const next = normalizeSession(payload);
    if (!next) {
      setSession(null);
      return null;
    }
    setSession(next);
    return next;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function signOut(): Promise<void> {
  const session = ensureLoaded();
  if (session) {
    try {
      const config = requireConfig();
      await goTrue(config, "logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // Signing out locally is still the right outcome if the call fails.
    }
  }
  setSession(null);
}

/**
 * Called by the API client when a request comes back 401. Tries one refresh;
 * if that fails the session is cleared and the login screen returns.
 */
export async function handleUnauthorized(): Promise<boolean> {
  const refreshed = await refreshSession().catch(() => null);
  if (refreshed) return true;
  setSession(null);
  return false;
}

/** Drop the local session without contacting Supabase (used on config change). */
export function clearLocalSession(): void {
  setSession(null);
}
