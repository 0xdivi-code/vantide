/**
 * Mock backend engine: deterministic base data (seeded RNG) with mutations
 * persisted to localStorage.Collections are generated lazily on first
 * access; a collection is only written to storage after the first mutation,
 * so fresh visitors pay no storage cost.
 */

const PREFIX = "vantide-mock-";

export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export interface Collection<T extends { id: string }> {
  all(): T[];
  get(id: string): T | undefined;
  insert(item: T): void;
  insertMany(items: T[]): void;
  update(id: string, patch: Partial<T>): T | undefined;
  remove(id: string): T | undefined;
  replaceAll(items: T[]): void;
  reset(): void;
  count(): number;
  /** true after first mutation */
  dirty: boolean;
}

export function collection<T extends { id: string }>(
  key: string,
  seed: () => T[]
): Collection<T> {
  let cache: T[] | null = null;

  const load = (): T[] => {
    if (cache) return cache;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(PREFIX + key);
        if (raw) {
          cache = JSON.parse(raw) as T[];
          return cache;
        }
      } catch (e) {
        console.warn(`[mock] failed to read ${key}:`, e);
      }
    }
    cache = seed();
    return cache;
  };

  const persist = () => {
    if (typeof window === "undefined" || !cache) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(cache));
    } catch (e) {
      console.warn(`[mock] failed to persist ${key}:`, e);
    }
  };

  return {
    dirty: false,
    all() {
      return load();
    },
    count() {
      return load().length;
    },
    get(id) {
      return load().find((x) => x.id === id);
    },
    insert(item) {
      const rows = load();
      cache = [item, ...rows];
      persist();
      this.dirty = true;
    },
    insertMany(items) {
      const rows = load();
      cache = [...items, ...rows];
      persist();
      this.dirty = true;
    },
    update(id, patch) {
      const rows = load();
      const idx = rows.findIndex((x) => x.id === id);
      if (idx === -1) return undefined;
      const updated = { ...rows[idx], ...patch };
      cache = rows.slice();
      cache[idx] = updated;
      persist();
      this.dirty = true;
      return updated;
    },
    remove(id) {
      const rows = load();
      const idx = rows.findIndex((x) => x.id === id);
      if (idx === -1) return undefined;
      const [removed] = rows.slice(idx, idx + 1);
      cache = [...rows.slice(0, idx), ...rows.slice(idx + 1)];
      persist();
      this.dirty = true;
      return removed;
    },
    replaceAll(items) {
      cache = items;
      persist();
      this.dirty = true;
    },
    reset() {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(PREFIX + key);
        } catch {
          /* ignore */
        }
      }
      cache = null;
    },
  };
}

/** Reset every mock collection (used by System settings "factory reset"). */
export function resetAllMockStorage(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
