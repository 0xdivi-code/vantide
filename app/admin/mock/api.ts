/**
 * Mock API facade: pages call these instead of reading collections
 * directly, which keeps the door open to swapping in a real backend later.
 * Includes a versioned subscription so UI refreshes after mutations.
 */

import { useEffect, useState } from "react";

let apiVersion = 1;
const listeners = new Set<() => void>();

export function bumpApiVersion(): void {
  apiVersion += 1;
  listeners.forEach((l) => l());
}

export function subscribeMockApi(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Re-render component whenever any mock collection mutates. */
export function useMockApiVersion(): number {
  const [v, setV] = useState(apiVersion);
  useEffect(() => subscribeMockApi(() => setV(apiVersion)), []);
  return v;
}

/** Simple text search matcher. */
export function matches(haystack: (string | number | undefined | null)[], q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  return haystack.some((h) => h !== undefined && h !== null && String(h).toLowerCase().includes(query));
}

/** Pagination helper for "infinite-ish" data. */
export function slicePage<T>(rows: T[], page: number, size: number): T[] {
  return rows.slice(page * size, page * size + size);
}
