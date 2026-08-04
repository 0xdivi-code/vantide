import { useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Check, X, Plus, ShieldOff, ShieldCheck, Snowflake,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { uid , collection } from "@/admin/mock/engine";
import { fmtUsd, fmtTime, shortHash , evmAddress } from "@/admin/mock/rng";
import type { MockDeposit, MockWithdrawal } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Card, StatCard, Field, TextInput, Select, Toggle } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, ConfirmDialog, useToast } from "@/admin/components/feedback";
const whitelistCol = collection("withdrawal-whitelist", () => [
  { id: "wl_1", address: "0x8ba1f109551bD432803012645Ac136ddd64DBA72", label: "Company ops wallet", addedAt: Date.now() - 86_400_000 * 40 },
  { id: "wl_2", address: "0x2546BcD3c84621e976D8185a91A922aE77ECEc30", label: "MM partner — Wintermute", addedAt: Date.now() - 86_400_000 * 12 },
]);

const DEP_TONE: Record<MockDeposit["status"], "success" | "warning" | "danger"> = {
  pending: "warning",
  completed: "success",
  failed: "danger",
};

const WDR_TONE: Record<MockWithdrawal["status"], "success" | "warning" | "danger" | "primary"> = {
  pending: "warning",
  approved: "primary",
  rejected: "danger",
  completed: "success",
  failed: "danger",
};

