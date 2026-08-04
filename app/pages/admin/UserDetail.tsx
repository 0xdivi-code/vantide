import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Ban,
  Snowflake,
  PauseCircle,
  PlayCircle,
  UserCheck,
  CircleOff,
  CircleCheck,
  Wallet,
  SlidersHorizontal,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, useMockApiVersion } from "@/admin/mock/api";
import { fmtNum, fmtUsd, fmtTime, shortHash, timeAgo, waveSeries } from "@/admin/mock/rng";
import type { UserStatus } from "@/admin/mock/types";
import {
  Badge, AdminButton, Card, Field, TextInput, Select, StatCard,
} from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { ConfirmDialog, Modal, useToast, Drawer } from "@/admin/components/feedback";
import { Sparkline } from "@/admin/components/Charts";
import { userStatusBadge } from "./Users";

type Action = "suspend" | "freeze" | "ban" | "unban" | "activate";

const ACTION_META: Record<Action, { label: string; status: UserStatus; confirm: string }> = {
  suspend: { label: "Suspend account", status: "suspended", confirm: "Suspended users cannot trade, deposit, or withdraw until reactivated." },
  freeze: { label: "Freeze account", status: "frozen", confirm: "Freezing locks all assets — positions stay open but no actions are allowed." },
  ban: { label: "Ban account", status: "banned", confirm: "Banning permanently disables this account and blocks associated IP on next login." },
  unban: { label: "Unban account", status: "active", confirm: "The account will return to active status immediately." },
  activate: { label: "Reactivate account", status: "active", confirm: "The account will return to active status immediately." },
};

