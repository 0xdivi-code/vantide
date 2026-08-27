import { type ReactNode, useMemo, useState } from "react";
import { Database, Eye, RefreshCw, Search } from "lucide-react";
import { getAdminApiUrl, useAdminResource } from "@/admin/api/client";
import {
  asString,
  formatDateTime,
  formatNumber,
  humanizeKey,
  isRecord,
  isTimestampKey,
  type UnknownRecord,
} from "@/admin/data/format";
import { DataTable, type Column } from "./DataTable";
import { Drawer } from "./feedback";
import { AdminButton, Badge, PageHeader, TextInput } from "./ui";
import {
  AdminApiRequired,
  EmptyDataState,
  LiveDataBar,
  LoadingDataState,
  QueryErrorState,
} from "./LiveDataState";

export interface RemoteRow extends UnknownRecord {
  id: string;
}

interface NormalizedResource {
  rows: RemoteRow[];
  total: number | undefined;
  updatedAt: number | undefined;
}

const ROW_ARRAY_KEYS = ["rows", "items", "results", "records"];
const PREFERRED_KEYS = [
  "id",
  "name",
  "title",
  "email",
  "address",
  "wallet",
  "symbol",
  "status",
  "type",
  "amount",
  "created_at",
  "updated_at",
  "createdAt",
  "updatedAt",
];

function rowIdentifier(row: UnknownRecord, index: number): string {
  const candidates = [row.id, row._id, row.uuid, row.address, row.wallet, row.symbol];
  for (const candidate of candidates) {
    if (typeof candidate === "string" || typeof candidate === "number") {
      return String(candidate);
    }
  }
  return `row-${index}`;
}

function normalizeRows(value: unknown): NormalizedResource {
  let rowsValue: unknown[] = [];
  let total: number | undefined;
  let updatedAt: number | undefined;

  if (Array.isArray(value)) {
    rowsValue = value;
  } else if (isRecord(value)) {
    let hasListEnvelope = false;
    for (const key of ROW_ARRAY_KEYS) {
      if (Array.isArray(value[key])) {
        rowsValue = value[key] as unknown[];
        hasListEnvelope = true;
        break;
      }
    }
    if (!hasListEnvelope && isRecord(value.data)) {
      for (const key of ROW_ARRAY_KEYS) {
        if (Array.isArray(value.data[key])) {
          rowsValue = value.data[key] as unknown[];
          hasListEnvelope = true;
          break;
        }
      }
    }
    // A detail record may itself contain arrays such as positions or roles.
    // Only a known list envelope should prevent it from being shown as a row.
    if (!hasListEnvelope) rowsValue = [value];

    const totalCandidate = value.total ?? value.count ?? value.total_count;
    if (typeof totalCandidate === "number" && Number.isFinite(totalCandidate)) {
      total = totalCandidate;
    } else if (typeof totalCandidate === "string" && Number.isFinite(Number(totalCandidate))) {
      total = Number(totalCandidate);
    }
    const updatedCandidate = value.updated_at ?? value.updatedAt ?? value.timestamp ?? value.ts;
    if (typeof updatedCandidate === "number" && updatedCandidate > 0) {
      updatedAt = updatedCandidate;
    } else if (typeof updatedCandidate === "string" && /^\d+$/.test(updatedCandidate)) {
      updatedAt = Number(updatedCandidate);
    }
  }

  return {
    rows: rowsValue
      .filter(isRecord)
      .map((row, index) => ({ ...row, id: rowIdentifier(row, index) })),
    total,
    updatedAt,
  };
}

function isScalar(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function displayValue(value: unknown, key: string): ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-white/25">—</span>;
  }
  if (typeof value === "boolean") {
    return <Badge tone={value ? "success" : "neutral"}>{value ? "yes" : "no"}</Badge>;
  }
  if (typeof value === "number") {
    if (isTimestampKey(key) && value > 946_684_800_000) {
      return <span className="text-white/50">{formatDateTime(value)}</span>;
    }
    return formatNumber(value, false);
  }
  if (typeof value === "string") {
    if (isTimestampKey(key) && (/^\d+$/.test(value) || !Number.isNaN(Date.parse(value)))) {
      return <span className="text-white/50">{formatDateTime(value)}</span>;
    }
    return <span className="block max-w-[260px] truncate" title={value}>{value}</span>;
  }
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (isRecord(value)) return `${Object.keys(value).length} field${Object.keys(value).length === 1 ? "" : "s"}`;
  return asString(value);
}

