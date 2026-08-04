/**
 * DataTable: sorting, client pagination, sticky header, column visibility
 * (persisted per tableKey), row selection + bulk action bar, CSV export,
 * skeleton & empty states. The visual workhorse of every admin module.
 */

import { ReactNode, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  SlidersHorizontal,
  Inbox,
} from "lucide-react";
import { AdminButton } from "./ui";
import { TableSkeleton } from "./feedback";

export interface Column<T> {
  key: string;
  label: ReactNode;
  render?: (row: T) => ReactNode;
  /** value used when sorting/copying; defaults to render-agnostic accessor */
  sortValue?: (row: T) => number | string;
  csvValue?: (row: T) => string;
  align?: "left" | "right";
  defaultHidden?: boolean;
  width?: string;
}

interface DataTableProps<T extends { id: string }> {
  tableKey: string;
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyHint?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  /** renders the bulk action bar content when rows are selected */
  bulkActions?: (selected: T[], clear: () => void) => ReactNode;
  footer?: ReactNode;
  initialSortKey?: string;
  initialSortDir?: "asc" | "desc";
}

function loadHidden(tableKey: string): Set<string> {
  try {
    const raw = localStorage.getItem(`vantide-table-cols-${tableKey}`);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveHidden(tableKey: string, hidden: Set<string>) {
  try {
    localStorage.setItem(`vantide-table-cols-${tableKey}`, JSON.stringify([...hidden]));
  } catch {
    /* ignore */
  }
}

const PAGE_SIZE_KEY = "vantide-table-pagesize";

function loadPageSize(): number {
  try {
    const v = Number(localStorage.getItem(PAGE_SIZE_KEY));
    return [10, 25, 50].includes(v) ? v : 10;
  } catch {
    return 10;
  }
}

export function DataTable<T extends { id: string }>({
  tableKey,
  columns,
  rows,
  loading,
  emptyTitle = "Nothing here yet",
  emptyHint,
  pageSize: pageSizeProp,
  onRowClick,
  bulkActions,
  footer,
  initialSortKey,
  initialSortDir = "desc",
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(pageSizeProp ?? loadPageSize());
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSortDir);
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const h = loadHidden(tableKey);
    columns.forEach((c) => {
      if (c.defaultHidden && !localStorage.getItem(`vantide-table-cols-${tableKey}`)) {
        h.add(c.key);
      }
    });
    return h;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [colMenuOpen, setColMenuOpen] = useState(false);

  const visibleCols = columns.filter((c) => !hidden.has(c.key));

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }, [rows, columns, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const toggleHidden = (key: string) => {
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveHidden(tableKey, next);
      return next;
    });
  };

  const allSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleAll = () => {
    setSelected((s) => {
      const next = new Set(s);
      if (allSelected) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const cols = visibleCols;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = cols.map((c) => esc(String(c.label))).join(",");
    const body = sorted.map((r) =>
      cols
        .map((c) => {
          if (c.csvValue) return esc(c.csvValue(r));
          if (c.sortValue) return esc(String(c.sortValue(r)));
          return esc("");
        })
        .join(",")
    );
    const csv = [header, ...body].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedRows = sorted.filter((r) => selected.has(r.id));

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-8))]">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-2.5">
        <span className="text-xs text-white/40">
          {sorted.length.toLocaleString()} row{sorted.length === 1 ? "" : "s"}
        </span>
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setColMenuOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white/80"
            title="Customize columns"
          >
            <SlidersHorizontal size={13} />
            Columns
          </button>
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white/80"
            title="Export CSV"
          >
            <Download size={13} />
            CSV
          </button>
          {colMenuOpen && (
            <>
              <button
                type="button"
                aria-label="Close column menu"
                tabIndex={-1}
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setColMenuOpen(false)}
              />
              <div className="absolute right-0 top-8 z-30 w-48 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-6))] p-2 shadow-2xl">
                {columns.map((c) => (
                  <label
                    key={c.key}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-white/70 hover:bg-white/5"
                  >
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.key)}
                      onChange={() => toggleHidden(c.key)}
                      className="accent-[rgb(var(--oui-color-primary))]"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[rgb(var(--oui-color-base-7))] text-[11px] uppercase tracking-wider text-white/35">
              {bulkActions && (
                <th className="w-9 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-[rgb(var(--oui-color-primary))]"
                    aria-label="Select all rows"
                  />
                </th>
              )}
              {visibleCols.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={`whitespace-nowrap px-3 py-2.5 font-medium ${
                    c.align === "right" ? "text-right" : ""
                  } ${c.sortValue ? "cursor-pointer select-none hover:text-white/60" : ""}`}
                  onClick={c.sortValue ? () => toggleSort(c.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortValue &&
                      (sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp size={11} />
                        ) : (
                          <ArrowDown size={11} />
                        )
                      ) : (
                        <ArrowUpDown size={11} className="opacity-40" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={visibleCols.length + (bulkActions ? 1 : 0)}>
                  <TableSkeleton rows={6} cols={Math.max(3, visibleCols.length - 1)} />
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + (bulkActions ? 1 : 0)}>
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-white/25">
                      <Inbox size={20} />
                    </div>
                    <p className="text-sm font-medium text-white/65">{emptyTitle}</p>
                    {emptyHint && <p className="max-w-xs text-xs text-white/35">{emptyHint}</p>}
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={row.id}
                  className={`transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${
                    selected.has(row.id)
                      ? "bg-[rgba(var(--oui-color-primary),0.08)]"
                      : "hover:bg-white/[0.03]"
                  }`}
                  onClick={
                    onRowClick
                      ? (e) => {
                          // Let real controls inside cells handle their own clicks.
                          if ((e.target as HTMLElement).closest("button, a, input, select, textarea, [role='button'], [role='switch']")) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {bulkActions && (
                    <td
                      className="px-3 py-2.5"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        className="accent-[rgb(var(--oui-color-primary))]"
                        aria-label="Select row"
                      />
                    </td>
                  )}
                  {visibleCols.map((c) => (
                    <td
                      key={c.key}
                      className={`whitespace-nowrap px-3 py-2.5 text-white/75 ${
                        c.align === "right" ? "text-right" : ""
                      }`}
                    >
                      {c.render ? c.render(row) : c.sortValue ? String(c.sortValue(row)) : null}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          {!pageSizeProp && (
            <select
              value={pageSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPageSize(v);
                setPage(0);
                try {
                  localStorage.setItem(PAGE_SIZE_KEY, String(v));
                } catch {
                  /* ignore */
                }
              }}
              className="rounded-md border border-white/10 bg-[rgb(var(--oui-color-base-9))] px-1.5 py-1 text-xs text-white/60"
              aria-label="Rows per page"
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n}/page
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <AdminButton
            variant="ghost"
            className="!px-2.5 !py-1 text-xs"
            disabled={safePage === 0}
            onClick={() => setPage(0)}
          >
            «
          </AdminButton>
          <AdminButton
            variant="ghost"
            className="!px-2.5 !py-1 text-xs"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ‹ Prev
          </AdminButton>
          <AdminButton
            variant="ghost"
            className="!px-2.5 !py-1 text-xs"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next ›
          </AdminButton>
          <AdminButton
            variant="ghost"
            className="!px-2.5 !py-1 text-xs"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(pageCount - 1)}
          >
            »
          </AdminButton>
        </div>
      </div>

      {footer}

      {/* bulk action bar */}
      {bulkActions && selectedRows.length > 0 && (
        <div className="sticky bottom-3 z-20 mx-auto flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-5))] px-4 py-2.5 shadow-2xl">
          <span className="text-xs font-medium text-white/70">
            {selectedRows.length} selected
          </span>
          {bulkActions(selectedRows, () => setSelected(new Set()))}
        </div>
      )}
    </div>
  );
}
