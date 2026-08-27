import { useCallback } from "react";
import { getRuntimeConfig, getRuntimeConfigArray } from "@/utils/runtime-config";
import {
  AdminApiError,
  QueryOptions,
  QueryState,
  useAsyncQuery,
} from "./client";
import { firstFiniteNumber, isRecord, toNumber } from "../data/format";

const MAINNET_API = "https://api.orderly.org";
const TESTNET_API = "https://testnet-api.orderly.org";
const DEFAULT_MARKET_REFRESH_MS = 15_000;

interface PublicEnvelope<T> {
  success?: boolean;
  code?: string;
  message?: string;
  data?: T;
  ts?: number;
  timestamp?: number;
}

interface RawMarket extends Record<string, unknown> {
  symbol?: string;
  display_symbol_name?: string;
  status?: string;
  mark_price?: string | number;
  index_price?: string | number;
  open_interest?: string | number;
  max_leverage?: string | number;
  min_notional?: string | number;
  est_funding_rate?: string | number | null;
  last_funding_rate?: string | number | null;
  next_funding_time?: number | string | null;
  "24h_open"?: string | number;
  "24h_close"?: string | number;
  "24h_high"?: string | number;
  "24h_low"?: string | number;
  "24h_volume"?: string | number;
  "24h_amount"?: string | number;
}

export interface FrontendMarket {
  id: string;
  symbol: string;
  displayName: string;
  base: string;
  quote: string;
  status: string;
  markPrice: number;
  indexPrice: number;
  change24h: number | null;
  volume24h: number;
  openInterest: number;
  maxLeverage: number | null;
  minNotional: number | null;
  estimatedFundingRate: number | null;
  lastFundingRate: number | null;
  nextFundingTime: number | null;
}

export interface FrontendMarketSnapshot {
  markets: FrontendMarket[];
  total24hVolume: number;
  /** Aggregate returned by marketSummary; unavailable on the legacy fallback. */
  totalOpenInterest: number | null;
  fetchedAt: number;
  source: string;
  configuredSymbolCount: number;
}

export interface PublicTrader {
  id: string;
  address: string;
  brokerId: string | null;
  totalNotional: number;
  volume24h: number;
  volume30d: number;
  pnl24h: number | null;
  pnl30d: number | null;
  tradeCount24h: number;
  winRate30d: number | null;
  positionCount: number;
}

export interface PublicTraderSnapshot {
  rows: PublicTrader[];
  fetchedAt: number;
  source: string;
  lastUpdatedAt: number | null;
}

export interface PublicPosition {
  id: string;
  address: string;
  accountId: string | null;
  brokerId: string | null;
  symbol: string;
  side: "long" | "short" | "unknown";
  notional: number;
  quantity: number | null;
  averageOpenPrice: number | null;
  markPrice: number | null;
  liquidationPrice: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  marginMode: string | null;
  openedAt: number | null;
}

export interface PublicPositionSnapshot {
  positions: PublicPosition[];
  totalLongNotional: number;
  totalShortNotional: number;
  totalPositions: number;
  fetchedAt: number;
  source: string;
}

export interface PublicAccountPosition {
  id: string;
  symbol: string;
  side: "long" | "short" | "unknown";
  notional: number;
  quantity: number | null;
  averageOpenPrice: number | null;
  markPrice: number | null;
  liquidationPrice: number | null;
  unrealizedPnl: number | null;
  leverage: number | null;
  marginMode: string | null;
  openedAt: number | null;
}

export interface PublicAccount {
  id: string;
  address: string;
  brokerId: string | null;
  accountId: string | null;
  accountType: string | null;
  accountValue: number | null;
  collateralValue: number | null;
  freeCollateral: number | null;
  marginRatio: number | null;
  initialMarginRatio: number | null;
  maintenanceMarginRatio: number | null;
  unrealizedPnl: number | null;
  pnl24h: number | null;
  positions: PublicAccountPosition[];
}

