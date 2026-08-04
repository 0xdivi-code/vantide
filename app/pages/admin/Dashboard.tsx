import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowDownUp,
  ArrowUpRight,
  Coins,
  Flame,
  Landmark,
  TrendingUp,
  UserPlus,
  Users,
  Activity,
  Receipt,
  Percent,
  Package,
  BellRing,
  CircleDot,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { buildAnalytics, nextActivity, USER_TOTAL, TRADE_TOTAL } from "@/admin/mock/data";
import { fmtNum, fmtUsd, timeAgo } from "@/admin/mock/rng";
import type { ActivityEvent } from "@/admin/mock/types";
import { Card, Badge, AdminButton, PageHeader } from "@/admin/components/ui";
import { AreaChart, BarChart, RankedBars, Sparkline } from "@/admin/components/Charts";
import { Skeleton, useMockLoading } from "@/admin/components/feedback";
import { useMockApiVersion } from "@/admin/mock/api";

function Kpi({
  icon: IconCmp,
  label,
  value,
  delta,
  spark,
  tone = "primary",
}: {
  icon: React.ComponentType<{ size?: number | string }>;
  label: string;
  value: string;
  delta?: string;
  spark?: number[];
  tone?: "primary" | "success" | "danger" | "warning";
}) {
  const tones = {
    primary: "bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]",
    success: "bg-[rgba(var(--oui-color-success),0.15)] text-[rgb(var(--oui-color-success))]",
    danger: "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger-light))]",
    warning: "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] px-4 py-3.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <IconCmp size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] text-white/40">{label}</div>
        <div className="truncate text-lg font-bold leading-tight text-white">{value}</div>
        {delta && <div className="text-[10px] text-[rgb(var(--oui-color-success))]">{delta}</div>}
      </div>
      {spark && (
        <Sparkline
          data={spark}
          width={72}
          height={26}
          color={tone === "danger" ? "rgb(var(--oui-color-danger))" : "rgb(var(--oui-color-primary))"}
        />
      )}
    </div>
  );
}

const ACTIVITY_ICON: Record<ActivityEvent["kind"], { icon: React.ComponentType<{ size?: number | string }>; cls: string }> = {
  new_user: { icon: UserPlus, cls: "bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]" },
  new_position: { icon: TrendingUp, cls: "bg-[rgba(var(--oui-color-success),0.15)] text-[rgb(var(--oui-color-success))]" },
  liquidation: { icon: Flame, cls: "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger-light))]" },
  deposit: { icon: ArrowDownLeft, cls: "bg-[rgba(var(--oui-color-success),0.15)] text-[rgb(var(--oui-color-success))]" },
  withdrawal: { icon: ArrowUpRight, cls: "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]" },
  alert: { icon: BellRing, cls: "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]" },
};

