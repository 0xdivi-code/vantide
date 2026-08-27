import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Search, Users } from "lucide-react";
import { isAdminApiConfigured } from "@/admin/api/client";
import { usePublicTraders, type PublicTrader } from "@/admin/api/orderly";
import { formatNumber, formatPercent, formatUsd, shortAddress } from "@/admin/data/format";
import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { Badge, Card, PageHeader, StatCard, TextInput } from "@/admin/components/ui";
import {
  EmptyDataState,
  LiveDataBar,
  LoadingDataState,
  QueryErrorState,
} from "@/admin/components/LiveDataState";

function PublicTradersPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const query = usePublicTraders();
  const snapshot = query.data;
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!snapshot) return [];
    return snapshot.rows.filter(
      (trader) =>
        !needle ||
        [trader.address, trader.brokerId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(needle)
    );
  }, [search, snapshot]);

  const columns: Column<PublicTrader>[] = [
    {
      key: "address",
      label: "Trader address",
      sortValue: (trader) => trader.address,
      render: (trader) => (
        <div>
          <div className="font-mono text-xs font-medium text-white">{shortAddress(trader.address, 9)}</div>
          <div className="mt-0.5 text-[10px] text-white/30">{trader.brokerId || "public network"}</div>
        </div>
      ),
      csvValue: (trader) => trader.address,
    },
    {
      key: "volume30d",
      label: "30d volume",
      align: "right",
      sortValue: (trader) => trader.volume30d,
      render: (trader) => formatUsd(trader.volume30d),
      csvValue: (trader) => String(trader.volume30d),
    },
    {
      key: "volume24h",
      label: "24h volume",
      align: "right",
      sortValue: (trader) => trader.volume24h,
      render: (trader) => formatUsd(trader.volume24h),
      csvValue: (trader) => String(trader.volume24h),
    },
    {
      key: "pnl30d",
      label: "30d PnL",
      align: "right",
      sortValue: (trader) => trader.pnl30d ?? 0,
      render: (trader) => (
        <span className={trader.pnl30d !== null && trader.pnl30d < 0 ? "text-[rgb(var(--oui-color-danger-light))]" : "text-[rgb(var(--oui-color-success))]"}>
          {formatUsd(trader.pnl30d, false)}
        </span>
      ),
      csvValue: (trader) => String(trader.pnl30d ?? ""),
    },
    {
      key: "trades",
      label: "24h trades",
      align: "right",
      sortValue: (trader) => trader.tradeCount24h,
      render: (trader) => formatNumber(trader.tradeCount24h, false),
      csvValue: (trader) => String(trader.tradeCount24h),
    },
    {
      key: "win-rate",
      label: "30d win rate",
      align: "right",
      sortValue: (trader) => trader.winRate30d ?? 0,
      render: (trader) => formatPercent(trader.winRate30d, { fraction: true }),
      csvValue: (trader) => String(trader.winRate30d ?? ""),
    },
    {
      key: "positions",
      label: "Open positions",
      align: "right",
      sortValue: (trader) => trader.positionCount,
      render: (trader) => trader.positionCount,
      csvValue: (trader) => String(trader.positionCount),
    },
  ];

  if (query.isLoading && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Public Trader Activity" description="Loading live trader leaderboard data from the trading network." />
        <LoadingDataState />
      </div>
    );
  }

  if (query.error && !snapshot) {
    return (
      <div className="space-y-5">
        <PageHeader title="Public Trader Activity" description="No placeholder accounts are shown when the live data source is unavailable." />
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }

  const totalVolume = (snapshot?.rows ?? []).reduce(
    (total, trader) => total + trader.volume30d,
    0
  );
  const totalPositions = (snapshot?.rows ?? []).reduce(
    (total, trader) => total + trader.positionCount,
    0
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Public Trader Activity"
        description="Live public trader rankings from Orderly. Wallet addresses and market statistics are available without inventing user profiles, email addresses, KYC status, or balances."
      />
      <LiveDataBar
        source={snapshot?.source || "Orderly public API"}
        updatedAt={snapshot?.lastUpdatedAt ?? snapshot?.fetchedAt}
        refreshing={query.isRefreshing}
        onRefresh={() => void query.refetch()}
      />
      <QueryErrorState error={query.error} onRetry={() => void query.refetch()} compact />

      {!snapshot || snapshot.rows.length === 0 ? (
        <EmptyDataState
          title="No public trader records were returned"
          hint="The public leaderboard may be empty or temporarily unavailable on the selected network. Connect an authorized admin API to load private customer records."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Users} label="Public traders returned" value={snapshot.rows.length} hint="Current leaderboard page" />
            <StatCard icon={BarChart3} label="Combined 30d volume" value={formatUsd(totalVolume)} hint="Across returned traders" accent="success" />
            <StatCard icon={Users} label="Open positions" value={formatNumber(totalPositions, false)} hint="Reported by public leaderboard" />
            <StatCard icon={BarChart3} label="Top 30d volume" value={formatUsd(snapshot.rows[0]?.volume30d ?? 0)} hint={shortAddress(snapshot.rows[0]?.address, 7)} accent="warning" />
          </div>

          <Card>
            <label className="relative block max-w-md">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter by wallet or broker ID…"
                className="pl-9"
              />
            </label>
            <p className="mt-2 text-[11px] text-white/35">Select a wallet to inspect its live public account state and positions.</p>
          </Card>

          <DataTable
            tableKey="live-public-traders"
            columns={columns}
            rows={rows}
            onRowClick={(trader) => navigate(`/admin/users/${encodeURIComponent(trader.address)}`)}
            emptyTitle="No trader matches this filter"
            emptyHint="Try a partial wallet address or clear the filter."
            initialSortKey="volume30d"
          />
        </>
      )}

      <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-white/45">
        Need customer identity, KYC, account controls, or broker-private history? Configure <code className="font-mono text-white/70">VITE_ADMIN_API_URL</code> to switch this route to your authenticated backend data source.
      </p>
    </div>
  );
}

export default function AdminUsers() {
  if (isAdminApiConfigured()) {
    return (
      <AdminResourcePage
        resource="users"
        title="User Management"
        description="Live user records fetched from your authenticated admin API."
      />
    );
  }
  return <PublicTradersPage />;
}
