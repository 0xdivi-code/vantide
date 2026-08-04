/** Deterministic seeded PRNG + helpers for the mock backend. */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export const int = (r: Rng, min: number, max: number): number =>
  Math.floor(r() * (max - min + 1)) + min;

export const float = (r: Rng, min: number, max: number, dp = 2): number => {
  const f = r() * (max - min) + min;
  const p = Math.pow(10, dp);
  return Math.round(f * p) / p;
};

export const pick = <T>(r: Rng, arr: readonly T[]): T =>
  arr[Math.floor(r() * arr.length)];

export const chance = (r: Rng, p: number): boolean => r() < p;

/** n distinct picks from arr (shuffled copy). */
export const pickMany = <T>(r: Rng, arr: readonly T[], n: number): T[] => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
};

const NOW = Date.now();
export const minutesAgo = (m: number): number => NOW - m * 60_000;
export const hoursAgo = (h: number): number => NOW - h * 3_600_000;
export const daysAgo = (d: number): number => NOW - d * 86_400_000;
export const daysFromNow = (d: number): number => NOW + d * 86_400_000;

export const hexId = (r: Rng, len: number): string => {
  const c = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < len; i++) s += c[Math.floor(r() * 16)];
  return s;
};

export const evmAddress = (r: Rng): string => `0x${hexId(r, 40)}`;

export const txHash = (r: Rng): string => `0x${hexId(r, 64)}`;

export const idSeries = (prefix: string) => {
  let n = 0;
  return () => `${prefix}_${String(++n).padStart(5, "0")}`;
};

/** Smooth deterministic waveform for chart series. */
export function waveSeries(
  seed: number,
  days: number,
  base: number,
  variance: number,
  trend = 0
): number[] {
  const r = mulberry32(seed);
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < days; i++) {
    const seasonal = Math.sin(i / 4.2) * variance * 0.4;
    v = Math.max(
      base * 0.2,
      v + (r() - 0.48) * variance + seasonal * 0.2 + trend
    );
    out.push(Math.round(v));
  }
  return out;
}

export const shortHash = (h: string, chars = 6): string =>
  h.length <= chars * 2 + 2 ? h : `${h.slice(0, chars + 2)}…${h.slice(-chars)}`;

export const fmtNum = (n: number, dp = 0): string =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

export const fmtUsd = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};

export const fmtTime = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export const timeAgo = (ts: number): string => {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return fmtDate(ts);
};
