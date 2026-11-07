// Runtime configuration utility
// This allows reading config from window.__RUNTIME_CONFIG__ with fallbacks to import.meta.env

import {
  getAdminOverrideValue,
  getSharedAdminOverrides,
  setSharedAdminOverrides,
} from "../admin/adminStore";
import { sanitizeSharedRuntimeConfig } from "../../shared/runtime-config";

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Record<string, string>;
  }
}

/**
 * Get a configuration value. Resolution order:
 *   1. Admin panel local previews (localStorage, this browser only)
 *   2. Server-published safe overrides (all visitors)
 *   3. window.__RUNTIME_CONFIG__ (public/config.js)
 *   4. build-time environment variables (import.meta.env)
 *
 * An admin override of "" explicitly force-clears a value from a lower
 * priority source.
 */
export function getRuntimeConfig(key: string): string | undefined {
  const adminValue = getAdminOverrideValue(key);
  if (adminValue !== undefined) {
    return adminValue === "" ? undefined : adminValue;
  }

  const sharedValue = getSharedAdminOverrides()[key];
  if (sharedValue !== undefined && sharedValue !== "") {
    return sharedValue;
  }

  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__) {
    const value = window.__RUNTIME_CONFIG__[key];
    if (value !== undefined && value !== "") {
      return value;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envValue = (import.meta.env as any)?.[key];

  if (key === "VITE_ORDERLY_BROKER_ID" && (!envValue || envValue === "")) {
    return "demo";
  }

  return envValue;
}

export function applySharedRuntimeConfig(value: unknown): void {
  const sanitized = sanitizeSharedRuntimeConfig(value);
  const values: Record<string, string> = {};
  Object.entries(sanitized).forEach(([key, item]) => {
    if (typeof item === "string") values[key] = item;
  });
  setSharedAdminOverrides(values);
}

function sharedRuntimeConfigEndpoint(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = getRuntimeConfig("VITE_ADMIN_API_URL")?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.search = "";
    url.hash = "";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/runtime-config`;
    return raw.startsWith("/") && !raw.startsWith("//")
      ? `${url.pathname}${url.search}`
      : url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Load public, allowlisted frontend overrides before the first React render.
 * Failure is intentionally non-fatal: static hosting and config.js remain a
 * complete fallback. No credentials are sent on this public request.
 */
export async function loadSharedRuntimeConfig(timeoutMs = 3_000): Promise<boolean> {
  const endpoint = sharedRuntimeConfigEndpoint();
  if (!endpoint || typeof fetch !== "function") return false;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as {
      success?: boolean;
      data?: { values?: unknown };
    };
    if (payload.success === false) return false;
    applySharedRuntimeConfig(payload.data?.values);
    return true;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/**
 * Get a boolean config value with proper parsing
 */
export function getRuntimeConfigBoolean(key: string): boolean {
  const value = getRuntimeConfig(key);
  return value === "true";
}

/**
 * Get a numeric config value with proper parsing
 */
export function getRuntimeConfigNumber(
  key: string,
  defaultValue: number = 0
): number {
  const value = getRuntimeConfig(key);
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get an array config value (comma-separated)
 */
export function getRuntimeConfigArray(key: string): string[] {
  const value = getRuntimeConfig(key);
  if (!value) return [];

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Get parsed JSON config (for complex configurations)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRuntimeConfigJSON<T = any>(key: string): T | undefined {
  const value = getRuntimeConfig(key);
  if (!value) return undefined;

  try {
    return JSON.parse(value);
  } catch (e) {
    console.warn(`Error parsing JSON config for ${key}:`, e);
    return undefined;
  }
}
