import { useCallback, useEffect, useRef, useState } from "react";
import { getRuntimeConfig } from "@/utils/runtime-config";
import { getAdminAccessToken, notifyUnauthorized } from "@/admin/auth/supabase";

export const ADMIN_API_CONFIG_KEY = "VITE_ADMIN_API_URL";

export class AdminApiError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: { status?: number; code?: string; details?: unknown } = {}
  ) {
    super(message);
    this.name = "AdminApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export interface AdminRequestOptions
  extends Omit<RequestInit, "body" | "headers" | "signal"> {
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  updatedAt: number | undefined;
  refetch: () => Promise<void>;
}

export interface QueryOptions {
  /** Do not start a request until this condition is true. */
  enabled?: boolean;
  /** Milliseconds between background refreshes. Omit to fetch once. */
  pollInterval?: number;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function responseMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const record = payload as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.detail;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function parseConfiguredBaseUrl(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;

  // Relative paths are recommended: they keep cookies same-origin and avoid
  // exposing an internal host to the browser.
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    if (raw.includes("?") || raw.includes("#")) return undefined;
    return raw.replace(/\/+$/, "") || "/";
  }

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (url.search || url.hash) return undefined;
    return url.href.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

/**
 * A configured admin API is deliberately optional. Public Orderly market
 * data works without it; private operational data must be served by a
 * same-origin (or CORS-enabled) backend with real authorization.
 */
export function getAdminApiBaseUrl(): string | undefined {
  return parseConfiguredBaseUrl(getRuntimeConfig(ADMIN_API_CONFIG_KEY));
}

export function getAdminApiConfigurationError(): string | undefined {
  const raw = getRuntimeConfig(ADMIN_API_CONFIG_KEY)?.trim();
  if (raw && !parseConfiguredBaseUrl(raw)) {
    return `${ADMIN_API_CONFIG_KEY} must be an https/http URL (without a query string) or a same-origin path starting with /.`;
  }
  return undefined;
}

export function isAdminApiConfigured(): boolean {
  return Boolean(getAdminApiBaseUrl());
}

export function getAdminApiUrl(path = ""): string | undefined {
  const base = getAdminApiBaseUrl();
  if (!base) return undefined;
  if (!path) return base;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function createAbortSignal(
  suppliedSignal: AbortSignal | undefined,
  timeoutMs: number
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = globalThis.setTimeout(abort, timeoutMs);

  if (suppliedSignal) {
    if (suppliedSignal.aborted) abort();
    else suppliedSignal.addEventListener("abort", abort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeout);
      suppliedSignal?.removeEventListener("abort", abort);
    },
  };
}

/**
 * Make an authenticated request to the operator's backend.
 *
 * Authentication is a Supabase access token attached as `Authorization:
 * Bearer …` (see app/admin/auth/supabase.ts). Cookies are still sent for
 * backends that prefer them. Do not put API secrets in a VITE_ variable:
 * all VITE values are shipped to every browser.
 */
export async function adminRequest<T>(
  path: string,
  options: AdminRequestOptions = {}
): Promise<T> {
  const url = getAdminApiUrl(path);
  if (!url) {
    throw new AdminApiError(
      `No admin API is configured. Set ${ADMIN_API_CONFIG_KEY} to enable private data.`,
      { code: "ADMIN_API_NOT_CONFIGURED" }
    );
  }

  const {
    body,
    headers: suppliedHeaders,
    signal: suppliedSignal,
    timeoutMs = 15_000,
    method,
    ...requestInit
  } = options;
  const headers = new Headers(suppliedHeaders);
  let serializedBody: BodyInit | undefined;

  if (body !== undefined && body !== null) {
    if (
      typeof body === "string" ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof Blob
    ) {
      serializedBody = body;
    } else {
      serializedBody = JSON.stringify(body);
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
    }
  }
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const accessToken = getAdminAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const { signal, cleanup } = createAbortSignal(suppliedSignal, timeoutMs);
  try {
    const response = await fetch(url, {
      ...requestInit,
      method: method ?? (serializedBody ? "POST" : "GET"),
      headers,
      body: serializedBody,
      credentials: "include",
      signal,
    });

    const text = await response.text();
    let payload: unknown = undefined;
    if (text) {
      try {
        payload = JSON.parse(text) as unknown;
      } catch {
        payload = text;
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        // Let the auth provider refresh the token (or reopen the login
        // screen) instead of leaving every panel showing a red error.
        notifyUnauthorized();
      }
      throw new AdminApiError(
        responseMessage(payload, `Admin API request failed (${response.status}).`),
        { status: response.status, details: payload }
      );
    }

    if (
      typeof payload === "object" &&
      payload !== null &&
      "success" in payload &&
      (payload as { success?: unknown }).success === false
    ) {
      const record = payload as Record<string, unknown>;
      throw new AdminApiError(responseMessage(payload, "The admin API rejected the request."), {
        status: response.status,
        code: typeof record.code === "string" ? record.code : undefined,
        details: payload,
      });
    }

    // Accept both a conventional { data: ... } envelope and a raw JSON body.
    if (typeof payload === "object" && payload !== null && "data" in payload) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  } catch (error) {
    if (isAbortError(error)) {
      // A component changing route / query is not an API failure. Preserve
      // the abort so the query hook can ignore the stale request.
      if (suppliedSignal?.aborted) throw error;
      throw new AdminApiError("The admin API request timed out. Please try again.", {
        code: "ADMIN_API_TIMEOUT",
      });
    }
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError(
      "Could not reach the admin API. Check the URL, CORS policy, and your session.",
      { details: error }
    );
  } finally {
    cleanup();
  }
}

export function buildQueryString(
  params: Record<string, string | number | boolean | undefined | null>
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function getAdminResource<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
  signal?: AbortSignal
): Promise<T> {
  return adminRequest<T>(`${resource.replace(/^\/+/, "")}${buildQueryString(params)}`, {
    signal,
  });
}

/**
 * Small dependency-free query hook used by the admin screens. It cancels
 * stale requests, keeps the last successful response during a refresh, and
 * never silently replaces live data with sample data on failures.
 */
export function useAsyncQuery<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  options: QueryOptions = {}
): QueryState<T> {
  const { enabled = true, pollInterval } = options;
  const loadRef = useRef(load);
  const dataRef = useRef<T | undefined>(undefined);
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    abortRef.current?.abort();
    const id = ++requestId.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const hasData = dataRef.current !== undefined;
    setError(undefined);
    setIsLoading(!hasData);
    setIsRefreshing(hasData);

    try {
      const next = await loadRef.current(controller.signal);
      if (id !== requestId.current) return;
      dataRef.current = next;
      setData(next);
      setUpdatedAt(Date.now());
      setError(undefined);
    } catch (nextError) {
      if (id !== requestId.current || isAbortError(nextError)) return;
      setError(nextError instanceof Error ? nextError : new Error("Unable to load data."));
    } finally {
      if (id === requestId.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [enabled]);

  useEffect(() => {
    // Invalidate a request from the previous key / endpoint and do not show
    // values from one resource while another resource is loading.
    requestId.current += 1;
    abortRef.current?.abort();
    if (!enabled) {
      dataRef.current = undefined;
      setData(undefined);
      setError(undefined);
      setIsLoading(false);
      setIsRefreshing(false);
      setUpdatedAt(undefined);
      return undefined;
    }

    dataRef.current = undefined;
    setData(undefined);
    setError(undefined);
    setIsLoading(true);
    setIsRefreshing(false);
    setUpdatedAt(undefined);
    void refetch();
    if (!pollInterval || pollInterval < 1_000) {
      return () => abortRef.current?.abort();
    }
    const timer = globalThis.setInterval(() => void refetch(), pollInterval);
    return () => {
      globalThis.clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [enabled, key, pollInterval, refetch]);

  return { data, error, isLoading, isRefreshing, updatedAt, refetch };
}

export function useAdminResource<T>(
  resource: string,
  params: Record<string, string | number | boolean | undefined | null> = {},
  options: QueryOptions = {}
): QueryState<T> {
  const baseUrl = getAdminApiBaseUrl();
  const parameterKey = buildQueryString(params);
  const load = useCallback(
    (signal: AbortSignal) => getAdminResource<T>(resource, params, signal),
    // parameterKey covers object literals passed by callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resource, parameterKey]
  );

  return useAsyncQuery(`admin:${baseUrl ?? "disabled"}:${resource}:${parameterKey}`, load, {
    ...options,
    enabled: Boolean(baseUrl) && (options.enabled ?? true),
  });
}
