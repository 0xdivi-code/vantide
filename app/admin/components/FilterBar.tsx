/** Saved filters hook + filter bar UI used across admin tables. */

import { ReactNode, useCallback, useEffect, useState } from "react";
import { Search, X } from "lucide-react";

/** Filters object persisted to localStorage under a stable key. */
export function useSavedFilters<T extends Record<string, string>>(
  saveKey: string,
  defaults: T
): [T, (patch: Partial<T>) => void, () => void] {
  const [filters, setFilters] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`vantide-filters-${saveKey}`);
      if (raw) return { ...defaults, ...(JSON.parse(raw) as Partial<T>) };
    } catch {
      /* ignore */
    }
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(`vantide-filters-${saveKey}`, JSON.stringify(filters));
    } catch {
      /* ignore */
    }
  }, [saveKey, filters]);

  const patch = useCallback(
    (p: Partial<T>) => setFilters((f) => ({ ...f, ...p })),
    []
  );
  const reset = useCallback(() => setFilters(defaults), [defaults]);

  return [filters, patch, reset];
}

export interface FilterSelectDef {
  key: string;
  label?: string;
  options: { value: string; label: string }[];
}

export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search…",
  selects,
  values,
  onSelect,
  right,
}: {
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  selects?: FilterSelectDef[];
  values?: Record<string, string>;
  onSelect?: (key: string, value: string) => void;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearch !== undefined && (
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] py-2 pl-9 pr-8 text-sm text-white placeholder-white/25 outline-none focus:border-[rgba(var(--oui-color-primary),0.6)]"
          />
          {search && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}
      {selects?.map((sel) => (
        <select
          key={sel.key}
          value={values?.[sel.key] ?? ""}
          onChange={(e) => onSelect?.(sel.key, e.target.value)}
          aria-label={sel.label || sel.key}
          className="rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] px-2.5 py-2 text-xs text-white/70 outline-none focus:border-[rgba(var(--oui-color-primary),0.6)]"
        >
          <option value="">{sel.label || "All"}</option>
          {sel.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}
