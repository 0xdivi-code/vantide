import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  BadgeInfo,
  Coins,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";
import { useFrontendMarketSnapshot, type FrontendMarket } from "@/admin/api/orderly";
import {
  formatDateTime,
  formatNumber,
  formatPercent,
  formatUsd,
} from "@/admin/data/format";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { Drawer } from "@/admin/components/feedback";
import { Badge, AdminButton, Card, Field, PageHeader, Select, TextInput } from "@/admin/components/ui";
import {
  EmptyDataState,
  LiveDataBar,
  LoadingDataState,
  QueryErrorState,
} from "@/admin/components/LiveDataState";

function marketName(market: FrontendMarket): string {
  return `${market.displayName}/${market.quote}`;
}

export default function AdminPairs() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<FrontendMarket | null>(null);
  const query = useFrontendMarketSnapshot();
  const snapshot = query.data;

  const rows = useMemo(() => {
    if (!snapshot) return [];
    const needle = search.trim().toLowerCase();
    return snapshot.markets.filter(
      (market) =>
        (!needle ||
          [market.symbol, market.displayName, market.base, market.quote]
            .join(" ")
            .toLowerCase()
            .includes(needle)) &&
        (!status || market.status === status)
    );
  }, [search, snapshot, status]);

  const statuses = useMemo(
    () => [...new Set(snapshot?.markets.map((market) => market.status) ?? [])].sort(),
    [snapshot]
  );

  const columns: Column<FrontendMarket>[] = [
    {
      key: "symbol",
      label: "Market",
      sortValue: (market) => market.symbol,
      render: (market) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--oui-color-primary),0.15)] text-[11px] font-bold text-[rgb(var(--oui-color-primary-light))]">
            {market.displayName.slice(0, 3)}
          </span>
          <div>
            <div className="font-medium text-white">{marketName(market)}</div>
            <div className="font-mono text-[10px] text-white/30">{market.symbol}</div>
          </div>
        </div>
      ),
      csvValue: (market) => market.symbol,
    },
    {
      key: "mark",
      label: "Mark price",
      align: "right",
      sortValue: (market) => market.markPrice,
      render: (market) => formatUsd(market.markPrice, false),
      csvValue: (market) => String(market.markPrice),
    },
    {
      key: "change",
      label: "24h change",
      align: "right",
      sortValue: (market) => market.change24h ?? 0,
      render: (market) => {
        const positive = (market.change24h ?? 0) >= 0;
        return (
          <span className={`inline-flex items-center gap-1 ${positive ? "text-[rgb(var(--oui-color-success))]" : "text-[rgb(var(--oui-color-danger-light))]"}`}>
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {formatPercent(market.change24h, { signed: true })}
          </span>
        );
      },
      csvValue: (market) => String(market.change24h ?? ""),
    },
    {
      key: "volume",
      label: "24h notional",
      align: "right",
      sortValue: (market) => market.volume24h,
      render: (market) => formatUsd(market.volume24h),
      csvValue: (market) => String(market.volume24h),
    },
    {
      key: "oi",
      label: "Open interest",
      align: "right",
      sortValue: (market) => market.openInterest,
      render: (market) => formatNumber(market.openInterest),
      csvValue: (market) => String(market.openInterest),
    },
    {
      key: "funding",
      label: "Est. funding",
      align: "right",
      sortValue: (market) => market.estimatedFundingRate ?? 0,
      render: (market) => formatPercent(market.estimatedFundingRate, { fraction: true, signed: true, digits: 4 }),
      csvValue: (market) => String(market.estimatedFundingRate ?? ""),
    },
    {
      key: "leverage",
      label: "Max leverage",
      align: "right",
      sortValue: (market) => market.maxLeverage ?? 0,
      render: (market) => (market.maxLeverage ? `${market.maxLeverage}×` : "—"),
      csvValue: (market) => String(market.maxLeverage ?? ""),
    },
    {
      key: "status",
      label: "Status",
      sortValue: (market) => market.status,
      render: (market) => <Badge tone={market.status === "active" ? "success" : "warning"}>{market.status}</Badge>,
      csvValue: (market) => market.status,
    },
  ];

  if (query.isLoading && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Live Trading Pairs" description="Loading the markets configured in the frontend." />
        <LoadingDataState />
      </div>
    );
  }

  if (query.error && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Live Trading Pairs" description="Market data comes from the selected Orderly network." />
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Live Trading Pairs"
        description="Actual prices, volume, open interest, funding, and limits for markets exposed by this trading frontend. This view does not create browser-only demo listings."
        actions={
          <AdminButton onClick={() => void query.refetch()} disabled={query.isRefreshing}>
            <RefreshCw size={14} className={query.isRefreshing ? "animate-spin" : ""} /> Refresh
          </AdminButton>
        }
      />
      <LiveDataBar
        source={snapshot?.source || "Orderly public API"}
        updatedAt={snapshot?.fetchedAt}
        refreshing={query.isRefreshing}
        onRefresh={() => void query.refetch()}
      />
      <QueryErrorState error={query.error} onRetry={() => void query.refetch()} compact />

      {!snapshot || snapshot.markets.length === 0 ? (
        <EmptyDataState
          title="No frontend symbols are available"
          hint="The current VITE_SYMBOL_LIST did not match markets on the selected network. Update the frontend symbol configuration or switch network, then refresh."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card>
              <div className="flex items-center gap-3">
                <Coins size={18} className="text-[rgb(var(--oui-color-primary-light))]" />
                <div>
                  <div className="text-xs text-white/45">Markets returned</div>
                  <div className="text-xl font-bold text-white">{snapshot.markets.length}</div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Waves size={18} className="text-[rgb(var(--oui-color-success))]" />
                <div>
                  <div className="text-xs text-white/45">24h market notional</div>
                  <div className="text-xl font-bold text-white">{formatUsd(snapshot.total24hVolume)}</div>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <Gauge size={18} className="text-[rgb(var(--oui-color-warning))]" />
                <div>
                  <div className="text-xs text-white/45">Reported total OI</div>
                  <div className="text-xl font-bold text-white">{formatNumber(snapshot.totalOpenInterest)}</div>
                </div>
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] p-3 sm:flex-row sm:items-center">
            <label className="relative min-w-0 flex-1">
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticker or symbol…"
              />
            </label>
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-[150px]">
                <option value="">All statuses</option>
                {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
          </div>

          <DataTable
            tableKey="live-pairs"
            columns={columns}
            rows={rows}
            onRowClick={setSelected}
            emptyTitle="No markets match these filters"
            emptyHint="Clear the filter or verify that the ticker is enabled in the frontend configuration."
            initialSortKey="volume"
          />
        </>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-[rgba(var(--oui-color-primary),0.22)] bg-[rgba(var(--oui-color-primary),0.06)] p-3 text-xs leading-relaxed text-white/50">
        <BadgeInfo size={15} className="mt-0.5 shrink-0 text-[rgb(var(--oui-color-primary-light))]" />
        <p>
          This is a read-only live market view. Listing, halting, or changing risk limits is an authenticated server-side operation and is not simulated in the browser.
        </p>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? marketName(selected) : "Market"}
        subtitle={selected?.symbol}
        width={480}
      >
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Mark price", formatUsd(selected.markPrice, false)],
                ["Index price", formatUsd(selected.indexPrice, false)],
                ["24h change", formatPercent(selected.change24h, { signed: true })],
                ["24h notional", formatUsd(selected.volume24h)],
                ["Open interest", formatNumber(selected.openInterest)],
                ["Max leverage", selected.maxLeverage ? `${selected.maxLeverage}×` : "—"],
                ["Min notional", selected.minNotional === null ? "—" : formatUsd(selected.minNotional, false)],
                ["Estimated funding", formatPercent(selected.estimatedFundingRate, { fraction: true, signed: true, digits: 4 })],
                ["Last funding", formatPercent(selected.lastFundingRate, { fraction: true, signed: true, digits: 4 })],
                ["Next funding", selected.nextFundingTime ? formatDateTime(selected.nextFundingTime) : "—"],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-white/[0.04] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wide text-white/30">{label}</div>
                  <div className="mt-1 text-sm font-medium text-white">{value}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 text-sm">
              <span className="text-white/50">Network status</span>
              <Badge tone={selected.status === "active" ? "success" : "warning"}>{selected.status}</Badge>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