function scalarColumns(rows: RemoteRow[]): Column<RemoteRow>[] {
  const available = new Set<string>();
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (!key.startsWith("_") && isScalar(value)) available.add(key);
    });
  });

  const ordered = [
    ...PREFERRED_KEYS.filter((key) => available.has(key)),
    ...[...available].filter((key) => !PREFERRED_KEYS.includes(key)).sort(),
  ].slice(0, 9);

  return ordered.map((key) => ({
    key,
    label: humanizeKey(key),
    sortValue: (row) => {
      const value = row[key];
      if (typeof value === "number") return value;
      if (typeof value === "boolean") return value ? 1 : 0;
      return asString(value, "");
    },
    csvValue: (row) => {
      const value = row[key];
      return isScalar(value) ? asString(value, "") : JSON.stringify(value) ?? "";
    },
    render: (row) => displayValue(row[key], key),
  }));
}

export function AdminResourcePage({
  resource,
  title,
  description,
  pollInterval = 30_000,
}: {
  resource: string;
  title: string;
  description: string;
  pollInterval?: number;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RemoteRow | null>(null);
  const query = useAdminResource<unknown>(resource, { limit: 100 }, { pollInterval });
  const normalized = useMemo(() => normalizeRows(query.data), [query.data]);
  const columns = useMemo(() => scalarColumns(normalized.rows), [normalized.rows]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return normalized.rows;
    return normalized.rows.filter((row) => (JSON.stringify(row) ?? "").toLowerCase().includes(needle));
  }, [normalized.rows, search]);
  const endpoint = getAdminApiUrl(resource);

  if (!endpoint) {
    return (
      <div className="space-y-5">
        <PageHeader title={title} description={description} />
        <AdminApiRequired resource={resource} title={`${title} needs an admin API`} />
      </div>
    );
  }

  if (query.isLoading && !query.data) {
    return (
      <div className="space-y-5">
        <PageHeader title={title} description={description} />
        <LoadingDataState label={`Fetching ${title.toLowerCase()}…`} />
      </div>
    );
  }

  if (query.error && !query.data) {
    return (
      <div className="space-y-5">
        <PageHeader title={title} description={description} />
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        actions={
          <AdminButton onClick={() => void query.refetch()} disabled={query.isRefreshing}>
            <RefreshCw size={14} className={query.isRefreshing ? "animate-spin" : ""} /> Refresh
          </AdminButton>
        }
      />
      <LiveDataBar
        source={endpoint}
        updatedAt={normalized.updatedAt ?? query.updatedAt}
        refreshing={query.isRefreshing}
        onRefresh={() => void query.refetch()}
      />
      <QueryErrorState error={query.error} onRetry={() => void query.refetch()} compact />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative w-full max-w-sm">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Filter ${title.toLowerCase()}…`}
            className="pl-9"
          />
        </label>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Database size={14} className="text-[rgb(var(--oui-color-primary-light))]" />
          {normalized.total !== undefined
            ? `${formatNumber(normalized.total, false)} total records`
            : `${formatNumber(normalized.rows.length, false)} fetched records`}
        </div>
      </div>

      {columns.length === 0 ? (
        <EmptyDataState
          title="The API returned no tabular records"
          hint="Return an array, or an object with rows, items, results, or records. The raw endpoint is connected, but there is nothing to display in this view yet."
        />
      ) : (
        <DataTable
          tableKey={`remote-${resource.replace(/[^a-z0-9]+/gi, "-")}`}
          columns={columns}
          rows={rows}
          onRowClick={setSelected}
          emptyTitle={search ? "No records match this filter" : "No records returned"}
          emptyHint={search ? "Try a broader search." : "The connected API returned an empty collection."}
          initialSortKey={columns.find((column) => /updated|created|time|date/i.test(column.key))?.key}
        />
      )}

      <p className="text-[11px] leading-relaxed text-white/30">
        This screen reads <code className="font-mono text-white/45">GET {endpoint}?limit=100</code>. Data mutations remain server-authorized; no browser-only changes are persisted as operational records.
      </p>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="API record"
        subtitle={selected ? selected.id : undefined}
        width={620}
      >
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-9))] p-4 font-mono text-xs leading-relaxed text-white/65">
          {selected ? JSON.stringify(selected, null, 2) : ""}
        </pre>
      </Drawer>
    </div>
  );
}
