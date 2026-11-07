/**
 * Admin override store.
 *
 * Configuration precedence is: local browser preview, server-published safe
 * overrides, `window.__RUNTIME_CONFIG__` (public/config.js), then build-time
 * env vars. Server values are supplied by runtime-config.ts after its public
 * API request; this module only holds the sanitized in-memory map.
 *
 * Local previews never leave the browser. Shared values are persisted by the
 * admin API, and the merged configuration can also be exported as config.js
 * for a static deployment.
 *
 * IMPORTANT: this module must not import runtime-config.ts (that module
 * imports this one). Keep it dependency-free.
 */

const OVERRIDES_KEY = "vantide-admin-overrides";
const HISTORY_KEY = "vantide-admin-history";
const MAX_HISTORY_ENTRIES = 50;

export const ADMIN_CONFIG_EVENT = "vantide:admin-config-changed";

export type AdminOverrides = Record<string, string>;

export interface AdminHistoryEntry {
  ts: number;
  action: "set" | "remove" | "clear" | "import";
  key?: string;
  value?: string;
  previous?: string;
}

/* ------------------------------------------------------------------ */
/* React-free observable store                                        */
/* ------------------------------------------------------------------ */

let version = 0;
const listeners = new Set<() => void>();

export function subscribeAdminStore(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getAdminStoreVersion(): number {
  return version;
}

function emitChange(): void {
  version += 1;
  listeners.forEach((callback) => {
    try {
      callback();
    } catch (e) {
      console.error("[admin] listener error", e);
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ADMIN_CONFIG_EVENT));
  }
}

let sharedOverrides: AdminOverrides = {};

export function getSharedAdminOverrides(): AdminOverrides {
  return { ...sharedOverrides };
}

/** Called only with the public API's allowlisted, string-only response. */
export function setSharedAdminOverrides(values: AdminOverrides): void {
  sharedOverrides = { ...values };
  emitChange();
}

/* ------------------------------------------------------------------ */
/* Persistence helpers                                                */
/* ------------------------------------------------------------------ */

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (e) {
    console.warn(`[admin] failed to parse ${key}:`, e);
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`[admin] failed to persist ${key}:`, e);
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Overrides                                                          */
/* ------------------------------------------------------------------ */

export function getAdminOverrides(): AdminOverrides {
  return readJSON<AdminOverrides>(OVERRIDES_KEY, {});
}

/**
 * Returns the overridden value for a key, or `undefined` when the key is
 * not overridden. An explicitly stored empty string is meaningful: it
 * force-clears a value that is otherwise set in config.js / env.
 */
export function getAdminOverrideValue(key: string): string | undefined {
  const overrides = getAdminOverrides();
  return Object.prototype.hasOwnProperty.call(overrides, key)
    ? overrides[key]
    : undefined;
}

export type SetOverrideResult = { ok: true } | { ok: false; error: string };

export function setAdminOverride(key: string, value: string): SetOverrideResult {
  if (!key || !key.trim()) {
    return { ok: false, error: "Config key must not be empty" };
  }
  const overrides = getAdminOverrides();
  const previous = overrides[key];
  overrides[key] = value;

  if (!writeJSON(OVERRIDES_KEY, overrides)) {
    return {
      ok: false,
      error:
        "Could not save to localStorage (quota exceeded?). Try a smaller value or export config.js instead.",
    };
  }

  logHistory({ action: "set", key, value, previous });
  emitChange();
  return { ok: true };
}

export function removeAdminOverride(key: string): void {
  const overrides = getAdminOverrides();
  if (!Object.prototype.hasOwnProperty.call(overrides, key)) return;
  const previous = overrides[key];
  delete overrides[key];
  writeJSON(OVERRIDES_KEY, overrides);
  logHistory({ action: "remove", key, previous });
  emitChange();
}

export function removeAdminOverrides(keys: string[]): void {
  const overrides = getAdminOverrides();
  let removed = 0;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      delete overrides[key];
      removed += 1;
    }
  }
  if (removed === 0) return;
  writeJSON(OVERRIDES_KEY, overrides);
  logHistory({ action: "remove", value: `${removed} published keys cleared from local preview` });
  emitChange();
}

export function clearAdminOverrides(): void {
  writeJSON(OVERRIDES_KEY, {});
  logHistory({ action: "clear" });
  emitChange();
}

export function importAdminOverrides(
  map: Record<string, string>,
  mode: "merge" | "replace" = "merge"
): SetOverrideResult {
  const next: AdminOverrides = mode === "replace" ? {} : getAdminOverrides();
  Object.entries(map).forEach(([key, value]) => {
    if (typeof value === "string") next[key] = value;
  });

  if (!writeJSON(OVERRIDES_KEY, next)) {
    return { ok: false, error: "Could not save imported config to localStorage." };
  }

  logHistory({ action: "import", value: `${Object.keys(map).length} keys (${mode})` });
  emitChange();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* History                                                            */
/* ------------------------------------------------------------------ */

export function getAdminHistory(): AdminHistoryEntry[] {
  return readJSON<AdminHistoryEntry[]>(HISTORY_KEY, []);
}

function logHistory(entry: Omit<AdminHistoryEntry, "ts">): void {
  const history = getAdminHistory();
  history.unshift({ ...entry, ts: Date.now() });
  writeJSON(HISTORY_KEY, history.slice(0, MAX_HISTORY_ENTRIES));
}

export function clearAdminHistory(): void {
  writeJSON(HISTORY_KEY, []);
  emitChange();
}

/* ------------------------------------------------------------------ */
/* Export                                                             */
/* ------------------------------------------------------------------ */

/**
 * Builds the contents of a `public/config.js` file that merges the runtime
 * config the site was served with (window.__RUNTIME_CONFIG__) and every
 * admin override. Deploying that file makes the admin changes permanent
 * for all visitors.
 */
export function generateConfigJs(): string {
  const merged: Record<string, string> = {};
  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__) {
    Object.assign(merged, window.__RUNTIME_CONFIG__);
  }
  Object.assign(merged, sharedOverrides);
  Object.assign(merged, getAdminOverrides());

  const body = Object.entries(merged)
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");

  return `window.__RUNTIME_CONFIG__ = {\n${body}\n};\n`;
}

/**
 * Approximate number of bytes the admin panel currently stores in
 * localStorage (overrides + history + analytics events handled elsewhere).
 */
export function getAdminStorageUsage(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("vantide-")) {
        total += (window.localStorage.getItem(key) || "").length + key.length;
      }
    }
  } catch {
    /* ignore */
  }
  return total * 2; // JS strings are UTF-16
}
