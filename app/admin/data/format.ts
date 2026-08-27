/** Formatting and value helpers shared by the live admin data views. */

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

export function firstFiniteNumber(
  values: unknown[],
  fallback = 0
): number {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const number = toNumber(value, Number.NaN);
    if (Number.isFinite(number)) return number;
  }
  return fallback;
}

export function asString(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

export function formatNumber(value: number | null | undefined, compact = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 4,
  }).format(value);
}

export function formatUsd(value: number | null | undefined, compact = true): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 2,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  options: { signed?: boolean; fraction?: boolean; digits?: number } = {}
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const { signed = false, fraction = false, digits = 2 } = options;
  const number = fraction ? value * 100 : value;
  const prefix = signed && number > 0 ? "+" : "";
  return `${prefix}${number.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })}%`;
}

export function formatDateTime(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const date =
    typeof value === "number"
      ? new Date(value)
      : typeof value === "string" && /^\d+$/.test(value)
        ? new Date(Number(value))
        : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAge(timestamp: number | null | undefined): string {
  if (!timestamp || !Number.isFinite(timestamp)) return "—";
  const diff = Math.max(0, Date.now() - timestamp);
  if (diff < 10_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function shortAddress(value: string | null | undefined, visible = 6): string {
  if (!value) return "—";
  if (value.length <= visible * 2 + 1) return value;
  return `${value.slice(0, visible)}…${value.slice(-4)}`;
}

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isTimestampKey(key: string): boolean {
  return /(?:^|_)(?:at|time|date|timestamp|ts)$|(?:created|updated|sent|submitted|opened|closed|last)[A-Z_]/i.test(
    key
  );
}
