import { useMemo, useState } from "react";
import {
  TrendingUp, Users, CircleDollarSign, Globe2, Repeat, MousePointerClick,
  Gauge, Flame, Sigma,
} from "lucide-react";
import { buildAnalytics , COUNTRIES, TRADE_TOTAL, USER_TOTAL } from "@/admin/mock/data";
import { mulberry32, int, float, fmtNum, fmtUsd } from "@/admin/mock/rng";
import { PageHeader, Badge, AdminButton, Card, StatCard } from "@/admin/components/ui";
import { AreaChart, BarChart, RankedBars, DonutChart } from "@/admin/components/Charts";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { Skeleton, useMockLoading } from "@/admin/components/feedback";
import { getAnalyticsSummary } from "@/admin/analytics";

type MetricKey =
  | "volume" | "revenue" | "users" | "trades" | "fees" | "funding"
  | "openInterest" | "liquidations" | "leverage";

const METRICS: { key: MetricKey; label: string; format: (v: number) => string; color?: string }[] = [
  { key: "volume", label: "Volume", format: (v) => fmtUsd(v) },
  { key: "revenue", label: "Revenue", format: (v) => fmtUsd(v), color: "rgb(var(--oui-color-success))" },
  { key: "users", label: "New users", format: (v) => `${fmtNum(v)}` },
  { key: "trades", label: "Trades", format: (v) => fmtNum(v) },
  { key: "fees", label: "Fees", format: (v) => fmtUsd(v) },
  { key: "funding", label: "Funding paid", format: (v) => fmtUsd(v) },
  { key: "openInterest", label: "Open interest", format: (v) => fmtUsd(v), color: "rgb(var(--oui-color-warning))" },
  { key: "liquidations", label: "Liquidations", format: (v) => fmtUsd(v), color: "rgb(var(--oui-color-danger))" },
  { key: "leverage", label: "Avg leverage", format: (v) => `${v}x` },
];

