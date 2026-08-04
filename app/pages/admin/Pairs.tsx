import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Plus, Star, StarOff, Eye, EyeOff, OctagonPause, Play, Wrench,
  Pencil, Trash2, Star as StarIcon,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { fmtUsd, shortHash, timeAgo , evmAddress, mulberry32 } from "@/admin/mock/rng";
import type { TradingPair, PairStatus } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Field, TextInput, Select, Toggle } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Drawer, ConfirmDialog, useToast } from "@/admin/components/feedback";

const STATUS_TONE: Record<PairStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  halted: "danger",
  maintenance: "warning",
  disabled: "neutral",
};

const CHAIN_OPTIONS = ["Arbitrum", "Base", "Ethereum", "BNB Chain", "Solana", "Optimism"];
const HOURS_OPTIONS = ["24/7", "01:00-23:00 UTC", "00:00-21:00 UTC", "Weekdays only"];
const LEVERAGE_OPTIONS = [3, 5, 10, 20, 25, 50, 75, 100, 125];

interface PairForm {
  base: string;
  quote: "USDT" | "USDC";
  contractAddress: string;
  chain: string;
  makerFee: string;
  takerFee: string;
  minOrderSize: string;
  maxLeverage: string;
  maxPositionSize: string;
  tradingHours: string;
  visible: boolean;
  featured: boolean;
}

const EMPTY_FORM: PairForm = {
  base: "",
  quote: "USDT",
  contractAddress: "",
  chain: "Arbitrum",
  makerFee: "0.02",
  takerFee: "0.055",
  minOrderSize: "10",
  maxLeverage: "25",
  maxPositionSize: "1000000",
  tradingHours: "24/7",
  visible: true,
  featured: false,
};

function validate(form: PairForm, editingId: string | null): string | null {
  if (!/^[A-Z0-9]{2,15}$/.test(form.base.trim().toUpperCase()))
    return "Base asset must be 2-15 letters/numbers (e.g. PEPE).";
  if (!form.contractAddress.trim())
    return "Contract address is required.";
  if (form.chain !== "Solana" && !/^0x[0-9a-fA-F]{40}$/.test(form.contractAddress.trim()))
    return "Enter a valid EVM contract address (0x + 40 hex chars).";
  const maker = Number(form.makerFee);
  const taker = Number(form.takerFee);
  if (isNaN(maker) || maker < 0 || maker > 2) return "Maker fee must be between 0% and 2%.";
  if (isNaN(taker) || taker < 0 || taker > 2) return "Taker fee must be between 0% and 2%.";
  if (maker > taker) return "Maker fee can't exceed taker fee.";
  const lev = Number(form.maxLeverage);
  if (isNaN(lev) || lev < 1 || lev > 125) return "Max leverage must be 1-125.";
  const min = Number(form.minOrderSize);
  if (isNaN(min) || min < 1) return "Minimum order size must be ≥ $1.";
  const maxPos = Number(form.maxPositionSize);
  if (isNaN(maxPos) || maxPos < 1000) return "Max position size must be ≥ $1,000.";
  const symbol = `${form.base.trim().toUpperCase()}/${form.quote}`;
  const dup = db.pairs.all().find((p) => p.symbol === symbol && p.id !== editingId);
  if (dup) return `${symbol} is already listed.`;
  return null;
}

