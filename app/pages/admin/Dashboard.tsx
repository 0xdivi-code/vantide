import { Link } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Coins,
  Gauge,
  Landmark,
  Radio,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Waves,
} from "lucide-react";
import { useFrontendMarketSnapshot, type FrontendMarket } from "@/admin/api/orderly";
import {
  formatAge,
  formatNumber,
  formatPercent,
  formatUsd,
} from "@/admin/data/format";
import { Badge, AdminButton, Card, PageHeader, StatCard } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import {
  EmptyDataState,
  LiveDataBar,
  LoadingDataState,
  QueryErrorState,
} from "@/admin/components/LiveDataState";
import { RankedBars } from "@/admin/components/Charts";

function marketLabel(market: FrontendMarket): string {
  return `${market.displayName}/${market.quote}`;
}

export default function AdminDashboard() {
  const query = useFrontendMarketSnapshot();
  const snapshot = query.data;

  if (query.isLoading && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Exchange Overview" description="Loading live data for the markets configured in this frontend." />
        <LoadingDataState />
      </div>
    );
  }

  if (query.error && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Exchange Overview" description="Live market data is fetched from the same Orderly network as the trading frontend." />
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  if (!snapshot || snapshot.markets.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="Exchange Overview" description="Live market data for the symbols enabled in the frontend." />
        <LiveDataBar
          source={snapshot?.source || "Orderly public API"}
          updatedAt={snapshot?.fetchedAt}
          refreshing={query.isRefreshing}
          onRefresh={() => void query.refetch()}
        />
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} compact />
        <EmptyDataState
          title="No enabled markets were returned"
          hint="Check VITE_SYMBOL_LIST and the selected Orderly network. The dashboard intentionally does not substitute demo market records."
          action={
            <Link to="/admin/settings">
              <AdminButton>Open frontend settings</AdminButton>
            </Link>
          }
        />
      </div>
    );
  }

  const activeMarkets = snapshot.markets.filter((market) => market.status === "active");
  const topVolume = snapshot.markets[0];
  const topOpenInterest = [...snapshot.markets].sort(
    (left, right) => right.openInterest - left.openInterest
  )[0];
  const fundingMarkets = snapshot.markets.filter(
    (market) => market.estimatedFundingRate !== null
  );
  const averageFunding = fundingMarkets.length
    ? fundingMarkets.reduce(
        (sum, market) => sum + (market.estimatedFundingRate ?? 0),
        0
      ) / fundingMarkets.length
    : null;
  const marketColumns: Column<FrontendMarket>[] = [
    {
      key: "market",
      label: "Market",
      sortValue: (market) => market.symbol,
      render: (market) => (
        <div>
          <div className="font-medium text-white">{marketLabel(market)}</div>
          <div className="font-mono text-[10px] text-white/30">{market.symbol}</div>
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
      label: "24h",
      align: "right",
      sortValue: (market) => market.change24h ?? 0,
      render: (market) => {
        const positive = (market.change24h ?? 0) >= 0;
        return (
          <span className={positive ? "text-[rgb(var(--oui-color-success))]" : "text-[rgb(var(--oui-color-danger-light))]"}>
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
      key: "open-interest",
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
      key: "status",
      label: "Status",
      sortValue: (market) => market.status,
      render: (market) => (
        <Badge tone={market.status === "active" ? "success" : "warning"}>{market.status}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Exchange Overview"
        description="Live market telemetry for the same symbols and network used by the trading frontend. Refreshes automatically without locally generated demo records."
        actions={
          <Link to="/admin/pairs">
            <AdminButton variant="primary">
              <Coins size={15} /> View live markets
            </AdminButton>
          </Link>
        }
      />
      <LiveDataBar
        source={snapshot.source}
        updatedAt={snapshot.fetchedAt}
        refreshing={query.isRefreshing}
        onRefresh={() => void query.refetch()}
      />
      <QueryErrorState error={query.error} onRetry={() => void query.refetch()} compact />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={BarChart3}
          label="24h market notional"
          value={formatUsd(snapshot.total24hVolume)}
          hint={`${formatNumber(snapshot.markets.length, false)} frontend markets`}
        />
        <StatCard
          icon={Landmark}
          label="Reported total OI"
          value={formatNumber(snapshot.totalOpenInterest)}
          hint="Aggregate returned by the market feed"
          accent="success"
        />
        <StatCard
          icon={Activity}
          label="Active markets"
          value={`${activeMarkets.length}/${snapshot.markets.length}`}
          hint={activeMarkets.length === snapshot.markets.length ? "All returned as active" : "Review non-active symbols"}
          accent={activeMarkets.length === snapshot.markets.length ? "success" : "warning"}
        />
        <StatCard
          icon={Coins}
          label="Highest 24h volume"
          value={topVolume ? marketLabel(topVolume) : "—"}
          hint={topVolume ? formatUsd(topVolume.volume24h) : undefined}
          accent="primary"
        />
        <StatCard
          icon={Waves}
          label="Average est. funding"
          value={formatPercent(averageFunding, { fraction: true, signed: true, digits: 4 })}
          hint={`${fundingMarkets.length} market${fundingMarkets.length === 1 ? "" : "s"} reporting`}
          accent="warning"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="24h volume by market"
          subtitle="Real quote notional returned by the live market feed"
          className="xl:col-span-2"
        >
          <RankedBars
            items={snapshot.markets.slice(0, 10).map((market) => ({
              label: marketLabel(market),
              value: market.volume24h,
            }))}
            formatValue={(value) => formatUsd(value)}
          />
        </Card>
        <Card title="Live market pulse" subtitle="Calculated from the latest frontend market snapshot">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm">
              <span className="flex items-center gap-2 text-white/55">
                <Radio size={14} className="admin-live-dot text-[rgb(var(--oui-color-success))]" /> Feed status
              </span>
              <Badge tone={query.error ? "warning" : "success"}>{query.error ? "Last snapshot" : "Connected"}</Badge>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
              <span className="text-white/45">Largest open interest</span>
              <span className="font-medium text-white">{topOpenInterest ? marketLabel(topOpenInterest) : "—"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
              <span className="text-white/45">Open interest value</span>
              <span className="font-medium text-white">{topOpenInterest ? formatNumber(topOpenInterest.openInterest) : "—"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
              <span className="text-white/45">Configured symbols</span>
              <span className="font-medium text-white">
                {snapshot.configuredSymbolCount > 0 ? snapshot.configuredSymbolCount : "All available"}
              </span>
            </div>
            <p className="pt-1 text-[11px] leading-relaxed text-white/35">
              Snapshot received {formatAge(snapshot.fetchedAt)}. Private user, treasury, and approval metrics are intentionally not inferred from public market data.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Enabled frontend markets"
        subtitle="Click a row to inspect the market in the Trading Pairs view. Values update from the public Orderly market feed."
        actions={
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isRefreshing}
            className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white disabled:opacity-50"
          >
            <RefreshCw size={12} className={query.isRefreshing ? "animate-spin" : ""} />
            Refresh now
          </button>
        }
      >
        <DataTable
          tableKey="live-dashboard-markets"
          columns={marketColumns}
          rows={snapshot.markets}
          emptyTitle="No live markets"
          initialSortKey="volume"
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link to="/admin/pairs" className="group">
          <Card className="h-full transition-colors group-hover:border-[rgba(var(--oui-color-primary),0.5)]">
            <div className="flex items-center gap-3">
              <Gauge size={19} className="text-[rgb(var(--oui-color-primary-light))]" />
              <div>
                <div className="text-sm font-semibold text-white">Inspect every live market</div>
                <p className="mt-0.5 text-xs text-white/45">Prices, funding, limits, and current market status.</p>
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/admin/risk" className="group">
          <Card className="h-full transition-colors group-hover:border-[rgba(var(--oui-color-primary),0.5)]">
            <div className="flex items-center gap-3">
              {averageFunding !== null && averageFunding < 0 ? (
                <TrendingDown size={19} className="text-[rgb(var(--oui-color-danger-light))]" />
              ) : (
                <TrendingUp size={19} className="text-[rgb(var(--oui-color-success))]" />
              )}
              <div>
                <div className="text-sm font-semibold text-white">Review public risk exposure</div>
                <p className="mt-0.5 text-xs text-white/45">Live open positions when exposed by the selected Orderly network.</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}
