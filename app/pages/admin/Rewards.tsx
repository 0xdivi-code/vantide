import { useMemo, useState } from "react";
import { Gift, Plus, Play, Pause, Send } from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, useMockApiVersion } from "@/admin/mock/api";
import { uid } from "@/admin/mock/engine";
import { fmtUsd, fmtDate, fmtTime , daysFromNow } from "@/admin/mock/rng";
import type { RewardCampaign, RewardDistribution } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Field, TextInput, Select, Card } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, useToast } from "@/admin/components/feedback";

const TYPE_TONE: Record<RewardCampaign["type"], "primary" | "success" | "warning"> = {
  "Trading Competition": "primary",
  "Deposit Campaign": "success",
  "Referral Bonus": "warning",
  "Trading Rebate": "success",
  "VIP Reward": "warning",
};

export default function AdminRewards() {
  useMockApiVersion();
  const toast = useToast();
  const [filters, patch] = useSavedFilters("rewards", { q: "", status: "", type: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "Trading Competition" as RewardCampaign["type"],
    pool: "50000", days: "21", rules: "Ranked by trading volume. Min $10K volume to qualify.",
  });

  const campaigns = useMemo(
    () =>
      db.campaigns
        .all()
        .filter(
          (c) =>
            c.name.toLowerCase().includes(filters.q.toLowerCase()) &&
            (!filters.status || c.status === filters.status) &&
            (!filters.type || c.type === filters.type)
        )
        .sort((a, b) => b.startAt - a.startAt),
    [filters]
  );

  const distributions = useMemo(() => db.distributions.all(), []);

  const setStatus = (c: RewardCampaign, status: RewardCampaign["status"]) => {
    db.campaigns.update(c.id, { status });
    bumpApiVersion();
    toast.success(`${c.name} is now ${status}.`);
  };

  const distribute = (c: RewardCampaign) => {
    const remaining = Math.max(0, c.pool - c.distributed);
    if (remaining <= 0) {
      toast.error("Pool fully distributed.");
      return;
    }
    const batch = Math.min(remaining, c.pool * 0.25);
    const count = 24;
    const rows: RewardDistribution[] = Array.from({ length: count }, (_, i) => ({
      id: uid("dst"),
      campaign: c.name,
      user: `usr_${100001 + i * 7}`,
      amount: Math.round((batch / count) * 100) / 100,
      ts: Date.now(),
    }));
    db.distributions.insertMany(rows);
    db.campaigns.update(c.id, { distributed: c.distributed + batch, status: c.distributed + batch >= c.pool ? "ended" : c.status });
    bumpApiVersion();
    toast.success(`${fmtUsd(batch)} distributed to ${count} winners of ${c.name}.`);
  };

  const create = () => {
    if (!form.name.trim()) {
      toast.error("Campaign name is required.");
      return;
    }
    const pool = Number(form.pool);
    if (!pool || pool <= 0) {
      toast.error("Enter a valid reward pool.");
      return;
    }
    const id = uid("cmp");
    db.campaigns.insert({
      id,
      name: form.name.trim(),
      type: form.type,
      pool,
      distributed: 0,
      startAt: Date.now(),
      endAt: daysFromNow(Number(form.days) || 21),
      status: "draft",
      rules: form.rules,
    });
    bumpApiVersion();
    setCreateOpen(false);
    setForm({ ...form, name: "" });
    toast.success("Campaign created as draft — activate when ready.", () => {
      db.campaigns.remove(id);
      bumpApiVersion();
    });
  };

  const cols: Column<RewardCampaign>[] = [
    { key: "name", label: "Campaign", sortValue: (c) => c.name, render: (c) => <span className="font-medium text-white">{c.name}</span>, csvValue: (c) => c.name },
    { key: "type", label: "Type", sortValue: (c) => c.type, render: (c) => <Badge tone={TYPE_TONE[c.type]}>{c.type}</Badge> },
    {
      key: "pool", label: "Pool usage", align: "right",
      render: (c) => (
        <span className="flex items-center justify-end gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[rgb(var(--oui-color-primary))]" style={{ width: `${Math.min(100, (c.distributed / c.pool) * 100)}%` }} />
          </span>
          <span className="text-xs text-white/55">{fmtUsd(c.distributed)} / {fmtUsd(c.pool)}</span>
        </span>
      ),
    },
    { key: "dates", label: "Window", render: (c) => <span className="text-white/45">{fmtDate(c.startAt)} → {fmtDate(c.endAt)}</span> },
    { key: "status", label: "Status", sortValue: (c) => c.status, render: (c) => <Badge tone={c.status === "active" ? "success" : c.status === "ended" ? "neutral" : c.status === "paused" ? "warning" : "neutral"}>{c.status}</Badge>, csvValue: (c) => c.status },
    {
      key: "act", label: "",
      render: (c) => (
        <div className="flex gap-1">
          {c.status === "active" ? (
            <button onClick={() => setStatus(c, "paused")} className="rounded-md p-1.5 text-[rgb(var(--oui-color-warning))] hover:bg-white/10" title="Pause"><Pause size={13} /></button>
          ) : c.status !== "ended" ? (
            <button onClick={() => setStatus(c, "active")} className="rounded-md p-1.5 text-[rgb(var(--oui-color-success))] hover:bg-white/10" title="Activate"><Play size={13} /></button>
          ) : null}
          <button onClick={() => distribute(c)} className="rounded-md p-1.5 text-[rgb(var(--oui-color-primary-light))] hover:bg-white/10" title="Distribute rewards"><Send size={13} /></button>
        </div>
      ),
    },
  ];

  const distCols: Column<RewardDistribution>[] = [
    { key: "id", label: "Entry", render: (d) => <span className="font-mono text-xs text-white/55">{d.id}</span> },
    { key: "camp", label: "Campaign", sortValue: (d) => d.campaign },
    { key: "user", label: "User", render: (d) => <span className="font-mono text-xs text-white/50">{d.user}</span> },
    { key: "amount", label: "Amount", align: "right", sortValue: (d) => d.amount, render: (d) => <span className="text-[rgb(var(--oui-color-trading-profit))]">{fmtUsd(d.amount)}</span> },
    { key: "ts", label: "Time", sortValue: (d) => d.ts, render: (d) => <span className="text-white/45">{fmtTime(d.ts)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rewards System"
        description="Trading competitions, deposit campaigns, referral bonuses, rebates, and VIP rewards."
        actions={
          <AdminButton variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> New campaign
          </AdminButton>
        }
      />

      <FilterBar
        search={filters.q}
        onSearch={(v) => patch({ q: v })}
        searchPlaceholder="Search campaigns…"
        selects={[
          { key: "status", label: "All statuses", options: ["draft", "active", "paused", "ended"].map((s) => ({ value: s, label: s })) },
          { key: "type", label: "All types", options: ["Trading Competition", "Deposit Campaign", "Referral Bonus", "Trading Rebate", "VIP Reward"].map((t) => ({ value: t, label: t })) },
        ]}
        values={filters}
        onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
      />

      <DataTable tableKey="campaigns" columns={cols} rows={campaigns} emptyTitle="No campaigns match" bulkActions={(sel, clear) => (
        <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { sel.forEach((c) => db.campaigns.update(c.id, { status: "paused" })); bumpApiVersion(); toast.success("Campaigns paused."); clear(); }}>
          <Pause size={13} /> Pause all
        </AdminButton>
      )} />

      <Card title="Distribution history" subtitle="Latest reward payouts">
        <DataTable tableKey="distributions" columns={distCols} rows={distributions} emptyTitle="Nothing distributed yet" pageSize={8} />
      </Card>

      {/* Create */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New reward campaign"
        subtitle="Created as a draft — activate it from the campaigns table."
        wide
        footer={
          <>
            <AdminButton onClick={() => setCreateOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={create}>
              <Gift size={14} /> Create campaign
            </AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Campaign name">
              <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="October Trading Championship" />
            </Field>
            <Field label="Type">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RewardCampaign["type"] })}>
                {["Trading Competition", "Deposit Campaign", "Referral Bonus", "Trading Rebate", "VIP Reward"].map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Reward pool ($)">
              <TextInput type="number" value={form.pool} onChange={(e) => setForm({ ...form, pool: e.target.value })} />
            </Field>
            <Field label="Duration (days)">
              <TextInput type="number" value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} />
            </Field>
          </div>
          <Field label="Rules">
            <TextInput value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