export default function AdminPairs() {
  useMockApiVersion();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [filters, patch, reset] = useSavedFilters("pairs", {
    q: params.get("q") ?? "",
    status: "",
    chain: "",
    featured: "",
  });
  const [drawerOpen, setDrawerOpen] = useState(params.get("new") === "1");
  const [editing, setEditing] = useState<TradingPair | null>(null);
  const [form, setForm] = useState<PairForm>(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<TradingPair | null>(null);
  const [confirm, setConfirm] = useState<{ pair: TradingPair; action: string; run: () => void } | null>(null);

  const set = (p: Partial<PairForm>) => setForm((f) => ({ ...f, ...p }));

  const rows = useMemo(() => {
    return db.pairs
      .all()
      .filter(
        (p) =>
          matches([p.symbol, p.contractAddress, p.chain], filters.q) &&
          (!filters.status || p.status === filters.status) &&
          (!filters.chain || p.chain === filters.chain) &&
          (!filters.featured || (filters.featured === "featured" ? p.featured : !p.featured))
      )
      .sort((a, b) => b.volume24h - a.volume24h);
  }, [filters]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  };

  const openEdit = (p: TradingPair) => {
    setEditing(p);
    setForm({
      base: p.base,
      quote: p.quote,
      contractAddress: p.contractAddress,
      chain: p.chain,
      makerFee: String(p.makerFee),
      takerFee: String(p.takerFee),
      minOrderSize: String(p.minOrderSize),
      maxLeverage: String(p.maxLeverage),
      maxPositionSize: String(p.maxPositionSize),
      tradingHours: p.tradingHours,
      visible: p.visible,
      featured: p.featured,
    });
    setDrawerOpen(true);
  };

  const save = () => {
    const err = validate(form, editing?.id ?? null);
    if (err) {
      toast.error(err);
      return;
    }
    const symbol = `${form.base.trim().toUpperCase()}/${form.quote}`;
    if (editing) {
      db.pairs.update(editing.id, {
        base: form.base.trim().toUpperCase(),
        quote: form.quote,
        symbol,
        contractAddress: form.contractAddress.trim(),
        chain: form.chain,
        makerFee: Number(form.makerFee),
        takerFee: Number(form.takerFee),
        minOrderSize: Number(form.minOrderSize),
        maxLeverage: Number(form.maxLeverage),
        maxPositionSize: Number(form.maxPositionSize),
        tradingHours: form.tradingHours,
        visible: form.visible,
        featured: form.featured,
      });
      bumpApiVersion();
      toast.success(`${symbol} updated.`);
    } else {
      const rng = mulberry32(Date.now() % 2147483647);
      const id = `pair_${Date.now().toString(36)}`;
      db.pairs.insert({
        id,
        symbol,
        base: form.base.trim().toUpperCase(),
        quote: form.quote,
        contractAddress: form.contractAddress.trim() || evmAddress(rng),
        chain: form.chain,
        price: 1,
        change24h: 0,
        volume24h: 0,
        openInterest: 0,
        status: "active",
        visible: form.visible,
        featured: form.featured,
        makerFee: Number(form.makerFee),
        takerFee: Number(form.takerFee),
        minOrderSize: Number(form.minOrderSize),
        maxLeverage: Number(form.maxLeverage),
        maxPositionSize: Number(form.maxPositionSize),
        tradingHours: form.tradingHours,
        createdAt: Date.now(),
      });
      bumpApiVersion();
      toast.success(`${symbol} listed successfully.`, () => {
        db.pairs.remove(id);
        bumpApiVersion();
      });
    }
    setDrawerOpen(false);
    setEditing(null);
    if (params.get("new")) setParams({}, { replace: true });
  };

  const setStatus = (p: TradingPair, status: PairStatus, label: string) => {
    const prev = p.status;
    db.pairs.update(p.id, { status });
    bumpApiVersion();
    toast.success(`${p.symbol} ${label}.`, () => {
      db.pairs.update(p.id, { status: prev });
      bumpApiVersion();
    });
  };

  const toggleFlag = (p: TradingPair, key: "visible" | "featured") => {
    db.pairs.update(p.id, { [key]: !p[key] });
    bumpApiVersion();
    toast.success(key === "visible" ? `${p.symbol} ${p.visible ? "hidden from" : "shown in"} the markets list.` : `${p.symbol} ${p.featured ? "removed from" : "added to"} featured markets.`);
  };

  const removePair = (p: TradingPair) => {
    const idx = db.pairs.all().findIndex((x) => x.id === p.id);
    db.pairs.remove(p.id);
    bumpApiVersion();
    toast.success(`${p.symbol} deleted.`, () => {
      const all = db.pairs.all();
      const next = [...all.slice(0, Math.max(0, idx)), p, ...all.slice(Math.max(0, idx))];
      db.pairs.replaceAll(next);
      bumpApiVersion();
    });
  };

  const columns: Column<TradingPair>[] = [
    {
      key: "symbol", label: "Pair", sortValue: (p) => p.symbol,
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--oui-color-primary),0.15)] text-[11px] font-bold text-[rgb(var(--oui-color-primary-light))]">
            {p.base.slice(0, 3)}
          </span>
          <div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
              {p.symbol}
              {p.featured && <StarIcon size={11} className="fill-[rgb(var(--oui-color-warning))] text-[rgb(var(--oui-color-warning))]" />}
            </div>
            <div className="font-mono text-[10px] text-white/30">{shortHash(p.contractAddress)} · {p.chain}</div>
          </div>
        </div>
      ),
      csvValue: (p) => p.symbol,
    },
    { key: "price", label: "Price", align: "right", sortValue: (p) => p.price, render: (p) => p.price < 0.01 ? p.price.toPrecision(3) : p.price.toLocaleString(), csvValue: (p) => String(p.price) },
    {
      key: "chg", label: "24h %", align: "right", sortValue: (p) => p.change24h,
      render: (p) => (
        <span className={p.change24h >= 0 ? "text-[rgb(var(--oui-color-trading-profit))]" : "text-[rgb(var(--oui-color-trading-loss))]"}>
          {p.change24h >= 0 ? "+" : ""}{p.change24h}%
        </span>
      ),
    },
    { key: "vol", label: "24h Volume", align: "right", sortValue: (p) => p.volume24h, render: (p) => fmtUsd(p.volume24h), csvValue: (p) => String(p.volume24h) },
    { key: "oi", label: "Open Interest", align: "right", sortValue: (p) => p.openInterest, render: (p) => fmtUsd(p.openInterest), defaultHidden: true },
    { key: "fees", label: "Maker / Taker", align: "right", render: (p) => <span className="text-white/60">{p.makerFee}% / {p.takerFee}%</span>, csvValue: (p) => `${p.makerFee}/${p.takerFee}` },
    { key: "lev", label: "Max lev", align: "right", sortValue: (p) => p.maxLeverage, render: (p) => `${p.maxLeverage}x` },
    { key: "status", label: "Status", sortValue: (p) => p.status, render: (p) => <Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge>, csvValue: (p) => p.status },
    {
      key: "flags", label: "Visible / Featured",
      render: (p) => (
        <div className="flex items-center gap-1">
          <button onClick={() => toggleFlag(p, "visible")} className={`rounded-md p-1.5 ${p.visible ? "text-[rgb(var(--oui-color-success))]" : "text-white/25"} hover:bg-white/10`} title={p.visible ? "Visible — click to hide" : "Hidden — click to show"}>
            {p.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button onClick={() => toggleFlag(p, "featured")} className={`rounded-md p-1.5 ${p.featured ? "text-[rgb(var(--oui-color-warning))]" : "text-white/25"} hover:bg-white/10`} title={p.featured ? "Featured — click to unfeature" : "Feature this market"}>
            {p.featured ? <Star size={14} /> : <StarOff size={14} />}
          </button>
        </div>
      ),
    },
    {
      key: "actions", label: "Actions",
      render: (p) => (
        <div className="flex items-center gap-0.5">
          <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white" title="Edit pair"><Pencil size={14} /></button>
          {p.status === "halted" ? (
            <button onClick={() => setStatus(p, "active", "resumed")} className="rounded-md p-1.5 text-[rgb(var(--oui-color-success))] hover:bg-white/10" title="Resume trading"><Play size={14} /></button>
          ) : (
            <button onClick={() => setConfirm({ pair: p, action: "Emergency halt", run: () => setStatus(p, "halted", "halted") })} className="rounded-md p-1.5 text-[rgb(var(--oui-color-danger-light))] hover:bg-white/10" title="Emergency halt"><OctagonPause size={14} /></button>
          )}
          <button
            onClick={() => setConfirm({ pair: p, action: p.status === "maintenance" ? "End maintenance" : "Maintenance mode", run: () => setStatus(p, p.status === "maintenance" ? "active" : "maintenance", p.status === "maintenance" ? "out of maintenance" : "in maintenance") })}
            className={`rounded-md p-1.5 hover:bg-white/10 ${p.status === "maintenance" ? "text-[rgb(var(--oui-color-warning))]" : "text-white/40"}`}
            title={p.status === "maintenance" ? "End maintenance" : "Maintenance mode"}
          >
            <Wrench size={14} />
          </button>
          <button onClick={() => setToDelete(p)} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-[rgb(var(--oui-color-danger-light))]" title="Delete pair"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  const activeCount = db.pairs.all().filter((p) => p.status === "active").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Trading Pair Management"
        description={`${db.pairs.count()} pairs in the sample set (${activeCount} trading). List new assets, tune fees & leverage, halt misbehaving markets.`}
        actions={
          <AdminButton variant="primary" onClick={openCreate}>
            <Plus size={15} /> List new pair
          </AdminButton>
        }
      />

      <FilterBar
        search={filters.q}
        onSearch={(v) => patch({ q: v })}
        searchPlaceholder="Search symbol, contract, chain…"
        selects={[
          { key: "status", label: "All statuses", options: ["active", "halted", "maintenance", "disabled"].map((s) => ({ value: s, label: s })) },
          { key: "chain", label: "All chains", options: CHAIN_OPTIONS.map((c) => ({ value: c, label: c })) },
          { key: "featured", label: "Featured & normal", options: [{ value: "featured", label: "Featured only" }, { value: "normal", label: "Not featured" }] },
        ]}
        values={filters}
        onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
        right={
          (filters.q || filters.status || filters.chain || filters.featured) ? (
            <AdminButton variant="ghost" className="!py-2 text-xs" onClick={reset}>Clear filters</AdminButton>
          ) : undefined
        }
      />

      <DataTable
        tableKey="pairs"
        columns={columns}
        rows={rows}
        onRowClick={openEdit}
        emptyTitle="No pairs match"
        emptyHint="List your first asset with the button above."
        bulkActions={(sel, clear) => (
          <>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((p) => db.pairs.update(p.id, { featured: true })); bumpApiVersion(); toast.success(`${sel.length} pairs featured.`); clear(); }}>
              <Star size={13} /> Feature
            </AdminButton>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((p) => db.pairs.update(p.id, { visible: false })); bumpApiVersion(); toast.success(`${sel.length} pairs hidden.`); clear(); }}>
              <EyeOff size={13} /> Hide
            </AdminButton>
            <AdminButton variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((p) => db.pairs.update(p.id, { status: "halted" })); bumpApiVersion(); toast.success(`${sel.length} pairs halted.`); clear(); }}>
              <OctagonPause size={13} /> Halt
            </AdminButton>
          </>
        )}
      />

      {/* Create / edit drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditing(null); if (params.get("new")) setParams({}, { replace: true }); }}
        title={editing ? `Edit ${editing.symbol}` : "List new trading pair"}
        subtitle={editing ? "Changes save to the mock listings store." : "e.g. PEPE/USDT with its token contract address and fee schedule."}
        width={480}
        footer={
          <>
            <AdminButton onClick={() => setDrawerOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={save}>{editing ? "Save changes" : "Create pair"}</AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base asset" hint="Ticker, e.g. PEPE">
              <TextInput value={form.base} onChange={(e) => set({ base: e.target.value.toUpperCase() })} placeholder="PEPE" />
            </Field>
            <Field label="Quote asset">
              <Select value={form.quote} onChange={(e) => set({ quote: e.target.value as "USDT" | "USDC" })}>
                <option>USDT</option>
                <option>USDC</option>
              </Select>
            </Field>
          </div>

          <Field label="Token contract address" hint={form.chain === "Solana" ? "Solana mint address." : "0x… address on the selected chain (42 chars)."}>
            <TextInput value={form.contractAddress} onChange={(e) => set({ contractAddress: e.target.value })} placeholder="0x6982508145454Ce325dDbE47a25d4ec3d2311933" className="font-mono text-xs" />
          </Field>

          <Field label="Chain">
            <Select value={form.chain} onChange={(e) => set({ chain: e.target.value })}>
              {CHAIN_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Maker fee (%)" hint="Commission on maker orders.">
              <TextInput type="number" step="0.005" value={form.makerFee} onChange={(e) => set({ makerFee: e.target.value })} />
            </Field>
            <Field label="Taker fee (%)">
              <TextInput type="number" step="0.005" value={form.takerFee} onChange={(e) => set({ takerFee: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min order size ($)">
              <TextInput type="number" value={form.minOrderSize} onChange={(e) => set({ minOrderSize: e.target.value })} />
            </Field>
            <Field label="Max leverage">
              <Select value={form.maxLeverage} onChange={(e) => set({ maxLeverage: e.target.value })}>
                {LEVERAGE_OPTIONS.map((l) => <option key={l} value={l}>{l}x</option>)}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Max position size ($)">
              <TextInput type="number" step="100000" value={form.maxPositionSize} onChange={(e) => set({ maxPositionSize: e.target.value })} />
            </Field>
            <Field label="Trading hours">
              <Select value={form.tradingHours} onChange={(e) => set({ tradingHours: e.target.value })}>
                {HOURS_OPTIONS.map((h) => <option key={h}>{h}</option>)}
              </Select>
            </Field>
          </div>

          <div className="space-y-3 rounded-lg border border-white/10 p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/80">Visible in markets</div>
                <div className="text-[11px] text-white/35">Traders can see this pair in the markets list.</div>
              </div>
              <Toggle checked={form.visible} onChange={(v) => set({ visible: v })} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white/80">Featured market</div>
                <div className="text-[11px] text-white/35">Pinned at the top of the markets list.</div>
              </div>
              <Toggle checked={form.featured} onChange={(v) => set({ featured: v })} />
            </div>
          </div>
        </div>
      </Drawer>

      {/* Delete confirm */}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && removePair(toDelete)}
        title={`Delete ${toDelete?.symbol}?`}
        message={
          <>
            This removes the pair from listings. Open positions would need to be settled first in a real deployment.
            <div className="mt-2 font-mono text-xs text-white/40">{toDelete?.contractAddress}</div>
          </>
        }
        confirmLabel="Delete pair"
        danger
      />

      {/* Halt / maintenance confirm */}
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm?.run()}
        title={`${confirm?.action} — ${confirm?.pair.symbol}`}
        message={
          confirm?.action === "Emergency halt"
            ? "Halting immediately stops matching for this market. Traders can only reduce positions. Use for oracle or liquidity incidents."
            : "Maintenance mode disables new orders while you upgrade market config."
        }
        confirmLabel={confirm?.action}
        danger={confirm?.action === "Emergency halt"}
      />

      <p className="text-[11px] text-white/30">
        Last sample update {timeAgo(Date.now() - 6 * 60_000)} · changes persist in this browser&apos;s mock store (undo offered via toast).
      </p>
    </div>
  );
}
