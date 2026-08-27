import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CircleDollarSign,
  Clock3,
  MousePointerClick,
  Radio,
  Repeat,
  TrendingUp,
  Users,
} from "lucide-react";
import { useFrontendMarketSnapshot } from "@/admin/api/orderly";
import { getAnalyticsSummary, type AnalyticsSummary } from "@/admin/analytics";
import { formatAge, formatNumber, formatPercent, formatUsd } from "@/admin/data/format";
import { AreaChart, BarChart, RankedBars } from "@/admin/components/Charts";
import { Badge, Card, PageHeader, StatCard } from "@/admin/components/ui";
import {
  EmptyDataState,
  LiveDataBar,
  LoadingDataState,
  QueryErrorState,
} from "@/admin/components/LiveDataState";

function useLocalAnalytics(): [AnalyticsSummary, () => void] {
  const [summary, setSummary] = useState<AnalyticsSummary>(() => getAnalyticsSummary());
  const refresh = useCallback(() => setSummary(getAnalyticsSummary()), []);

  useEffect(() => {
    // Keep the on-device dashboard current while the operator has this route
    // open. These are real page-view events emitted by AnalyticsTracker.
    const timer = globalThis.setInterval(refresh, 10_000);
    return () => globalThis.clearInterval(timer);
  }, [refresh]);

  return [summary, refresh];
}

export default function AdminAnalytics() {
  const marketQuery = useFrontendMarketSnapshot();
  const snapshot = marketQuery.data;
  const [local, refreshLocal] = useLocalAnalytics();

  const volumeBars = useMemo(
    () =>
      (snapshot?.markets ?? []).slice(0, 12).map((market) => ({
        label: `${market.displayName}/${market.quote}`,
        value: market.volume24h,
      })),
    [snapshot]
  );
  const fundingRows = useMemo(
    () =>
      [...(snapshot?.markets ?? [])]
        .filter((market) => market.estimatedFundingRate !== null)
        .sort(
          (left, right) =>
            Math.abs(right.estimatedFundingRate ?? 0) -
            Math.abs(left.estimatedFundingRate ?? 0)
        )
        .slice(0, 8),
    [snapshot]
  );
  const averageFunding = fundingRows.length
    ? fundingRows.reduce(
        (sum, market) => sum + (market.estimatedFundingRate ?? 0),
        0
      ) / fundingRows.length
    : null;

  if (marketQuery.isLoading && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Analytics" description="Loading live market and on-device frontend analytics." />
        <LoadingDataState />
      </div>
    );
  }

  if (marketQuery.error && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Analytics" description="Live analytics are sourced from the selected Orderly network." />
        <QueryErrorState error={marketQuery.error} onRetry={() => void marketQuery.refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Real-time market metrics plus the frontend activity recorded in this browser. Historical and cross-user metrics are intentionally not fabricated."
      />
      <LiveDataBar
        source={snapshot?.source || "Orderly public API"}
        updatedAt={snapshot?.fetchedAt}
        refreshing={marketQuery.isRefreshing}
        onRefresh={() => {
          void marketQuery.refetch();
          refreshLocal();
        }}
      />
      <QueryErrorState error={marketQuery.error} onRetry={() => void marketQuery.refetch()} compact />

      {!snapshot || snapshot.markets.length === 0 ? (
        <EmptyDataState
          title="No market analytics are available"
          hint="The live endpoint did not return any symbols enabled in this frontend. No placeholder charts are displayed."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="24h market notional"
              value={formatUsd(snapshot.total24hVolume)}
              hint="Across frontend symbols"
            />
            <StatCard
              icon={CircleDollarSign}
              label="Reported total OI"
              value={formatNumber(snapshot.totalOpenInterest)}
              hint="Aggregate returned by the market feed"
              accent="success"
            />
            <StatCard
              icon={BarChart3}
              label="Markets reporting"
              value={snapshot.markets.length}
              hint={`${snapshot.markets.filter((market) => market.status === "active").length} active`}
            />
            <StatCard
              icon={Radio}
              label="Average est. funding"
              value={formatPercent(averageFunding, { fraction: true, signed: true, digits: 4 })}
              hint={`${fundingRows.length} live rates`}
              accent="warning"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card title="Market volume distribution" subtitle="Current 24-hour quote notional" className="xl:col-span-2">
              <BarChart
                labels={volumeBars.map((row) => row.label)}
                data={volumeBars.map((row) => row.value)}
                height={260}
                formatValue={(value) => formatUsd(value)}
              />
            </Card>
            <Card title="Top markets" subtitle="Ranked by current 24h notional">
              <RankedBars items={volumeBars.slice(0, 7)} formatValue={(value) => formatUsd(value)} />
            </Card>
          </div>

          <Card title="Funding monitor" subtitle="Largest absolute estimated funding rates in the current live snapshot">
            {fundingRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">No funding rates were returned for the enabled markets.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                {fundingRows.map((market) => {
                  const rate = market.estimatedFundingRate ?? 0;
                  const positive = rate >= 0;
                  return (
                    <div key={market.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-white">{market.displayName}/{market.quote}</span>
                        <Badge tone={positive ? "success" : "danger"}>{positive ? "positive" : "negative"}</Badge>
                      </div>
                      <div className={`mt-2 text-lg font-bold ${positive ? "text-[rgb(var(--oui-color-success))]" : "text-[rgb(var(--oui-color-danger-light))]"}`}>
                        {formatPercent(rate, { fraction: true, signed: true, digits: 4 })}
                      </div>
                      <div className="mt-1 text-[11px] text-white/35">Mark {formatUsd(market.markPrice, false)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <Card
        title="Frontend activity on this device"
        subtitle="Actual page views collected locally by the built-in tracker; admin routes are excluded and no event leaves this browser."
        actions={<Badge tone={local.enabled ? "success" : "neutral"}>{local.enabled ? "tracking on" : "tracking off"}</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={MousePointerClick} label="Page views" value={local.totalViews} />
          <StatCard icon={Users} label="Unique sessions" value={local.uniqueSessions} />
          <StatCard icon={Repeat} label="Views / session" value={local.avgViewsPerSession} />
          <StatCard icon={Clock3} label="Views today" value={local.todayViews} accent="success" />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/35">Views by day</h3>
            <AreaChart
              labels={local.daily.map((bucket) => bucket.label)}
              data={local.daily.map((bucket) => bucket.views)}
              height={160}
              formatValue={(value) => `${value} view${value === 1 ? "" : "s"}`}
            />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/35">Most visited routes</h3>
            {local.topPages.length > 0 ? (
              <RankedBars
                items={local.topPages.map((page) => ({ label: page.path, value: page.views }))}
                formatValue={(value) => `${value} view${value === 1 ? "" : "s"}`}
              />
            ) : (
              <p className="rounded-xl bg-white/[0.03] p-5 text-center text-xs text-white/35">Browse the frontend to start collecting local activity.</p>
            )}
          </div>
        </div>
        <p className="mt-4 text-[11px] text-white/30">
          {local.firstTrackedAt ? `First local event ${formatAge(local.firstTrackedAt)}.` : "No local event has been recorded yet."} For cross-visitor analytics, serve authorized aggregates from the configured admin API.
        </p>
      </Card>
    </div>
  );
}
