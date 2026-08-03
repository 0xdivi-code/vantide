import { useMemo, useState } from "react";
import {
  Eye,
  Users,
  MousePointerClick,
  TrendingUp,
  Trash2,
  BarChart3,
  Globe,
  Code2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  clearAnalyticsEvents,
  getAnalyticsSummary,
} from "@/admin/analytics";
import { getRuntimeConfig } from "@/utils/runtime-config";
import {
  Card,
  StatCard,
  Badge,
  AdminButton,
  PageHeader,
  EmptyState,
  FlashBanner,
  useFlashMessage,
  Toggle,
} from "@/admin/components/ui";
import { setAdminOverride, getAdminOverrideValue } from "@/admin/adminStore";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Simple SVG bar chart for daily page views (no chart lib dependency). */
function ViewsChart({
  data,
}: {
  data: { date: string; label: string; views: number; sessions: number }[];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.views));
  const W = 720;
  const H = 200;
  const PAD = 4;
  const barGap = 6;
  const barWidth = Math.max(8, (W - PAD * 2 - barGap * (data.length - 1)) / data.length);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="w-full">
        {/* grid lines */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={H - H * 0.85 * f + 10}
            y2={H - H * 0.85 * f + 10}
            stroke="rgba(255,255,255,0.06)"
            strokeDasharray="3 4"
          />
        ))}
        {data.map((d, i) => {
          const h = Math.max(2, (d.views / max) * (H * 0.85));
          const x = PAD + i * (barWidth + barGap);
          const y = H + 10 - h;
          const active = hover === i;
          return (
            <g
              key={d.date}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: "default" }}
            >
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={h}
                rx={4}
                fill={
                  active
                    ? "rgb(var(--oui-color-primary-light))"
                    : "rgb(var(--oui-color-primary))"
                }
                opacity={d.views === 0 ? 0.15 : active ? 1 : 0.85}
              />
              {(i % 2 === 0 || data.length < 10) && (
                <text
                  x={x + barWidth / 2}
                  y={H + 24}
                  textAnchor="middle"
                  fontSize={10}
                  fill="rgba(255,255,255,0.35)"
                >
                  {d.label}
                </text>
              )}
              {/* invisible hover target */}
              <rect x={x} y={0} width={barWidth} height={H + 10} fill="transparent" />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-6))] px-3 py-1.5 text-xs shadow-lg">
          <span className="font-semibold text-white">{data[hover].label}</span>
          <span className="ml-2 text-white/60">
            {data[hover].views} views · {data[hover].sessions} sessions
          </span>
        </div>
      )}
    </div>
  );
}

export default function AdminAnalytics() {
  const [refreshTick, setRefreshTick] = useState(0);
  const { message, show } = useFlashMessage();

  const enabled =
    (getAdminOverrideValue("VITE_ADMIN_ANALYTICS_ENABLED") ??
      getRuntimeConfig("VITE_ADMIN_ANALYTICS_ENABLED")) !== "false";

  // refreshTick and enabled re-pull the (externally-stored) analytics data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getAnalyticsSummary(), [refreshTick, enabled]);

  const onClear = () => {
    if (
      window.confirm(
        "Delete all locally tracked page-view data? This cannot be undone."
      )
    ) {
      clearAnalyticsEvents();
      setRefreshTick((t) => t + 1);
      show("success", "Analytics data cleared.");
    }
  };

  const onToggleTracking = (value: boolean) => {
    const result = setAdminOverride(
      "VITE_ADMIN_ANALYTICS_ENABLED",
      value ? "true" : "false"
    );
    if (result.ok) {
      show("success", value ? "Tracking enabled." : "Tracking disabled.");
    } else {
      show("error", result.error);
    }
    setRefreshTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Page-view statistics tracked locally in this browser. For cross-user analytics, connect an external analytics script."
        actions={
          <AdminButton variant="danger" onClick={onClear}>
            <Trash2 size={15} />
            Clear data
          </AdminButton>
        }
      />

      <FlashBanner message={message} />

      {!enabled && (
        <div className="rounded-lg border border-[rgba(var(--oui-color-warning),0.35)] bg-[rgba(var(--oui-color-warning),0.08)] px-4 py-3 text-sm text-[rgb(var(--oui-color-warning))]">
          Built-in tracking is currently disabled. New page views are not being
          recorded.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Eye} label="Total page views" value={summary.totalViews} />
        <StatCard
          icon={MousePointerClick}
          label="Views today"
          value={summary.todayViews}
        />
        <StatCard icon={Users} label="Unique sessions" value={summary.uniqueSessions} />
        <StatCard
          icon={TrendingUp}
          label="Avg. views / session"
          value={summary.avgViewsPerSession}
        />
      </div>

      <Card
        title="Page views — last 14 days"
        subtitle="Hover a bar for details"
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/45">Tracking</span>
            <Toggle checked={enabled} onChange={onToggleTracking} />
          </div>
        }
      >
        {summary.totalViews === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No data yet"
            description="Page views are recorded as people browse the dapp on this browser. Visit a few pages and come back."
          />
        ) : (
          <ViewsChart data={summary.daily} />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Top pages" subtitle="Most visited routes">
          {summary.topPages.length === 0 ? (
            <EmptyState icon={Globe} title="Nothing tracked yet" />
          ) : (
            <ul className="space-y-2">
              {summary.topPages.map((page) => {
                const pct = Math.round((page.views / summary.totalViews) * 100);
                return (
                  <li key={page.path}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="max-w-[70%] truncate font-mono text-white/75">
                        {page.path}
                      </span>
                      <span className="text-white/40">
                        {page.views} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-[rgb(var(--oui-color-primary))]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent activity" subtitle="Latest tracked page views">
          {summary.recent.length === 0 ? (
            <EmptyState icon={Eye} title="No events yet" />
          ) : (
            <ul className="divide-y divide-white/5">
              {summary.recent.map((event, i) => (
                <li key={`${event.t}-${i}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate font-mono text-xs text-white/75">
                    {event.p}
                  </span>
                  <span className="shrink-0 text-[11px] text-white/30">
                    {formatTime(event.t)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="External analytics"
        subtitle="Track all visitors, not just this browser"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/50">
              <Code2 size={18} />
            </div>
            <div>
              <div className="text-sm text-white/80">
                Analytics script injection
              </div>
              <div className="text-xs text-white/40">
                {summary.externalScriptConfigured
                  ? "An external analytics script is configured and injected on every page."
                  : "Add Google Analytics, Plausible, etc. via VITE_ANALYTICS_SCRIPT."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge tone={summary.externalScriptConfigured ? "success" : "neutral"}>
              {summary.externalScriptConfigured ? "Configured" : "Not configured"}
            </Badge>
            <Link to="/admin/settings">
              <AdminButton>Configure</AdminButton>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