export default function AdminAnalytics() {
  const loading = useMockLoading(450);
  const [metric, setMetric] = useState<MetricKey>("volume");
  const [range, setRange] = useState(30);

  const series = useMemo(() => buildAnalytics(range), [range]);
  const metricDef = METRICS.find((m) => m.key === metric)!;
  const data = series[metric === "openInterest" ? "openInterest" : metric];

  const totals = useMemo(() => {
    const idx = METRICS.map((m) => m.key);
    return idx.map((k) => ({
      key: k,
      total: (series[k] as number[]).reduce((s, v) => s + v, 0),
    }));
  }, [series]);

  const countries = useMemo(() => {
    const r = mulberry32(616);
    return [...COUNTRIES]
      .map((c) => ({ label: c, value: float(r, 0.5, 14, 1) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, []);

  const topTraders = useMemo(() => {
    const r = mulberry32(717);
    return Array.from({ length: 10 }, (_, i) => ({
      id: `tt_${i}`,
      wallet: `0x${Math.floor(r() * 0xffffff).toString(16).padStart(6, "0")}…${Math.floor(r() * 0xffff).toString(16).padStart(4, "0")}`,
      volume: float(r, 4_000_000, 210_000_000, 0) * (1 - i * 0.07),
      pnl: float(r, -900_000, 4_800_000, 0) * (1 - i * 0.05),
      winRate: float(r, 44, 72, 1),
      trades: int(r, 400, 8600),
    })).sort((a, b) => b.volume - a.volume);
  }, []);

  const topMarkets = useMemo(() => {
    const r = mulberry32(818);
    return ["BTC/USDT", "ETH/USDT", "SOL/USDT", "PEPE/USDT", "DOGE/USDT", "HYPE/USDT"].map((label) => ({
      label,
      value: float(r, 0.4, 9, 2) * 1e8,
    })).sort((a, b) => b.value - a.value);
  }, []);

  const funnel = useMemo(() => {
    const r = mulberry32(919);
    const visitors = int(r, 34000, 52000);
    const signups = Math.round(visitors * float(r, 0.24, 0.32, 3));
    const firstDeposits = Math.round(signups * float(r, 0.44, 0.58, 3));
    const firstTrades = Math.round(firstDeposits * float(r, 0.7, 0.85, 3));
    const active7d = Math.round(firstTrades * float(r, 0.5, 0.72, 3));
    return [
      { label: "Visitors", value: visitors },
      { label: "Signups", value: signups },
      { label: "First deposit", value: firstDeposits },
      { label: "First trade", value: firstTrades },
      { label: "Active (7d)", value: active7d },
    ];
  }, []);

  const local = getAnalyticsSummary();

  const traderCols: Column<(typeof topTraders)[number]>[] = [
    { key: "wallet", label: "Trader", render: (t) => <span className="font-mono text-xs text-white/65">{t.wallet}</span> },
    { key: "vol", label: "Volume", align: "right", sortValue: (t) => t.volume, render: (t) => fmtUsd(t.volume), csvValue: (t) => String(t.volume) },
    {
      key: "pnl", label: "PnL", align: "right", sortValue: (t) => t.pnl,
      render: (t) => <span className={t.pnl >= 0 ? "text-[rgb(var(--oui-color-trading-profit))]" : "text-[rgb(var(--oui-color-trading-loss))]"}>{fmtUsd(t.pnl)}</span>,
    },
    { key: "wr", label: "Win rate", align: "right", sortValue: (t) => t.winRate, render: (t) => `${t.winRate}%` },
    { key: "trades", label: "Trades", align: "right", sortValue: (t) => t.trades, render: (t) => fmtNum(t.trades) },
  ];

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[74px]" />)}</div>
        <Skeleton className="h-72" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Skeleton className="h-64" /><Skeleton className="h-64" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Venue-wide metrics from the mock warehouse. Metric and range selectors reshape every chart."
        actions={
          <div className="flex gap-1 rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                className={`rounded-md px-3 py-1 text-xs font-medium ${range === d ? "bg-[rgba(var(--oui-color-primary),0.2)] text-[rgb(var(--oui-color-primary-light))]" : "text-white/45 hover:text-white/75"}`}
              >
                {d}d
              </button>
            ))}
          </div>
        }
      />

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label={`Volume (${range}d)`} value={fmtUsd(totals.find((t) => t.key === "volume")?.total ?? 0)} />
        <StatCard icon={CircleDollarSign} label={`Revenue (${range}d)`} value={fmtUsd(totals.find((t) => t.key === "revenue")?.total ?? 0)} accent="success" />
        <StatCard icon={Users} label={`New users (${range}d)`} value={fmtNum(totals.find((t) => t.key === "users")?.total ?? 0)} hint={`${fmtNum(USER_TOTAL)} total`} />
        <StatCard icon={Sigma} label={`Trades (${range}d)`} value={fmtNum(totals.find((t) => t.key === "trades")?.total ?? 0)} hint={`${fmtNum(TRADE_TOTAL)} lifetime`} />
      </div>

      {/* Metric explorer */}
      <Card
        title="Metric explorer"
        subtitle="Click a metric to chart it"
        actions={
          <Badge tone="primary">{metricDef.label}</Badge>
        }
      >
        <div className="mb-4 flex flex-wrap gap-1.5">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                metric === m.key
                  ? "border-[rgba(var(--oui-color-primary),0.6)] bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]"
                  : "border-white/10 bg-white/[0.03] text-white/45 hover:text-white/75"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <AreaChart labels={series.labels} data={data as number[]} color={metricDef.color ?? "rgb(var(--oui-color-primary))"} formatValue={metricDef.format} height={260} />
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Retention heatmap */}
        <Card title="Weekly retention" subtitle="Signup cohorts — % still trading">
          <table className="w-full text-center text-[11px]">
            <thead>
              <tr className="text-white/30">
                <th className="pb-1.5 text-left font-medium">Cohort</th>
                {[0, 1, 2, 3, 4, 5].map((w) => <th key={w} className="pb-1.5 font-medium">W{w}</th>)}
              </tr>
            </thead>
            <tbody>
              {series.retention.map((row, i) => (
                <tr key={i}>
                  <td className="py-0.5 pr-2 text-left text-white/40">{`Week ${i + 1}`}</td>
                  {[0, 1, 2, 3, 4, 5].map((w) => {
                    const v = row[w];
                    if (v === undefined) return <td key={w} />;
                    return (
                      <td key={w} className="p-0.5">
                        <span
                          className="inline-block w-full rounded-md py-1.5 text-white"
                          style={{ background: `rgba(var(--oui-color-primary), ${Math.max(0.08, v / 130)})` }}
                        >
                          {v}%
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        {/* Conversion funnel */}
        <Card title="Acquisition funnel" subtitle={`Last ${range} days`}>
          <ul className="space-y-2.5">
            {funnel.map((step, i) => {
              const pct = Math.round((step.value / funnel[0].value) * 100);
              return (
                <li key={step.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-white/60">{i + 1}. {step.label}</span>
                    <span className="font-medium text-white/85">{fmtNum(step.value)} · {pct}%</span>
                  </div>
                  <div className="h-5 overflow-hidden rounded-md bg-white/5">
                    <div
                      className="flex h-full items-center rounded-md bg-gradient-to-r from-[rgb(var(--oui-color-primary-darken))] to-[rgb(var(--oui-color-primary))] pl-2 text-[10px] font-semibold text-white"
                      style={{ width: `${Math.max(8, pct)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Countries */}
        <Card title="Country distribution" subtitle="Share of active traders">
          <DonutChart
            segments={countries.slice(0, 5).map((c) => ({ label: c.label, value: c.value }))}
            centerValue={countries[0].label.slice(0, 2).toUpperCase()}
            centerLabel="top region"
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Top markets" subtitle={`Volume share (${range}d)`}>
          <RankedBars items={topMarkets} formatValue={(v) => fmtUsd(v)} />
        </Card>
        <Card title="Traffic sources" subtitle="Where signups come from">
          <RankedBars
            items={[
              { label: "Organic / Direct", value: 38 },
              { label: "Referral links", value: 27 },
              { label: "Twitter / X", value: 16 },
              { label: "Discord", value: 11 },
              { label: "Paid ads", value: 8 },
            ]}
            formatValue={(v) => `${v}%`}
          />
        </Card>
        <Card title="Liquidations vs volume" subtitle="Risk pulse">
          <BarChart labels={series.labels.slice(-14)} data={series.liquidations.slice(-14)} height={170} color="rgb(var(--oui-color-danger))" formatValue={(v) => fmtUsd(v)} />
        </Card>
      </div>

      {/* Top traders */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
          <Gauge size={15} className="text-[rgb(var(--oui-color-primary-light))]" /> Top traders
        </h2>
        <DataTable tableKey="top-traders" columns={traderCols} rows={topTraders} pageSize={10} emptyTitle="No data" />
      </div>

      {/* Real local analytics */}
      <Card
        title="Real on-device tracking"
        subtitle="Unlike the mock data above, these are visits actually recorded in this browser by the built-in tracker"
        actions={<Badge tone={local.enabled ? "success" : "neutral"}>{local.enabled ? "tracking on" : "tracking off"}</Badge>}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={MousePointerClick} label="Page views (device)" value={local.totalViews} />
          <StatCard icon={Users} label="Unique sessions" value={local.uniqueSessions} />
          <StatCard icon={Repeat} label="Avg views/session" value={local.avgViewsPerSession} />
          <StatCard icon={Flame} label="Views today" value={local.todayViews} />
        </div>
        {local.topPages.length > 0 && (
          <div className="mt-4">
            <RankedBars items={local.topPages.slice(0, 5).map((p) => ({ label: p.path, value: p.views }))} formatValue={(v) => `${v} views`} />
          </div>
        )}
        {!local.externalScriptConfigured && (
          <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-[11px] text-white/40">
            For cross-visitor analytics connect Google Analytics/Plausible via{" "}
            <span className="text-white/70">Config Editor → VITE_ANALYTICS_SCRIPT</span>.
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/30">
          <Globe2 size={11} /> Built-in tracker skips /admin pages and never leaves this browser.
        </div>
      </Card>

      <div className="flex justify-end">
        <AdminButton variant="ghost" className="text-xs" onClick={() => setRange((r) => r)}>
          Refresh
        </AdminButton>
      </div>
    </div>
  );
}
