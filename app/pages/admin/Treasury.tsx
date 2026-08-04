import { useMemo, useState } from "react";
import {
  Vault, ArrowRightLeft, Check, X, Copy, Flame, Snowflake, ShieldCheck,
  Landmark, PiggyBank, Wallet2,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { uid } from "@/admin/mock/engine";
import { fmtNum, fmtUsd, fmtTime, shortHash , waveSeries } from "@/admin/mock/rng";
import type { TreasuryWallet, WalletKind, TreasuryTransfer } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Card, Field, TextInput, Select } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, ConfirmDialog, useToast } from "@/admin/components/feedback";
import { AreaChart } from "@/admin/components/Charts";

const WALLET_ICON: Record<WalletKind, React.ComponentType<{ size?: number | string; className?: string }>> = {
  "Hot Wallet": Flame,
  "Cold Wallet": Snowflake,
  "Treasury Wallet": Vault,
  "Insurance Fund": ShieldCheck,
  "Revenue Wallet": Landmark,
  "Reserve Wallet": PiggyBank,
};

const STATUS_TONE: Record<TreasuryTransfer["status"], "success" | "warning" | "danger" | "primary"> = {
  pending: "warning",
  approved: "primary",
  rejected: "danger",
  completed: "success",
};

export default function AdminTreasury() {
  useMockApiVersion();
  const toast = useToast();
  const [filters, patch] = useSavedFilters("treasury", { q: "", status: "" });
  const [transferOpen, setTransferOpen] = useState(false);
  const [tf, setTf] = useState({ from: "Revenue Wallet", to: "Treasury Wallet", asset: "USDC", amount: "", note: "" });
  const [balancesWallet, setBalancesWallet] = useState<TreasuryWallet | null>(null);
  const [confirm, setConfirm] = useState<{ t: TreasuryTransfer; action: "approved" | "rejected" } | null>(null);

  const wallets = db.wallets.all();
  const total = wallets.reduce((s, w) => s + w.balance, 0);

  const treasuryHistory = useMemo(() => {
    const labels: string[] = [];
    for (let i = 29; i >= 0; i--) {
      labels.push(new Date(Date.now() - i * 86_400_000).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    }
    return { labels, data: waveSeries(505, 30, total * 0.95, total * 0.02) };
  }, [total]);

  const transfers = useMemo(
    () =>
      db.transfers
        .all()
        .filter((t) => matches([t.from, t.to, t.asset, t.id, t.note], filters.q) && (!filters.status || t.status === filters.status)),
    [filters]
  );

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => toast.success("Address copied."));
  };

  const pending = db.transfers.all().filter((t) => t.status === "pending").length;

  const submitTransfer = () => {
    const amt = Number(tf.amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    if (tf.from === tf.to) {
      toast.error("Source and destination must differ.");
      return;
    }
    const id = uid("trf");
    db.transfers.insert({
      id,
      from: tf.from as WalletKind,
      to: tf.to as WalletKind,
      asset: tf.asset,
      amount: amt,
      status: "pending",
      requestedBy: "you",
      ts: Date.now(),
      note: tf.note || undefined,
    });
    bumpApiVersion();
    setTransferOpen(false);
    setTf({ ...tf, amount: "", note: "" });
    toast.success("Transfer created — pending approval.", () => {
      db.transfers.remove(id);
      bumpApiVersion();
    });
  };

  const cols: Column<TreasuryTransfer>[] = [
    { key: "id", label: "Transfer", sortValue: (t) => t.id, render: (t) => <span className="font-mono text-xs text-white/55">{t.id}</span> },
    {
      key: "route", label: "Route",
      render: (t) => (
        <span className="text-white/75">
          {t.from} <span className="text-white/30">→</span> {t.to}
        </span>
      ),
    },
    { key: "asset", label: "Asset", sortValue: (t) => t.asset, render: (t) => <Badge tone="neutral">{t.asset}</Badge> },
    { key: "amount", label: "Amount", align: "right", sortValue: (t) => t.amount, render: (t) => fmtUsd(t.amount), csvValue: (t) => String(t.amount) },
    { key: "by", label: "Requested by", sortValue: (t) => t.requestedBy, defaultHidden: true },
    { key: "note", label: "Note", render: (t) => <span className="text-white/40">{t.note ?? "—"}</span>, defaultHidden: true },
    { key: "status", label: "Status", sortValue: (t) => t.status, render: (t) => <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>, csvValue: (t) => t.status },
    { key: "ts", label: "Time", sortValue: (t) => t.ts, render: (t) => <span className="text-white/45">{fmtTime(t.ts)}</span> },
    {
      key: "act", label: "",
      render: (t) =>
        t.status === "pending" ? (
          <div className="flex gap-1">
            <button onClick={() => setConfirm({ t, action: "approved" })} className="rounded-md p-1.5 text-[rgb(var(--oui-color-success))] hover:bg-white/10" title="Approve"><Check size={14} /></button>
            <button onClick={() => setConfirm({ t, action: "rejected" })} className="rounded-md p-1.5 text-[rgb(var(--oui-color-danger-light))] hover:bg-white/10" title="Reject"><X size={14} /></button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Treasury"
        description={`${fmtUsd(total)} across ${wallets.length} venue wallets. ${pending} transfer${pending === 1 ? "" : "s"} awaiting approval.`}
        actions={
          <AdminButton variant="primary" onClick={() => setTransferOpen(true)}>
            <ArrowRightLeft size={15} /> New transfer
          </AdminButton>
        }
      />

      {/* Wallet cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {wallets.map((w) => {
          const IconCmp = WALLET_ICON[w.name];
          return (
            <button key={w.id} onClick={() => setBalancesWallet(w)} className="text-left">
              <div className="h-full rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] p-4 transition-colors hover:border-[rgba(var(--oui-color-primary),0.5)]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-white/85">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]">
                      <IconCmp size={15} />
                    </span>
                    {w.name}
                  </span>
                  <Badge tone={w.name === "Hot Wallet" ? "warning" : "success"}>{w.chain}</Badge>
                </div>
                <div className="mt-3 text-xl font-bold text-white">{fmtUsd(w.balance)}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-white/30">{shortHash(w.address)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => { e.stopPropagation(); copy(w.address); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); copy(w.address); } }}
                    className="rounded-md p-1 text-white/30 hover:bg-white/10 hover:text-white/70"
                    title="Copy address"
                  >
                    <Copy size={12} />
                  </span>
                </div>
                <div className="mt-2 flex gap-1">
                  {w.assets.map((a) => (
                    <span key={a.symbol} className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/45">
                      {a.symbol} {fmtUsd(a.value)}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Balance history */}
      <Card title="Treasury balance — 30 days" subtitle="Aggregate across all venue wallets">
        <AreaChart labels={treasuryHistory.labels} data={treasuryHistory.data} formatValue={(v) => fmtUsd(v)} />
      </Card>

      {/* Transfers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Wallet2 size={15} className="text-[rgb(var(--oui-color-primary-light))]" />
            Transfers ({fmtNum(db.transfers.count())})
          </h2>
        </div>
        <FilterBar
          search={filters.q}
          onSearch={(v) => patch({ q: v })}
          searchPlaceholder="Search wallets, asset, note…"
          selects={[{ key: "status", label: "All statuses", options: ["pending", "approved", "rejected", "completed"].map((s) => ({ value: s, label: s })) }]}
          values={filters}
          onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
        />
        <DataTable
          tableKey="treasury-transfers"
          columns={cols}
          rows={transfers}
          emptyTitle="No transfers"
          emptyHint="Create one with the New transfer button."
          bulkActions={(sel, clear) => (
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => {
              sel.forEach((t) => t.status === "pending" && db.transfers.update(t.id, { status: "approved" }));
              bumpApiVersion();
              toast.success("Pending transfers approved.");
              clear();
            }}>
              <Check size={13} /> Approve pending
            </AdminButton>
          )}
        />
      </div>

      {/* Wallet balances modal */}
      <Modal
        open={balancesWallet !== null}
        onClose={() => setBalancesWallet(null)}
        title={balancesWallet?.name ?? ""}
        subtitle={balancesWallet ? `${balancesWallet.chain} · ${shortHash(balancesWallet.address, 10)}` : undefined}
      >
        {balancesWallet && (
          <ul className="space-y-2.5">
            {balancesWallet.assets.map((a) => (
              <li key={a.symbol} className="flex items-center justify-between rounded-lg border border-white/10 px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-sm text-white/80">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 text-[10px] font-bold">{a.symbol.slice(0, 3)}</span>
                  {a.symbol}
                </span>
                <span className="text-right">
                  <span className="block text-sm font-medium text-white">{fmtNum(a.amount)} </span>
                  <span className="block text-[11px] text-white/35">{fmtUsd(a.value)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* New transfer */}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="New treasury transfer"
        subtitle="Creates a pending transfer requiring approval (multi-sig flow)."
        footer={
          <>
            <AdminButton onClick={() => setTransferOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={submitTransfer}>Create transfer</AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Select value={tf.from} onChange={(e) => setTf({ ...tf, from: e.target.value })}>
                {wallets.map((w) => <option key={w.id}>{w.name}</option>)}
              </Select>
            </Field>
            <Field label="To">
              <Select value={tf.to} onChange={(e) => setTf({ ...tf, to: e.target.value })}>
                {wallets.map((w) => <option key={w.id}>{w.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset">
              <Select value={tf.asset} onChange={(e) => setTf({ ...tf, asset: e.target.value })}>
                {["USDC", "USDT", "ETH", "BTC", "SOL"].map((a) => <option key={a}>{a}</option>)}
              </Select>
            </Field>
            <Field label="Amount (units)">
              <TextInput type="number" value={tf.amount} onChange={(e) => setTf({ ...tf, amount: e.target.value })} placeholder="250000" />
            </Field>
          </div>
          <Field label="Note (optional)">
            <TextInput value={tf.note} onChange={(e) => setTf({ ...tf, note: e.target.value })} placeholder="Rebalancing for weekend volatility" />
          </Field>
        </div>
      </Modal>

      {/* Approve/reject confirm */}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          db.transfers.update(confirm.t.id, { status: confirm.action });
          bumpApiVersion();
          toast.success(`Transfer ${confirm.action === "approved" ? "approved — queued for execution" : "rejected"}.`);
        }}
        title={`${confirm?.action === "approved" ? "Approve" : "Reject"} transfer ${confirm?.t.id}?`}
        message={confirm ? `${confirm.t.amount.toLocaleString()} ${confirm.t.asset} from ${confirm.t.from} to ${confirm.t.to}.` : ""}
        confirmLabel={confirm?.action === "approved" ? "Approve" : "Reject"}
        danger={confirm?.action === "rejected"}
      />
    </div>
  );
}