export default function AdminUserDetail() {
  const { userId = "" } = useParams();
  useMockApiVersion();
  const toast = useToast();
  const [action, setAction] = useState<Action | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [assetsOpen, setAssetsOpen] = useState(false);

  const user = db.users.get(userId);

  const positions = useMemo(() => db.positions.all().filter((p) => p.user === userId), [userId]);
  const orders = useMemo(() => db.orders.all().filter((o) => o.user === userId).slice(0, 12), [userId]);
  const logins = useMemo(() => db.logins.all().filter((l) => l.user === userId).slice(0, 10), [userId]);
  const funding = useMemo(() => db.funding.all().slice(0, 6), []);
  const pnlSeries = useMemo(() => waveSeries(Math.abs([...userId].reduce((s, c) => s + c.charCodeAt(0), 0)), 30, Math.max(500, (user?.pnl30d ?? 1000) / 12), Math.max(200, Math.abs(user?.pnl30d ?? 1000) / 6)), [userId, user]);

  const referrals = useMemo(
    () => db.users.all().filter((u) => u.id !== userId).slice(0, user?.referralCount ? Math.min(user.referralCount, 8) : 3),
    [userId, user]
  );

  if (!user) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
          <ArrowLeft size={15} /> Back to users
        </Link>
        <Card>
          <p className="py-10 text-center text-sm text-white/50">
            User <code className="font-mono text-white/75">{userId}</code> was not found in the mock dataset.
          </p>
        </Card>
      </div>
    );
  }

  const applyAction = (a: Action) => {
    const meta = ACTION_META[a];
    const prev = { status: user.status, tradingEnabled: user.tradingEnabled };
    db.users.update(user.id, { status: meta.status, tradingEnabled: meta.status === "active" ? true : false });
    bumpApiVersion();
    toast.success(`${meta.label} applied to ${user.email}.`, () => {
      db.users.update(user.id, prev);
      bumpApiVersion();
    });
  };

  const toggleTrading = () => {
    db.users.update(user.id, { tradingEnabled: !user.tradingEnabled });
    bumpApiVersion();
    toast.success(user.tradingEnabled ? "Trading disabled for this user." : "Trading enabled for this user.", () => {
      db.users.update(user.id, { tradingEnabled: user.tradingEnabled });
      bumpApiVersion();
    });
  };

  const verifyKyc = () => {
    db.users.update(user.id, { kyc: "verified" });
    bumpApiVersion();
    toast.success("KYC marked as verified.");
  };

  const applyAdjust = () => {
    const amt = Number(adjustAmount);
    if (!amt || isNaN(amt)) {
      toast.error("Enter a non-zero amount (use negative to deduct).");
      return;
    }
    const prev = user.balance;
    db.users.update(user.id, { balance: Math.max(0, prev + amt) });
    bumpApiVersion();
    setAdjustOpen(false);
    setAdjustAmount("");
    toast.success(`Balance adjusted by ${fmtUsd(amt)} (${adjustReason || "manual adjustment"}).`, () => {
      db.users.update(user.id, { balance: prev });
      bumpApiVersion();
    });
    setAdjustReason("");
  };

  const posCols: Column<(typeof positions)[number]>[] = [
    { key: "pair", label: "Pair", sortValue: (p) => p.pair, render: (p) => <span className="font-medium text-white">{p.pair}</span> },
    { key: "side", label: "Side", sortValue: (p) => p.side, render: (p) => <Badge tone={p.side === "long" ? "success" : "danger"}>{p.side}</Badge> },
    { key: "size", label: "Size", align: "right", sortValue: (p) => p.size, render: (p) => fmtUsd(p.size) },
    { key: "lev", label: "Lev", align: "right", sortValue: (p) => p.leverage, render: (p) => `${p.leverage}x` },
    { key: "entry", label: "Entry", align: "right", sortValue: (p) => p.entryPrice, render: (p) => p.entryPrice.toLocaleString() },
    { key: "pnl", label: "uPnL", align: "right", sortValue: (p) => p.unrealizedPnl, render: (p) => <span className={p.unrealizedPnl >= 0 ? "text-[rgb(var(--oui-color-trading-profit))]" : "text-[rgb(var(--oui-color-trading-loss))]"}>{fmtUsd(p.unrealizedPnl)}</span> },
    { key: "mr", label: "Margin ratio", align: "right", sortValue: (p) => p.marginRatio, render: (p) => <span className={p.marginRatio < 2 ? "text-[rgb(var(--oui-color-danger-light))]" : "text-white/60"}>{p.marginRatio}%</span> },
  ];

  const ordCols: Column<(typeof orders)[number]>[] = [
    { key: "id", label: "Order", sortValue: (o) => o.id, render: (o) => <span className="font-mono text-xs text-white/60">{o.id}</span> },
    { key: "pair", label: "Pair", sortValue: (o) => o.pair },
    { key: "side", label: "Side", render: (o) => <Badge tone={o.side === "buy" ? "success" : "danger"}>{o.side}</Badge> },
    { key: "type", label: "Type", sortValue: (o) => o.type },
    { key: "size", label: "Size", align: "right", sortValue: (o) => o.size, render: (o) => fmtUsd(o.size) },
    { key: "status", label: "Status", sortValue: (o) => o.status, render: (o) => <Badge tone={o.status === "filled" ? "success" : o.status === "open" ? "primary" : "neutral"}>{o.status}</Badge> },
    { key: "ts", label: "Time", sortValue: (o) => o.ts, render: (o) => <span className="text-white/45">{fmtTime(o.ts)}</span> },
  ];

  const loginCols: Column<(typeof logins)[number]>[] = [
    { key: "ts", label: "Time", sortValue: (l) => l.ts, render: (l) => fmtTime(l.ts) },
    { key: "ip", label: "IP", render: (l) => <span className="font-mono text-xs text-white/60">{l.ip}</span> },
    { key: "device", label: "Device", sortValue: (l) => l.device },
    { key: "country", label: "Country", sortValue: (l) => l.country },
    { key: "ok", label: "Result", render: (l) => <Badge tone={l.success ? "success" : "danger"}>{l.success ? "success" : "failed"}</Badge> },
  ];

  const currentAction = action ? ACTION_META[action] : null;

  return (
    <div className="space-y-5">
      <Link to="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={15} /> Back to users
      </Link>

      {/* Header card */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(var(--oui-color-primary),0.18)] text-lg font-bold text-[rgb(var(--oui-color-primary-light))]">
              {user.email.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white">{user.email}</h1>
                {userStatusBadge(user.status)}
                <Badge tone={user.tier === "VIP 0" ? "neutral" : "primary"}>{user.tier}</Badge>
              </div>
              <div className="mt-0.5 font-mono text-xs text-white/40">{user.wallet}</div>
              <div className="mt-1 text-xs text-white/40">
                {user.country} · joined {timeAgo(user.createdAt)} · KYC: {user.kyc} · IP {user.ip}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user.status !== "banned" && user.status !== "active" && (
              <AdminButton onClick={() => setAction("activate")}><PlayCircle size={14} /> Reactivate</AdminButton>
            )}
            {user.status === "active" && (
              <AdminButton onClick={() => setAction("suspend")}><PauseCircle size={14} /> Suspend</AdminButton>
            )}
            {user.status !== "frozen" && user.status !== "banned" && (
              <AdminButton onClick={() => setAction("freeze")}><Snowflake size={14} /> Freeze</AdminButton>
            )}
            {user.status === "banned" ? (
              <AdminButton onClick={() => setAction("unban")}><CircleCheck size={14} /> Unban</AdminButton>
            ) : (
              <AdminButton variant="danger" onClick={() => setAction("ban")}><Ban size={14} /> Ban</AdminButton>
            )}
            <AdminButton onClick={toggleTrading}>
              {user.tradingEnabled ? <><CircleOff size={14} /> Disable trading</> : <><CircleCheck size={14} /> Enable trading</>}
            </AdminButton>
            {user.kyc !== "verified" && (
              <AdminButton onClick={verifyKyc}><UserCheck size={14} /> Verify KYC</AdminButton>
            )}
            <AdminButton variant="primary" onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal size={14} /> Adjust balance
            </AdminButton>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Balance" value={fmtUsd(user.balance)} hint={`Equity ${fmtUsd(user.equity)}`} />
        <StatCard icon={CircleCheck} label="PnL (30d)" value={`${user.pnl30d >= 0 ? "+" : ""}${fmtUsd(user.pnl30d)}`} accent={user.pnl30d >= 0 ? "success" : "danger"} />
        <StatCard icon={CircleCheck} label="Lifetime volume" value={fmtUsd(user.totalVolume)} hint={`${fmtNum(user.totalTrades)} trades`} />
        <StatCard icon={UserCheck} label="Referrals" value={user.referralCount} hint="Direct invitees" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Positions */}
        <div className="xl:col-span-2">
          <h2 className="mb-2 text-sm font-semibold text-white">Open positions ({positions.length})</h2>
          <DataTable tableKey="user-positions" columns={posCols} rows={positions} emptyTitle="No open positions" pageSize={5} />
        </div>

        {/* PnL + funding */}
        <div className="space-y-4">
          <Card title="PnL — last 30 days">
            <Sparkline data={pnlSeries} width={340} height={90} color={user.pnl30d >= 0 ? "rgb(var(--oui-color-success))" : "rgb(var(--oui-color-danger))"} />
            <div className="mt-2 text-xs text-white/40">
              Realized: <span className={user.pnl30d >= 0 ? "text-[rgb(var(--oui-color-trading-profit))]" : "text-[rgb(var(--oui-color-trading-loss))]"}>{fmtUsd(user.pnl30d)}</span>
            </div>
          </Card>
          <Card title="Balances by asset" actions={<AdminButton variant="ghost" className="!px-2 !py-1 text-xs" onClick={() => setAssetsOpen(true)}>Details</AdminButton>}>
            <ul className="space-y-2 text-sm">
              {["USDC", "USDT", "ETH", "BTC"].map((a, i) => {
                const share = [0.52, 0.27, 0.15, 0.06][i];
                return (
                  <li key={a} className="flex items-center justify-between">
                    <span className="text-white/60">{a}</span>
                    <span className="font-medium text-white">{fmtUsd(user.balance * share)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-white">Recent orders</h2>
          <DataTable tableKey="user-orders" columns={ordCols} rows={orders} emptyTitle="No orders" pageSize={6} />
        </div>
        <div className="space-y-4">
          <div>
            <h2 className="mb-2 text-sm font-semibold text-white">Login history</h2>
            <DataTable tableKey="user-logins" columns={loginCols} rows={logins} emptyTitle="No login records" pageSize={5} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={`Referrals (${referrals.length})`} subtitle="Direct invitees of this user">
          <ul className="divide-y divide-white/5">
            {referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <Link to={`/admin/users/${r.id}`} className="truncate text-sm text-[rgb(var(--oui-color-link))] hover:underline">
                  {r.email}
                </Link>
                <span className="text-xs text-white/40">{fmtUsd(r.totalVolume)} vol</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent funding payments" subtitle="Funding debited/credited to this account">
          <ul className="divide-y divide-white/5">
            {funding.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-white/70">{f.pair}</span>
                <span className={f.rate >= 0 ? "text-[rgb(var(--oui-color-trading-profit))]" : "text-[rgb(var(--oui-color-trading-loss))]"}>
                  {f.rate >= 0 ? "+" : ""}{f.rate}%
                </span>
                <span className="text-white/40">{fmtUsd(f.paid * 0.01)}</span>
                <span className="w-20 text-right text-xs text-white/30">{timeAgo(f.ts)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Action confirm */}
      <ConfirmDialog
        open={action !== null}
        onClose={() => setAction(null)}
        onConfirm={() => action && applyAction(action)}
        title={currentAction?.label ?? ""}
        message={
          <>
            {currentAction?.confirm}
            <div className="mt-2 font-mono text-xs text-white/40">{user.wallet}</div>
          </>
        }
        confirmLabel={currentAction?.label}
        danger={action === "ban" || action === "freeze" || action === "suspend"}
      />

      {/* Adjust balance */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Adjust balance"
        subtitle="Credit or debit this user's available balance (mock ledger entry)."
        footer={
          <>
            <AdminButton onClick={() => setAdjustOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={applyAdjust}>Apply adjustment</AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Amount (USD)" hint="Positive to credit, negative to debit.">
            <TextInput type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="e.g. 500 or -250" />
          </Field>
          <Field label="Reason">
            <Select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}>
              <option value="">Select a reason…</option>
              <option>Compensation for incident</option>
              <option>Promotional credit</option>
              <option>Fee refund</option>
              <option>Correction of ledger error</option>
              <option>Regulatory hold</option>
            </Select>
          </Field>
          <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/50">
            Current balance: <span className="font-medium text-white">{fmtUsd(user.balance)}</span>
            {adjustAmount && !isNaN(Number(adjustAmount)) && (
              <>
                {" → "}
                <span className="font-medium text-white">{fmtUsd(Math.max(0, user.balance + Number(adjustAmount)))}</span>
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Assets drawer */}
      <Drawer open={assetsOpen} onClose={() => setAssetsOpen(false)} title="Asset breakdown" subtitle={user.email}>
        <ul className="space-y-3">
          {["USDC", "USDT", "ETH", "BTC", "SOL", "ORDER"].map((a, i) => {
            const share = [0.44, 0.24, 0.16, 0.09, 0.05, 0.02][i];
            const v = user.balance * share;
            return (
              <li key={a} className="flex items-center justify-between rounded-lg border border-white/10 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold">{a.slice(0, 3)}</span>
                  {a}
                </span>
                <span className="text-sm font-medium text-white">{fmtUsd(v)}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-[11px] text-white/35">
          Wallet <span className="font-mono">{shortHash(user.wallet, 10)}</span>
        </p>
      </Drawer>
    </div>
  );
}