export default function AdminDashboard() {
  useMockApiVersion();
  const loading = useMockLoading(500);
  const [live, setLive] = useState(true);
  const [events, setEvents] = useState<ActivityEvent[]>(() =>
    Array.from({ length: 8 }, (_, i) => {
      const e = nextActivity(i);
      e.ts = Date.now() - (8 - i) * 70_000;
      return e;
    })
  );

  // Simulated realtime feed (replaces WebSocket in this mock build)
  useEffect(() => {
    if (!live) return;
    let i = 100;
    const t = setInterval(() => {
      setEvents((ev) => [nextActivity(i++), ...ev].slice(0, 14));
    }, 9000);
    return () => clearInterval(t);
  }, [live]);

  const analytics = useMemo(() => buildAnalytics(30), []);

  const stats = useMemo(() => {
    const trades = db.trades.all();
    const liqs = db.liquidations.all();
    const dayAgo = Date.now() - 86_400_000;
    const volume24h = trades.filter((t) => t.ts > dayAgo).reduce((s, t) => s + t.size, 0);
    const fees24h = trades.filter((t) => t.ts > dayAgo).reduce((s, t) => s + t.fee, 0);
    const liqsToday = liqs.filter((l) => l.ts > dayAgo);
    const fundingPaid = db.funding.all().filter((f) => f.ts > dayAgo).reduce((s, f) => s + f.paid, 0);
    const treasury = db.wallets.all().reduce((s, w) => s + w.balance, 0);
    const ordersToday = db.orders.all().filter((o) => o.ts > dayAgo).length;
    const activeTraders = new Set(trades.filter((t) => t.ts > dayAgo).map((t) => t.wallet)).size;
    return {
      volume24h: volume24h * 8421, // scale to venue level
      fees24h: fees24h * 8421,
      revenue: fees24h * 8421 * 0.42,
      treasury,
      liqsTodayCount: liqsToday.length * 37,
      liqsTodayUsd: liqsToday.reduce((s, l) => s + l.loss, 0) * 37,
      fundingPaid: fundingPaid * 120,
      ordersToday: ordersToday * 511,
      activeTraders: activeTraders * 311,
      tradesToday: Math.round(TRADE_TOTAL / 365 / 8),
    };
  }, []);

  const topPairs = useMemo(() => {
    const vol = new Map<string, number>();
    db.trades.all().forEach((t) => vol.set(t.pair, (vol.get(t.pair) || 0) + t.size));
    return [...vol.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-[74px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exchange Overview"
        description="Venue-wide metrics. Mock data — refreshed a few seconds ago."
        actions={
          <>
            <Link to="/admin/pairs?new=1">
              <AdminButton variant="primary">
                <Coins size={15} /> New pair
              </AdminButton>
            </Link>
            <Link to="/admin/notifications">
              <AdminButton>
                <BellRing size={15} /> Broadcast
              </AdminButton>
            </Link>
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi icon={Activity} label="Daily Volume" value={fmtUsd(stats.volume24h)} delta="+12.4% vs yesterday" spark={analytics.volume.slice(-14)} />
        <Kpi icon={Landmark} label="Treasury Balance" value={fmtUsd(stats.treasury)} tone="success" delta="+3.1% this week" />
        <Kpi icon={Receipt} label="Platform Revenue (24h)" value={fmtUsd(stats.revenue)} delta="+8.9%" spark={analytics.revenue.slice(-14)} />
        <Kpi icon={Users} label="Total Users" value={fmtNum(USER_TOTAL)} delta="+412 today" spark={analytics.users.slice(-14)} />
        <Kpi icon={TrendingUp} label="Active Traders (24h)" value={fmtNum(stats.activeTraders)} tone="warning" />
        <Kpi icon={Package} label="Orders Today" value={fmtNum(stats.ordersToday)} />
        <Kpi icon={ArrowDownUp} label="Trades Today" value={fmtNum(stats.tradesToday)} spark={analytics.trades.slice(-14)} />
        <Kpi icon={Flame} label="Liquidations Today" value={`${fmtNum(stats.liqsTodayCount)} · ${fmtUsd(stats.liqsTodayUsd)}`} tone="danger" />
        <Kpi icon={Percent} label="Funding Paid (24h)" value={fmtUsd(stats.fundingPaid)} />
        <Kpi icon={Coins} label="Fees Generated (24h)" value={fmtUsd(stats.fees24h)} delta="+6.2%" />
      </div>

      {/* Main charts */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Volume" subtitle="Last 30 days" className="xl:col-span-2">
          <AreaChart
            labels={analytics.labels}
            data={analytics.volume}
            formatValue={(v) => fmtUsd(v)}
          />
        </Card>
        <Card title="Trading Pair Volume" subtitle="Top markets (30d)">
          <RankedBars items={topPairs} formatValue={(v) => fmtUsd(v)} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="User Growth" subtitle="New signups / day">
          <AreaChart labels={analytics.labels} data={analytics.users} height={140} formatValue={(v) => `${fmtNum(v)} users`} />
        </Card>
        <Card title="Revenue" subtitle="Fees captured / day">
          <AreaChart labels={analytics.labels} data={analytics.revenue} height={140} color="rgb(var(--oui-color-success))" formatValue={(v) => fmtUsd(v)} />
        </Card>
        <Card title="Open Interest" subtitle="Venue-wide">
          <AreaChart labels={analytics.labels} data={analytics.openInterest} height={140} color="rgb(var(--oui-color-warning))" formatValue={(v) => fmtUsd(v)} />
        </Card>
        <Card title="Liquidations" subtitle="$ liquidated / day">
          <BarChart labels={analytics.labels} data={analytics.liquidations} height={140} color="rgb(var(--oui-color-danger))" formatValue={(v) => fmtUsd(v)} />
        </Card>
      </div>

      {/* Activity feed + quick links */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card
          title="Live Activity"
          subtitle="New users, positions, liquidations, deposits, withdrawals & alerts"
          className="xl:col-span-2"
          actions={
            <button
              onClick={() => setLive((l) => !l)}
              className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80"
            >
              <CircleDot size={12} className={`admin-live-dot ${live ? "text-[rgb(var(--oui-color-success))]" : "text-white/30"}`} />
              {live ? "Live" : "Paused"}
            </button>
          }
        >
          <ul className="divide-y divide-white/5">
            {events.map((e) => {
              const meta = ACTIVITY_ICON[e.kind];
              return (
                <li key={e.id} className="flex items-center gap-3 py-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.cls}`}>
                    <meta.icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-white/75">{e.text}</span>
                  {e.amount !== undefined && (
                    <span className="shrink-0 text-sm font-medium text-white/85">{fmtUsd(e.amount)}</span>
                  )}
                  <span className="w-16 shrink-0 text-right text-[11px] text-white/30">{timeAgo(e.ts)}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="Quick Actions" subtitle="Jump straight into a workflow">
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { to: "/admin/pairs?new=1", label: "List new pair", icon: Coins },
              { to: "/admin/users", label: "Manage users", icon: Users },
              { to: "/admin/funding", label: "Approvals", icon: ArrowDownUp },
              { to: "/admin/kyc", label: "KYC queue", icon: BellRing },
              { to: "/admin/treasury", label: "Treasury", icon: Landmark },
              { to: "/admin/notifications", label: "Notify users", icon: Receipt },
            ].map((a) => (
              <Link key={a.label} to={a.to}>
                <div className="flex h-full flex-col items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-colors hover:border-[rgba(var(--oui-color-primary),0.5)] hover:bg-[rgba(var(--oui-color-primary),0.08)]">
                  <a.icon size={16} className="text-[rgb(var(--oui-color-primary-light))]" />
                  <span className="text-xs font-medium text-white/80">{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-white/5 px-3 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">System status</span>
              <Badge tone="success">All systems operational</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-white/50">Pending approvals</span>
              <span className="font-medium text-white">
                {db.withdrawals.all().filter((w) => w.status === "pending").length} withdrawals ·{" "}
                {db.transfers.all().filter((t) => t.status === "pending").length} transfers ·{" "}
                {db.kyc.all().filter((k) => k.status === "pending").length} KYC
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
