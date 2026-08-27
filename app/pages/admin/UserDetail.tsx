import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CircleDollarSign,
  Gauge,
  Layers3,
  Radio,
  Wallet,
} from "lucide-react";
import { isAdminApiConfigured } from "@/admin/api/client";
import {
  usePublicAccount,
  type PublicAccount,
  type PublicAccountPosition,
} from "@/admin/api/orderly";
import {
  formatDateTime,
  formatPercent,
  formatUsd,
  shortAddress,
} from "@/admin/data/format";
import { AdminResourcePage } from "@/admin/components/RemoteResourcePage";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { Badge, Card, PageHeader, StatCard } from "@/admin/components/ui";
import {
  EmptyDataState,
  LiveDataBar,
  LoadingDataState,
  QueryErrorState,
} from "@/admin/components/LiveDataState";

interface DetailPosition extends PublicAccountPosition {
  accountLabel: string;
}

function PublicAccountPage({ address }: { address: string }) {
  const query = usePublicAccount(address);
  const accounts = query.data;
  const positions = useMemo<DetailPosition[]>(
    () =>
      (accounts ?? []).flatMap((account) =>
        account.positions.map((position) => ({
          ...position,
          id: `${account.id}-${position.id}`,
          accountLabel: account.accountType || shortAddress(account.accountId, 6),
        }))
      ),
    [accounts]
  );
  const totals = useMemo(
    () => ({
      accountValue: (accounts ?? []).reduce((sum, account) => sum + (account.accountValue ?? 0), 0),
      collateral: (accounts ?? []).reduce((sum, account) => sum + (account.collateralValue ?? 0), 0),
      freeCollateral: (accounts ?? []).reduce((sum, account) => sum + (account.freeCollateral ?? 0), 0),
      pnl24h: (accounts ?? []).reduce((sum, account) => sum + (account.pnl24h ?? 0), 0),
    }),
    [accounts]
  );
  const columns: Column<DetailPosition>[] = [
    {
      key: "symbol",
      label: "Market",
      sortValue: (position) => position.symbol,
      render: (position) => <span className="font-medium text-white">{position.symbol.replace(/^PERP_/, "").replace(/_/g, "/")}</span>,
      csvValue: (position) => position.symbol,
    },
    {
      key: "account",
      label: "Account",
      sortValue: (position) => position.accountLabel,
      render: (position) => <span className="text-white/60">{position.accountLabel}</span>,
    },
    {
      key: "side",
      label: "Side",
      sortValue: (position) => position.side,
      render: (position) => <Badge tone={position.side === "long" ? "success" : position.side === "short" ? "danger" : "neutral"}>{position.side}</Badge>,
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
      key: "entry",
      label: "Entry price",
      align: "right",
      sortValue: (position) => position.averageOpenPrice ?? 0,
      render: (position) => formatUsd(position.averageOpenPrice, false),
      csvValue: (position) => String(position.averageOpenPrice ?? ""),
    },
    {
      key: "mark",
      label: "Mark price",
      align: "right",
      sortValue: (position) => position.markPrice ?? 0,
      render: (position) => formatUsd(position.markPrice, false),
      csvValue: (position) => String(position.markPrice ?? ""),
    },
    {
      key: "leverage",
      label: "Leverage",
      align: "right",
      sortValue: (position) => position.leverage ?? 0,
      render: (position) => (position.leverage === null ? "—" : `${position.leverage}×`),
      csvValue: (position) => String(position.leverage ?? ""),
    },
    {
      key: "pnl",
      label: "Unrealized PnL",
      align: "right",
      sortValue: (position) => position.unrealizedPnl ?? 0,
      render: (position) => <span className={position.unrealizedPnl !== null && position.unrealizedPnl < 0 ? "text-[rgb(var(--oui-color-danger-light))]" : "text-[rgb(var(--oui-color-success))]"}>{formatUsd(position.unrealizedPnl, false)}</span>,
      csvValue: (position) => String(position.unrealizedPnl ?? ""),
    },
    {
      key: "liquidation",
      label: "Est. liquidation",
      align: "right",
      sortValue: (position) => position.liquidationPrice ?? 0,
      render: (position) => formatUsd(position.liquidationPrice, false),
      csvValue: (position) => String(position.liquidationPrice ?? ""),
    },
  ];

  if (query.isLoading && !accounts) {
    return (
      <div className="space-y-5">
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"><ArrowLeft size={15} /> Back to traders</Link>
        <LoadingDataState label="Loading public account state…" />
      </div>
    );
  }

  if (query.error && !accounts) {
    return (
      <div className="space-y-5">
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"><ArrowLeft size={15} /> Back to traders</Link>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} title="Could not load this public account" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"><ArrowLeft size={15} /> Back to traders</Link>
      <PageHeader
        title="Public Account State"
        description={`Live public account and open-position data for ${shortAddress(address, 10)}. No account controls or private identity data are fabricated in the browser.`}
      />
      <LiveDataBar
        source="Orderly public API"
        updatedAt={query.updatedAt}
        refreshing={query.isRefreshing}
        onRefresh={() => void query.refetch()}
      />
      <QueryErrorState error={query.error} onRetry={() => void query.refetch()} compact />

      {!accounts || accounts.length === 0 ? (
        <EmptyDataState
          title="No public account was found"
          hint="The address may not be registered on the currently selected Orderly network, or it may not have public account state yet."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Wallet} label="Account value" value={formatUsd(totals.accountValue)} hint={`${accounts.length} account${accounts.length === 1 ? "" : "s"}`} />
            <StatCard icon={CircleDollarSign} label="Collateral value" value={formatUsd(totals.collateral)} />
            <StatCard icon={Gauge} label="Free collateral" value={formatUsd(totals.freeCollateral)} accent="success" />
            <StatCard icon={Radio} label="24h PnL" value={formatUsd(totals.pnl24h, false)} accent={totals.pnl24h < 0 ? "danger" : "success"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {accounts.map((account: PublicAccount) => (
              <Card key={account.id} title={`${account.accountType || "Account"} account`} subtitle={account.accountId ? shortAddress(account.accountId, 10) : "Account ID unavailable"}>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    ["Account value", formatUsd(account.accountValue)],
                    ["Collateral", formatUsd(account.collateralValue)],
                    ["Free collateral", formatUsd(account.freeCollateral)],
                    ["Margin ratio", formatPercent(account.marginRatio, { fraction: true, digits: 2 })],
                    ["Initial margin", formatPercent(account.initialMarginRatio, { fraction: true, digits: 2 })],
                    ["Maintenance margin", formatPercent(account.maintenanceMarginRatio, { fraction: true, digits: 2 })],
                    ["Unrealized PnL", formatUsd(account.unrealizedPnl, false)],
                    ["Open positions", account.positions.length],
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-lg bg-white/[0.04] px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-white/30">{label}</div>
                      <div className="mt-0.5 truncate font-medium text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>

          <Card title="Open positions" subtitle="Current positions returned by the public account-state query">
            <DataTable
              tableKey="live-public-account-positions"
              columns={columns}
              rows={positions}
              emptyTitle="No open positions"
              emptyHint="This account currently has no public open positions."
              initialSortKey="notional"
            />
          </Card>

          <p className="flex items-center gap-2 text-[11px] text-white/30"><Layers3 size={12} /> Position values are mark-to-market snapshots; latest response refreshed {query.updatedAt ? formatDateTime(query.updatedAt) : "—"}.</p>
        </>
      )}
    </div>
  );
}

export default function AdminUserDetail() {
  const { userId = "" } = useParams();
  let identifier = userId;
  try {
    identifier = decodeURIComponent(userId);
  } catch {
    // Keep the raw route value; it will be rejected by the address validator.
  }

  if (isAdminApiConfigured()) {
    return (
      <AdminResourcePage
        resource={`users/${encodeURIComponent(identifier)}`}
        title="User Record"
        description="Live user detail fetched from your authenticated admin API."
      />
    );
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(identifier)) {
    return (
      <div className="space-y-5">
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white"><ArrowLeft size={15} /> Back to traders</Link>
        <EmptyDataState title="A wallet address is required" hint="Public account lookup is available for valid EVM wallet addresses from the live trader table." />
      </div>
    );
  }

  return <PublicAccountPage address={identifier} />;
}