function abortError(): DOMException {
  return new DOMException("Request was aborted", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = toNumber(value, Number.NaN);
  return Number.isFinite(number) ? number : null;
}

function optionalTimestamp(value: unknown): number | null {
  const timestamp = optionalNumber(value);
  return timestamp !== null && timestamp > 0 ? timestamp : null;
}

function normalizeApiBase(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  // A same-origin reverse proxy avoids CORS concerns on branded deployments.
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

/** The same network selection used by the trading frontend. */
export function getOrderlyApiBaseUrl(): string {
  const configured = normalizeApiBase(getRuntimeConfig("VITE_ORDERLY_API_URL"));
  if (configured) return configured;

  const disableMainnet = getRuntimeConfig("VITE_DISABLE_MAINNET") === "true";
  const disableTestnet = getRuntimeConfig("VITE_DISABLE_TESTNET") === "true";
  if (disableMainnet && !disableTestnet) return TESTNET_API;
  if (!disableMainnet && disableTestnet) return MAINNET_API;

  try {
    return window.localStorage.getItem("orderly_network_id") === "testnet"
      ? TESTNET_API
      : MAINNET_API;
  } catch {
    return MAINNET_API;
  }
}

function orderlySourceLabel(): string {
  if (normalizeApiBase(getRuntimeConfig("VITE_ORDERLY_API_URL"))) {
    return "Configured Orderly public API";
  }
  return `Orderly ${getOrderlyApiBaseUrl().includes("testnet") ? "testnet" : "mainnet"} public API`;
}

function orderlyEndpoint(path: string): string {
  const base = getOrderlyApiBaseUrl();
  return `${base === "/" ? "" : base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

export function getFrontendSymbols(): string[] {
  return getRuntimeConfigArray("VITE_SYMBOL_LIST")
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => /^PERP_[A-Z0-9_]+$/.test(symbol));
}

function getRefreshInterval(defaultValue: number): number {
  const configured = Number(getRuntimeConfig("VITE_ADMIN_LIVE_REFRESH_MS"));
  if (!Number.isFinite(configured) || configured <= 0) return defaultValue;
  // Avoid accidental browser-side request storms from an editable config file.
  return Math.max(5_000, Math.min(300_000, Math.round(configured)));
}

function mergeAbortSignals(
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

/** Call the zero-auth Orderly Public Info API used for the live fallback. */
export async function orderlyPublicQuery<T>(
  body: Record<string, unknown>,
  signal?: AbortSignal
): Promise<T> {
  const { signal: requestSignal, cleanup } = mergeAbortSignals(signal, 15_000);
  try {
    const response = await fetch(orderlyEndpoint("v1/public/query"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: requestSignal,
    });
    const text = await response.text();
    let payload: PublicEnvelope<T> | undefined;
    try {
      payload = text ? (JSON.parse(text) as PublicEnvelope<T>) : undefined;
    } catch {
      throw new AdminApiError("The Orderly public API returned an invalid response.", {
        status: response.status,
      });
    }

    if (!response.ok || payload?.success === false) {
      throw new AdminApiError(
        payload?.message || `The Orderly public API request failed (${response.status}).`,
        { status: response.status, code: payload?.code, details: payload }
      );
    }
    if (payload?.data === undefined) {
      throw new AdminApiError("The Orderly public API returned no data.");
    }
    return payload.data;
  } catch (error) {
    if (isAbortError(error) && signal?.aborted) throw error;
    if (error instanceof AdminApiError) throw error;
    if (isAbortError(error)) {
      throw new AdminApiError("The Orderly public API request timed out. Please try again.", {
        code: "ORDERLY_API_TIMEOUT",
      });
    }
    throw new AdminApiError(
      "Could not reach the Orderly public API. Check the selected network and try again.",
      { details: error }
    );
  } finally {
    cleanup();
  }
}

function marketParts(symbol: string, displayName?: string): {
  base: string;
  quote: string;
  displayName: string;
} {
  const pieces = symbol.replace(/^PERP_/, "").split("_");
  const quote = pieces.length > 1 ? pieces.pop() || "USDC" : "USDC";
  const base = pieces.join("_") || symbol;
  return { base, quote, displayName: displayName || base };
}

function normalizeMarket(raw: RawMarket): FrontendMarket | null {
  const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
  if (!symbol) return null;
  const { base, quote, displayName } = marketParts(
    symbol,
    typeof raw.display_symbol_name === "string" ? raw.display_symbol_name : undefined
  );
  const open = optionalNumber(raw["24h_open"]);
  const close = optionalNumber(raw["24h_close"] ?? raw.mark_price);
  const markPrice = firstFiniteNumber([raw.mark_price, raw["24h_close"], raw.index_price]);
  // `24h_amount` is quote notional. Older endpoints only expose base volume,
  // so multiply it by mark price as a clearly documented fallback.
  const quotedVolume = optionalNumber(raw["24h_amount"]);
  const volume24h =
    quotedVolume !== null
      ? quotedVolume
      : firstFiniteNumber([raw["24h_volume"]], 0) * markPrice;
  const status = typeof raw.status === "string" ? raw.status.toLowerCase() : "active";

  return {
    id: symbol,
    symbol,
    displayName,
    base,
    quote,
    status,
    markPrice,
    indexPrice: firstFiniteNumber([raw.index_price, raw.mark_price]),
    change24h:
      open !== null && close !== null && open !== 0 ? ((close - open) / open) * 100 : null,
    volume24h,
    openInterest: firstFiniteNumber([raw.open_interest]),
    maxLeverage: optionalNumber(raw.max_leverage),
    minNotional: optionalNumber(raw.min_notional),
    estimatedFundingRate: optionalNumber(raw.est_funding_rate),
    lastFundingRate: optionalNumber(raw.last_funding_rate),
    nextFundingTime: optionalTimestamp(raw.next_funding_time),
  };
}

function asMarketRows(payload: unknown): RawMarket[] {
  if (!isRecord(payload)) return [];
  const candidates = [payload.markets, payload.rows];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord) as RawMarket[];
    }
  }
  return [];
}

async function fallbackFuturesMarkets(signal?: AbortSignal): Promise<unknown> {
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID");
  const query = brokerId && brokerId !== "demo" ? `?broker_id=${encodeURIComponent(brokerId)}` : "";
  const response = await fetch(`${orderlyEndpoint("v1/public/futures_market")}${query}`, { signal });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    throw new AdminApiError("The Orderly fallback market endpoint returned invalid JSON.");
  }
  if (!response.ok || (isRecord(payload) && payload.success === false)) {
    throw new AdminApiError("Could not load live market data from Orderly.", {
      status: response.status,
      details: payload,
    });
  }
  if (isRecord(payload) && "data" in payload) return payload.data;
  return payload;
}

export async function fetchFrontendMarketSnapshot(
  signal?: AbortSignal
): Promise<FrontendMarketSnapshot> {
  const configuredSymbols = getFrontendSymbols();
  let payload: unknown;
  let usedLegacyMarketEndpoint = false;
  try {
    // Request the exact symbols exposed by the frontend when that list exists.
    // Without a list, Orderly's all-market fast path is the correct fallback.
    payload = await orderlyPublicQuery<unknown>(
      {
        type: "marketSummary",
        ...(configuredSymbols.length > 0 ? { symbols: configuredSymbols } : {}),
      },
      signal
    );
  } catch {
    if (signal?.aborted) throw abortError();
    // Some older deployments do not expose the newer Public Info endpoint.
    // Fall back to the long-standing public market endpoint rather than data
    // generated in the browser.
    usedLegacyMarketEndpoint = true;
    payload = await fallbackFuturesMarkets(signal);
  }

  const configuredSet = new Set(configuredSymbols);
  let markets = asMarketRows(payload)
    .map(normalizeMarket)
    .filter((market): market is FrontendMarket => market !== null);
  if (configuredSet.size > 0) {
    markets = markets.filter((market) => configuredSet.has(market.symbol));
  }
  markets.sort((a, b) => b.volume24h - a.volume24h || a.symbol.localeCompare(b.symbol));

  const responseRecord = isRecord(payload) ? payload : undefined;
  const reportedVolume = responseRecord ? optionalNumber(responseRecord.total_24h_volume) : null;
  const reportedOpenInterest = responseRecord
    ? optionalNumber(responseRecord.total_open_interest)
    : null;

  return {
    markets,
    // The legacy endpoint has no aggregate, so quote-notional is safely
    // summed from each market's documented 24h amount.
    total24hVolume:
      reportedVolume ?? markets.reduce((sum, market) => sum + market.volume24h, 0),
    // Do not invent a cross-market aggregate from per-market OI contract
    // values. marketSummary explicitly supplies this aggregate when present.
    totalOpenInterest: reportedOpenInterest,
    fetchedAt: Date.now(),
    source: usedLegacyMarketEndpoint
      ? `${orderlySourceLabel()} (legacy market endpoint)`
      : orderlySourceLabel(),
    configuredSymbolCount: configuredSymbols.length,
  };
}

export function useFrontendMarketSnapshot(
  options: QueryOptions = {}
): QueryState<FrontendMarketSnapshot> {
  const source = getOrderlyApiBaseUrl();
  const symbolKey = getFrontendSymbols().join(",");
  const load = useCallback(
    (signal: AbortSignal) => fetchFrontendMarketSnapshot(signal),
    // Re-query when selected network or frontend symbols change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, symbolKey]
  );
  return useAsyncQuery(`orderly-markets:${source}:${symbolKey}`, load, {
    ...options,
    pollInterval: options.pollInterval ?? getRefreshInterval(DEFAULT_MARKET_REFRESH_MS),
  });
}

function normalizeTrader(raw: Record<string, unknown>, index: number): PublicTrader | null {
  const address = typeof raw.address === "string" ? raw.address : "";
  if (!address) return null;
  return {
    id: address || `trader-${index}`,
    address,
    brokerId: typeof raw.broker_id === "string" ? raw.broker_id : null,
    totalNotional: firstFiniteNumber([raw.total_notional]),
    volume24h: firstFiniteNumber([raw.volume_24h]),
    volume30d: firstFiniteNumber([raw.volume_30d]),
    pnl24h: optionalNumber(raw.pnl_24h),
    pnl30d: optionalNumber(raw.pnl_30d),
    tradeCount24h: firstFiniteNumber([raw.trade_count_24h]),
    winRate30d: optionalNumber(raw.win_rate_30d),
    positionCount: firstFiniteNumber([raw.position_count]),
  };
}

export async function fetchPublicTraders(signal?: AbortSignal): Promise<PublicTraderSnapshot> {
  const data = await orderlyPublicQuery<unknown>(
    { type: "topAddresses", sort_by: "volume_30d", limit: 100 },
    signal
  );
  const record = isRecord(data) ? data : {};
  const rawRows = Array.isArray(record.rows) ? record.rows.filter(isRecord) : [];
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID");
  let rows = rawRows
    .map((row, index) => normalizeTrader(row, index))
    .filter((row): row is PublicTrader => row !== null);
  // topAddresses has no broker_id request filter. When this app has a real
  // broker configured, retain only rows the public endpoint identifies with
  // that broker rather than presenting unrelated network traders as users.
  if (brokerId && brokerId !== "demo") {
    rows = rows.filter((row) => row.brokerId === brokerId);
  }

  return {
    rows,
    fetchedAt: Date.now(),
    source: orderlySourceLabel(),
    lastUpdatedAt: optionalTimestamp(record.last_updated_time),
  };
}

export function usePublicTraders(
  options: QueryOptions = {}
): QueryState<PublicTraderSnapshot> {
  const source = getOrderlyApiBaseUrl();
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID") || "";
  const load = useCallback((signal: AbortSignal) => fetchPublicTraders(signal), [source, brokerId]);
  return useAsyncQuery(`orderly-top-traders:${source}:${brokerId}`, load, {
    ...options,
    // This endpoint is cached server-side for roughly 30 minutes.
    pollInterval: options.pollInterval ?? 5 * 60_000,
  });
}

function normalizePosition(raw: Record<string, unknown>, index: number): PublicPosition | null {
  const address = typeof raw.address === "string" ? raw.address : "";
  const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
  if (!address || !symbol) return null;
  const rawSide = typeof raw.side === "string" ? raw.side.toLowerCase() : "";
  return {
    id:
      typeof raw.position_id === "string"
        ? raw.position_id
        : `${address}-${symbol}-${raw.account_id ?? index}`,
    address,
    accountId: typeof raw.account_id === "string" ? raw.account_id : null,
    brokerId: typeof raw.broker_id === "string" ? raw.broker_id : null,
    symbol,
    side: rawSide === "long" ? "long" : rawSide === "short" ? "short" : "unknown",
    notional: firstFiniteNumber([raw.notional]),
    quantity: optionalNumber(raw.position_qty),
    averageOpenPrice: optionalNumber(raw.average_open_price),
    markPrice: optionalNumber(raw.mark_price),
    liquidationPrice: optionalNumber(raw.est_liq_price),
    unrealizedPnl: optionalNumber(raw.unrealized_pnl),
    leverage: optionalNumber(raw.leverage),
    marginMode: typeof raw.margin_mode === "string" ? raw.margin_mode : null,
    openedAt: optionalTimestamp(raw.opened_at),
  };
}

export async function fetchPublicPositions(
  signal?: AbortSignal
): Promise<PublicPositionSnapshot> {
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID");
  const data = await orderlyPublicQuery<unknown>(
    {
      type: "platformPositions",
      ...(brokerId && brokerId !== "demo" ? { broker_id: brokerId } : {}),
      limit: 100,
    },
    signal
  );
  const record = isRecord(data) ? data : {};
  const rawRows = Array.isArray(record.rows) ? record.rows.filter(isRecord) : [];
  const positions = rawRows
    .map((row, index) => normalizePosition(row, index))
    .filter((row): row is PublicPosition => row !== null)
    .sort((a, b) => b.notional - a.notional);
  return {
    positions,
    totalLongNotional: firstFiniteNumber([record.total_long_notional]),
    totalShortNotional: firstFiniteNumber([record.total_short_notional]),
    totalPositions: firstFiniteNumber([record.total_positions], positions.length),
    fetchedAt: Date.now(),
    source: orderlySourceLabel(),
  };
}

export function usePublicPositions(
  options: QueryOptions = {}
): QueryState<PublicPositionSnapshot> {
  const source = getOrderlyApiBaseUrl();
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID") || "";
  const load = useCallback((signal: AbortSignal) => fetchPublicPositions(signal), [source, brokerId]);
  return useAsyncQuery(`orderly-positions:${source}:${brokerId}`, load, {
    ...options,
    // platformPositions is a heavy query; keep polling deliberately modest.
    pollInterval: options.pollInterval ?? 60_000,
  });
}

function normalizeAccountPosition(
  raw: Record<string, unknown>,
  index: number,
  accountId: string | null
): PublicAccountPosition | null {
  const symbol = typeof raw.symbol === "string" ? raw.symbol : "";
  if (!symbol) return null;
  const rawSide = typeof raw.side === "string" ? raw.side.toLowerCase() : "";
  return {
    id: `${accountId ?? "account"}-${symbol}-${index}`,
    symbol,
    side: rawSide === "long" ? "long" : rawSide === "short" ? "short" : "unknown",
    notional: firstFiniteNumber([raw.notional]),
    quantity: optionalNumber(raw.position_qty),
    averageOpenPrice: optionalNumber(raw.average_open_price),
    markPrice: optionalNumber(raw.mark_price),
    liquidationPrice: optionalNumber(raw.est_liq_price),
    unrealizedPnl: optionalNumber(raw.unrealized_pnl),
    leverage: optionalNumber(raw.leverage),
    marginMode: typeof raw.margin_mode === "string" ? raw.margin_mode : null,
    openedAt: optionalTimestamp(raw.opened_at),
  };
}

function normalizeAccount(raw: Record<string, unknown>, fallbackAddress: string): PublicAccount {
  const accountId = typeof raw.account_id === "string" ? raw.account_id : null;
  const rawPositions = Array.isArray(raw.positions) ? raw.positions.filter(isRecord) : [];
  return {
    id: accountId || `${fallbackAddress}-${raw.account_type ?? "account"}`,
    address: typeof raw.address === "string" ? raw.address : fallbackAddress,
    brokerId: typeof raw.broker_id === "string" ? raw.broker_id : null,
    accountId,
    accountType: typeof raw.account_type === "string" ? raw.account_type : null,
    accountValue: optionalNumber(raw.account_value),
    collateralValue: optionalNumber(raw.total_collateral_value),
    freeCollateral: optionalNumber(raw.free_collateral),
    marginRatio: optionalNumber(raw.margin_ratio),
    initialMarginRatio: optionalNumber(raw.initial_margin_ratio),
    maintenanceMarginRatio: optionalNumber(raw.maintenance_margin_ratio),
    unrealizedPnl: optionalNumber(raw.total_unrealized_pnl),
    pnl24h: optionalNumber(raw.total_pnl_24_h),
    positions: rawPositions
      .map((position, index) => normalizeAccountPosition(position, index, accountId))
      .filter((position): position is PublicAccountPosition => position !== null),
  };
}

export async function fetchPublicAccount(
  address: string,
  signal?: AbortSignal
): Promise<PublicAccount[]> {
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID");
  const data = await orderlyPublicQuery<unknown>(
    {
      type: "accountState",
      address,
      ...(brokerId && brokerId !== "demo" ? { broker_id: brokerId } : {}),
    },
    signal
  );
  if (!isRecord(data)) return [];
  const records = Array.isArray(data.accounts)
    ? data.accounts.filter(isRecord)
    : [data];
  return records.map((record) => normalizeAccount(record, address));
}

export function usePublicAccount(
  address: string,
  options: QueryOptions = {}
): QueryState<PublicAccount[]> {
  const source = getOrderlyApiBaseUrl();
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID") || "";
  const validAddress = /^0x[a-fA-F0-9]{40}$/.test(address);
  const load = useCallback(
    (signal: AbortSignal) => fetchPublicAccount(address, signal),
    [address, source, brokerId]
  );
  return useAsyncQuery(`orderly-account:${source}:${brokerId}:${address}`, load, {
    ...options,
    enabled: validAddress && (options.enabled ?? true),
    pollInterval: options.pollInterval ?? 30_000,
  });
}