export default function AdminFunding() {
  useMockApiVersion();
  const toast = useToast();
  const [tab, setTab] = useState<"deposits" | "withdrawals" | "controls">("deposits");
  const [filters, patch] = useSavedFilters("funding", { q: "", status: "", chain: "" });
  const [creditOpen, setCreditOpen] = useState(false);
  const [credit, setCredit] = useState({ wallet: "", asset: "USDC", amount: "" });
  const [confirmAction, setConfirmAction] = useState<{ kind: "withdrawal" | "deposit"; id: string; action: "approved" | "rejected" } | null>(null);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [wl, setWl] = useState({ address: "", label: "" });

  const [limits, setLimits] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vantide-funding-limits") || "") as { daily: string; perTx: string; freeze: boolean; autoApproveUnder: string };
    } catch {
      return { daily: "500000", perTx: "100000", freeze: false, autoApproveUnder: "5000" };
    }
  });

  const deposits = useMemo(
    () =>
      db.deposits
        .all()
        .filter((d) => matches([d.wallet, d.txid, d.asset, d.id, d.user], filters.q) && (!filters.status || d.status === filters.status)),
    [filters]
  );

  const withdrawals = useMemo(
    () =>
      db.withdrawals
        .all()
        .filter((w) => matches([w.wallet, w.destination, w.asset, w.id, w.user], filters.q) && (!filters.status || w.status === filters.status)),
    [filters]
  );

  const dayAgo = Date.now() - 86_400_000;
  const stats = {
    depPending: db.deposits.all().filter((d) => d.status === "pending").length,
    depToday: db.deposits.all().filter((d) => d.ts > dayAgo && d.status === "completed").reduce((s, d) => s + d.amount, 0),
    wdrPending: db.withdrawals.all().filter((w) => w.status === "pending").length,
    wdrToday: db.withdrawals.all().filter((w) => w.ts > dayAgo && w.status === "completed").reduce((s, w) => s + w.amount, 0),
  };

  const actOnWithdrawal = (id: string, action: "approved" | "rejected") => {
    const w = db.withdrawals.get(id);
    if (!w) return;
    const prev = w.status;
    db.withdrawals.update(id, { status: action });
    bumpApiVersion();
    toast.success(`Withdrawal ${id} ${action}.`, () => {
      db.withdrawals.update(id, { status: prev });
      bumpApiVersion();
    });
  };

  const creditDeposit = () => {
    const amt = Number(credit.amount);
    if (!credit.wallet.trim() || !amt || amt <= 0) {
      toast.error("Enter a wallet and a valid amount.");
      return;
    }
    const id = uid("dep");
    db.deposits.insert({
      id,
      user: "manual",
      wallet: credit.wallet.trim(),
      asset: credit.asset,
      amount: amt,
      chain: "Arbitrum",
      txid: `manual-${id}`,
      confirmations: 12,
      requiredConfirmations: 12,
      status: "completed",
      ts: Date.now(),
    });
    bumpApiVersion();
    setCreditOpen(false);
    setCredit({ wallet: "", asset: "USDC", amount: "" });
    toast.success("Manual deposit credited.");
  };

  const depCols: Column<MockDeposit>[] = [
    { key: "id", label: "Deposit", sortValue: (d) => d.id, render: (d) => <span className="font-mono text-xs text-white/55">{d.id}</span> },
    { key: "user", label: "User", render: (d) => <span className="font-mono text-xs text-white/60">{shortHash(d.wallet)}</span> },
    { key: "asset", label: "Asset", sortValue: (d) => d.asset, render: (d) => <Badge tone="neutral">{d.asset}</Badge> },
    { key: "amount", label: "Amount", align: "right", sortValue: (d) => d.amount, render: (d) => fmtUsd(d.amount), csvValue: (d) => String(d.amount) },
    { key: "chain", label: "Chain", sortValue: (d) => d.chain },
    {
      key: "conf", label: "Confirmations",
      render: (d) => (
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
            <span
              className={`block h-full rounded-full ${d.confirmations >= d.requiredConfirmations ? "bg-[rgb(var(--oui-color-success))]" : "bg-[rgb(var(--oui-color-warning))]"}`}
              style={{ width: `${Math.min(100, (d.confirmations / d.requiredConfirmations) * 100)}%` }}
            />
          </span>
          <span className="text-xs text-white/50">{d.confirmations}/{d.requiredConfirmations}</span>
        </span>
      ),
    },
    { key: "txid", label: "Tx hash", render: (d) => <span className="font-mono text-[11px] text-white/35">{d.txid.startsWith("manual") ? "manual credit" : shortHash(d.txid)}</span>, defaultHidden: true },
    { key: "status", label: "Status", sortValue: (d) => d.status, render: (d) => <Badge tone={DEP_TONE[d.status]}>{d.status}</Badge>, csvValue: (d) => d.status },
    { key: "ts", label: "Time", sortValue: (d) => d.ts, render: (d) => <span className="text-white/45">{fmtTime(d.ts)}</span> },
  ];

  const wdrCols: Column<MockWithdrawal>[] = [
    { key: "id", label: "Withdrawal", sortValue: (w) => w.id, render: (w) => <span className="font-mono text-xs text-white/55">{w.id}</span> },
    { key: "user", label: "User", render: (w) => <span className="font-mono text-xs text-white/60">{shortHash(w.wallet)}</span> },
    { key: "dest", label: "Destination", render: (w) => <span className="font-mono text-xs text-white/40">{shortHash(w.destination)}</span> },
    { key: "asset", label: "Asset", sortValue: (w) => w.asset, render: (w) => <Badge tone="neutral">{w.asset}</Badge> },
    { key: "amount", label: "Amount", align: "right", sortValue: (w) => w.amount, render: (w) => fmtUsd(w.amount), csvValue: (w) => String(w.amount) },
    { key: "chain", label: "Chain", sortValue: (w) => w.chain, defaultHidden: true },
    { key: "status", label: "Status", sortValue: (w) => w.status, render: (w) => <Badge tone={WDR_TONE[w.status]}>{w.status}</Badge>, csvValue: (w) => w.status },
    { key: "ts", label: "Time", sortValue: (w) => w.ts, render: (w) => <span className="text-white/45">{fmtTime(w.ts)}</span> },
    {
      key: "act", label: "",
      render: (w) =>
        w.status === "pending" ? (
          <div className="flex gap-1">
            <button onClick={() => setConfirmAction({ kind: "withdrawal", id: w.id, action: "approved" })} className="rounded-md p-1.5 text-[rgb(var(--oui-color-success))] hover:bg-white/10" title="Approve"><Check size={14} /></button>
            <button onClick={() => setConfirmAction({ kind: "withdrawal", id: w.id, action: "rejected" })} className="rounded-md p-1.5 text-[rgb(var(--oui-color-danger-light))] hover:bg-white/10" title="Reject"><X size={14} /></button>
          </div>
        ) : null,
    },
  ];

  const tabs = [
    { id: "deposits" as const, label: `Deposits (${stats.depPending} pending)`, icon: ArrowDownLeft },
    { id: "withdrawals" as const, label: `Withdrawals (${stats.wdrPending} pending)`, icon: ArrowUpRight },
    { id: "controls" as const, label: "Limits & whitelist", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Deposits & Withdrawals"
        description="Review pending flows, approve withdrawals manually, set daily limits, and manage the withdrawal whitelist."
        actions={
          <AdminButton variant="primary" onClick={() => setCreditOpen(true)}>
            <Plus size={15} /> Manual credit
          </AdminButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ArrowDownLeft} label="Deposits today" value={fmtUsd(stats.depToday)} hint={`${stats.depPending} pending`} accent="success" />
        <StatCard icon={ArrowUpRight} label="Withdrawals today" value={fmtUsd(stats.wdrToday)} hint={`${stats.wdrPending} pending`} accent="warning" />
        <StatCard icon={ShieldCheck} label="Whitelisted addresses" value={whitelistCol.count()} hint="Fast-track withdrawals" />
        <StatCard icon={limits.freeze ? Snowflake : ShieldOff} label="Withdrawals status" value={limits.freeze ? "Frozen" : "Open"} accent={limits.freeze ? "danger" : "success"} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-9))] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:flex-none sm:px-4 ${
              tab === t.id
                ? "bg-[rgba(var(--oui-color-primary),0.18)] text-[rgb(var(--oui-color-primary-light))]"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab !== "controls" && (
        <>
          <FilterBar
            search={filters.q}
            onSearch={(v) => patch({ q: v })}
            searchPlaceholder="Search wallet, tx hash, ID…"
            selects={[
              { key: "status", label: "All statuses", options: (tab === "deposits" ? ["pending", "completed", "failed"] : ["pending", "approved", "rejected", "completed"]).map((s) => ({ value: s, label: s })) },
            ]}
            values={filters}
            onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
          />
          {tab === "deposits" ? (
            <DataTable tableKey="deposits" columns={depCols} rows={deposits} emptyTitle="No deposits match" />
          ) : (
            <DataTable
              tableKey="withdrawals"
              columns={wdrCols}
              rows={withdrawals}
              emptyTitle="No withdrawals match"
              bulkActions={(sel, clear) => (
                <>
                  <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.filter((w) => w.status === "pending").forEach((w) => db.withdrawals.update(w.id, { status: "approved" })); bumpApiVersion(); toast.success("Selected withdrawals approved."); clear(); }}>
                    <Check size={13} /> Approve
                  </AdminButton>
                  <AdminButton variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.filter((w) => w.status === "pending").forEach((w) => db.withdrawals.update(w.id, { status: "rejected" })); bumpApiVersion(); toast.success("Selected withdrawals rejected."); clear(); }}>
                    <X size={13} /> Reject
                  </AdminButton>
                </>
              )}
            />
          )}
        </>
      )}

      {tab === "controls" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card title="Withdrawal controls" subtitle="Venue-wide safety switches">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-white/10 p-3.5">
                <div>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    Freeze all withdrawals
                    {limits.freeze && <Badge tone="danger">frozen</Badge>}
                  </div>
                  <div className="text-[11px] text-white/35">Emergency switch — blocks every new withdrawal instantly.</div>
                </div>
                <Toggle checked={limits.freeze} onChange={(v) => setLimits({ ...limits, freeze: v })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Daily limit ($)">
                  <TextInput type="number" value={limits.daily} onChange={(e) => setLimits({ ...limits, daily: e.target.value })} />
                </Field>
                <Field label="Per-tx limit ($)">
                  <TextInput type="number" value={limits.perTx} onChange={(e) => setLimits({ ...limits, perTx: e.target.value })} />
                </Field>
                <Field label="Auto-approve under ($)">
                  <TextInput type="number" value={limits.autoApproveUnder} onChange={(e) => setLimits({ ...limits, autoApproveUnder: e.target.value })} />
                </Field>
              </div>
              <AdminButton
                variant="primary"
                className="w-full"
                onClick={() => {
                  try {
                    localStorage.setItem("vantide-funding-limits", JSON.stringify(limits));
                    toast.success("Withdrawal controls saved.");
                  } catch {
                    toast.error("Could not persist controls.");
                  }
                }}
              >
                Save controls
              </AdminButton>
              <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/40">
                Used today: {fmtUsd(stats.wdrToday)} of {fmtUsd(Number(limits.daily) || 0)} daily limit.
              </div>
            </div>
          </Card>

          <Card
            title="Withdrawal whitelist"
            subtitle="Addresses that skip manual approval"
            actions={
              <AdminButton className="!px-2.5 !py-1 text-xs" onClick={() => setWhitelistOpen(true)}>
                <Plus size={13} /> Add address
              </AdminButton>
            }
          >
            <ul className="space-y-2.5">
              {whitelistCol.all().map((w) => (
                <li key={w.id} className="flex items-center justify-between rounded-lg border border-white/10 px-3.5 py-2.5">
                  <div>
                    <div className="text-sm text-white/80">{w.label}</div>
                    <div className="font-mono text-[11px] text-white/35">{shortHash(w.address, 10)}</div>
                  </div>
                  <AdminButton
                    variant="ghost"
                    className="!px-2 !py-1 text-[11px] text-[rgb(var(--oui-color-danger-light))]"
                    onClick={() => {
                      whitelistCol.remove(w.id);
                      bumpApiVersion();
                      toast.success("Removed from whitelist.", () => {
                        whitelistCol.insert(w);
                        bumpApiVersion();
                      });
                    }}
                  >
                    Remove
                  </AdminButton>
                </li>
              ))}
              {whitelistCol.count() === 0 && (
                <p className="py-6 text-center text-sm text-white/35">No whitelisted addresses.</p>
              )}
            </ul>
          </Card>
        </div>
      )}

      {/* Manual credit */}
      <Modal
        open={creditOpen}
        onClose={() => setCreditOpen(false)}
        title="Manual deposit credit"
        subtitle="Credit a user balance directly — completed instantly in the mock ledger."
        footer={
          <>
            <AdminButton onClick={() => setCreditOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={creditDeposit}>Credit deposit</AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="User wallet">
            <TextInput value={credit.wallet} onChange={(e) => setCredit({ ...credit, wallet: e.target.value })} placeholder="0x…" className="font-mono text-xs" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Asset">
              <Select value={credit.asset} onChange={(e) => setCredit({ ...credit, asset: e.target.value })}>
                {["USDC", "USDT", "ETH", "BTC"].map((a) => <option key={a}>{a}</option>)}
              </Select>
            </Field>
            <Field label="Amount">
              <TextInput type="number" value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })} placeholder="10000" />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Whitelist add */}
      <Modal
        open={whitelistOpen}
        onClose={() => setWhitelistOpen(false)}
        title="Add whitelisted address"
        footer={
          <>
            <AdminButton onClick={() => setWhitelistOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={() => {
              if (!/^0x[0-9a-fA-F]{40}$/.test(wl.address.trim())) {
                toast.error("Enter a valid 0x address.");
                return;
              }
              whitelistCol.insert({ id: uid("wl"), address: wl.address.trim(), label: wl.label.trim() || "Whitelisted address", addedAt: Date.now() });
              bumpApiVersion();
              setWhitelistOpen(false);
              setWl({ address: "", label: "" });
              toast.success("Address whitelisted.");
            }}>Add</AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Address">
            <TextInput value={wl.address} onChange={(e) => setWl({ ...wl, address: e.target.value })} placeholder="0x…" className="font-mono text-xs" />
          </Field>
          <Field label="Label">
            <TextInput value={wl.label} onChange={(e) => setWl({ ...wl, label: e.target.value })} placeholder="e.g. Market maker partner" />
          </Field>
          <button
            className="text-[11px] text-[rgb(var(--oui-color-link))] hover:underline"
            onClick={() => setWl({ ...wl, address: evmAddress(Math.random) })}
          >
            Fill a random contract address
          </button>
        </div>
      </Modal>

      {/* Approve/reject confirm */}
      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && actOnWithdrawal(confirmAction.id, confirmAction.action)}
        title={`${confirmAction?.action === "approved" ? "Approve" : "Reject"} ${confirmAction?.id}?`}
        message={
          confirmAction?.action === "approved"
            ? "Approving queues the withdrawal for execution. Verify the destination address first."
            : "Rejecting returns the funds to the user's available balance."
        }
        confirmLabel={confirmAction?.action === "approved" ? "Approve withdrawal" : "Reject withdrawal"}
        danger={confirmAction?.action === "rejected"}
      />
    </div>
  );
}
