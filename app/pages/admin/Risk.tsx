import { useMemo } from "react";
import {
  AlertTriangle,
  BarChart3,
  Gauge,
  Scale,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { usePublicPositions, type PublicPosition } from "@/admin/api/orderly";
import { getRuntimeConfig } from "@/utils/runtime-config";
import {
  formatAge,
  formatDateTime,
  formatNumber,
  formatUsd,
  shortAddress,
} from "@/admin/data/format";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { DonutChart, RankedBars } from "@/admin/components/Charts";
import { Badge, Card, PageHeader, StatCard } from "@/admin/components/ui";
import {
  EmptyDataState,
  LiveDataBar,
  LoadingDataState,
  QueryErrorState,
} from "@/admin/components/LiveDataState";

export default function AdminRisk() {
  const query = usePublicPositions();
  const snapshot = query.data;
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID");

  const exposureByPair = useMemo(() => {
    const totals = new Map<string, number>();
    (snapshot?.positions ?? []).forEach((position) => {
      totals.set(position.symbol, (totals.get(position.symbol) ?? 0) + position.notional);
    });
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8);
  }, [snapshot]);

  const highLeverage = useMemo(
    () =>
      (snapshot?.positions ?? []).filter(
        (position) => (position.leverage ?? 0) >= 50
      ),
    [snapshot]
  );
  const largestPositions = useMemo(
    () => (snapshot?.positions ?? []).slice(0, 20),
    [snapshot]
  );

  const positionColumns: Column<PublicPosition>[] = [
    {
      key: "account",
      label: "Account",
      sortValue: (position) => position.address,
      render: (position) => (
        <div>
          <div className="font-mono text-xs text-white/70">{shortAddress(position.address, 8)}</div>
          <div className="font-mono text-[10px] text-white/30">{shortAddress(position.accountId, 7)}</div>
        </div>
      ),
      csvValue: (position) => position.address,
    },
    {
      key: "symbol",
      label: "Market",
      sortValue: (position) => position.symbol,
      render: (position) => <span className="font-medium text-white">{position.symbol.replace(/^PERP_/, "").replace(/_/g, "/")}</span>,
      csvValue: (position) => position.symbol,
    },
    {
      key: "side",
      label: "Side",
      sortValue: (position) => position.side,
      render: (position) => (
        <Badge tone={position.side === "long" ? "success" : position.side === "short" ? "danger" : "neutral"}>{position.side}</Badge>
      ),
    },
    {
      key: "notional",
      label: "Notional",
      align: "right",
      sortValue: (position) => position.notional,
      render: (position) => formatUsd(position.notional),
      csvValue: (position) => String(position.notional),
    },
    {
      key: "leverage",
      label: "Leverage",
      align: "right",
      sortValue: (position) => position.leverage ?? 0,
      render: (position) =>
        position.leverage === null ? "—" : (
          <span className={position.leverage >= 50 ? "font-semibold text-[rgb(var(--oui-color-warning))]" : "text-white/70"}>{position.leverage}×</span>
        ),
      csvValue: (position) => String(position.leverage ?? ""),
    },
    {
      key: "liquidation",
      label: "Est. liquidation",
      align: "right",
      sortValue: (position) => position.liquidationPrice ?? 0,
      render: (position) => formatUsd(position.liquidationPrice, false),
      csvValue: (position) => String(position.liquidationPrice ?? ""),
    },
    {
      key: "pnl",
      label: "Unrealized PnL",
      align: "right",
      sortValue: (position) => position.unrealizedPnl ?? 0,
      render: (position) => {
        const value = position.unrealizedPnl;
        return <span className={value !== null && value < 0 ? "text-[rgb(var(--oui-color-danger-light))]" : "text-[rgb(var(--oui-color-success))]"}>{formatUsd(value, false)}</span>;
      },
      csvValue: (position) => String(position.unrealizedPnl ?? ""),
    },
    {
      key: "opened",
      label: "Opened",
      sortValue: (position) => position.openedAt ?? 0,
      render: (position) => <span className="text-white/45">{position.openedAt ? formatDateTime(position.openedAt) : "—"}</span>,
      defaultHidden: true,
      csvValue: (position) => String(position.openedAt ?? ""),
    },
  ];

  if (query.isLoading && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Risk Monitor" description="Loading public open-position data from the selected Orderly network." />
        <LoadingDataState />
      </div>
    );
  }

  if (query.error && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Risk Monitor" description="Public positions are fetched live; no generated exposure or liquidation records are shown." />
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const totalLong = snapshot?.totalLongNotional ?? 0;
  const totalShort = snapshot?.totalShortNotional ?? 0;
  const gross = totalLong + totalShort;
  const longShare = gross > 0 ? Math.round((totalLong / gross) * 100) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Risk Monitor"
        description="Live public open-position telemetry. It is a monitoring view only: liquidation controls, insurance funds, and account interventions remain server-authorized operations."
      />
      <LiveDataBar
        source={snapshot?.source || "Orderly public API"}
        updatedAt={snapshot?.fetchedAt}
        refreshing={query.isRefreshing}
        onRefresh={() => void query.refetch()}
      />
      <QueryErrorState error={query.error} onRetry={() => void query.refetch()} compact />

      {!snapshot || snapshot.positions.length === 0 ? (
        <EmptyDataState
          title="No public positions were returned"
          hint="The current network or broker scope has no open positions available to this public endpoint. The panel intentionally does not substitute demo exposures."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Scale} label="Long notional" value={formatUsd(totalLong)} hint={`${longShare}% of reported gross`} accent="success" />
            <StatCard icon={Scale} label="Short notional" value={formatUsd(totalShort)} hint={`${100 - longShare}% of reported gross`} accent="danger" />
            <StatCard icon={BarChart3} label="Open positions" value={formatNumber(snapshot.totalPositions, false)} hint={`${snapshot.positions.length} records fetched`} />
            <StatCard icon={Gauge} label="High leverage" value={highLeverage.length} hint="50× or greater in fetched records" accent={highLeverage.length > 0 ? "warning" : "success"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card title="Long / short mix" subtitle="Reported notional in the public position snapshot">
              <DonutChart
                segments={[
                  { label: `Longs · ${formatUsd(totalLong)}`, value: totalLong, color: "rgb(var(--oui-color-success))" },
                  { label: `Shorts · ${formatUsd(totalShort)}`, value: totalShort, color: "rgb(var(--oui-color-danger))" },
                ]}
                centerValue={`${longShare}%`}
                centerLabel="long"
              />
            </Card>
            <Card title="Exposure by market" subtitle="Largest notional in fetched positions" className="xl:col-span-2">
              <RankedBars items={exposureByPair} formatValue={(value) => formatUsd(value)} />
            </Card>
          </div>

          <Card title="Live signals" subtitle="Computed from the public data returned in this refresh">
            <div className="space-y-2">
              {highLeverage.length > 0 ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(var(--oui-color-warning),0.25)] bg-[rgba(var(--oui-color-warning),0.06)] px-3 py-2.5 text-sm">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[rgb(var(--oui-color-warning))]" />
                  <span className="text-white/65"><strong className="text-white">{highLeverage.length}</strong> fetched position{highLeverage.length === 1 ? " is" : "s are"} at 50× leverage or above.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border border-[rgba(var(--oui-color-success),0.22)] bg-[rgba(var(--oui-color-success),0.06)] px-3 py-2.5 text-sm">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[rgb(var(--oui-color-success))]" />
                  <span className="text-white/65">No fetched position exceeds the 50× monitoring threshold.</span>
                </div>
              )}
              {exposureByPair[0] && (
                <div className="flex items-start gap-2.5 rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0 text-[rgb(var(--oui-color-primary-light))]" />
                  <span className="text-white/65">Largest fetched market concentration: <strong className="text-white">{exposureByPair[0].label}</strong> at {formatUsd(exposureByPair[0].value)}.</span>
                </div>
              )}
            </div>
          </Card>

          <div>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle size={15} className="text-[rgb(var(--oui-color-warning))]" /> Largest open positions
            </h2>
            <DataTable
              tableKey="live-risk-positions"
              columns={positionColumns}
              rows={largestPositions}
              pageSize={10}
              emptyTitle="No live positions"
              initialSortKey="notional"
            />
          </div>
        </>
      )}

      <p className="text-[11px] leading-relaxed text-white/30">
        {brokerId && brokerId !== "demo" ? `Broker scope: ${brokerId}.` : "No broker-specific scope is configured, so the public network snapshot is shown."} Last successful fetch {snapshot ? formatAge(snapshot.fetchedAt) : "—"}.
      </p>
    </div>
  );
}
