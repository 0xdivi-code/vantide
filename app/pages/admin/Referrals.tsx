import { useMemo, useState } from "react";
import { Handshake, Trophy, CircleDollarSign, Pencil } from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { fmtNum, fmtUsd, fmtTime, shortHash, timeAgo } from "@/admin/mock/rng";
import type { MockAffiliate, MockCommission } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Card, StatCard, Field, TextInput, Select } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, useToast } from "@/admin/components/feedback";
import { RankedBars } from "@/admin/components/Charts";

const LEVEL_TONE: Record<MockAffiliate["level"], "neutral" | "primary" | "warning" | "success"> = {
  Standard: "neutral",
  Bronze: "warning",
  Silver: "primary",
  Gold: "warning",
  Partner: "success",
};

export default function AdminReferrals() {
  useMockApiVersion();
  const toast = useToast();
  const [filters, patch] = useSavedFilters("referrals", { q: "", level: "" });
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [levels, setLevels] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vantide-ref-levels") || "") as Record<string, string>;
    } catch {
      return { Standard: "10", Bronze: "15", Silver: "22", Gold: "30", Partner: "40" };
    }
  });
  const [editAffiliate, setEditAffiliate] = useState<MockAffiliate | null>(null);

  const affiliates = useMemo(
    () =>
      db.affiliates
        .all()
        .filter((a) => matches([a.wallet, a.code, a.user], filters.q) && (!filters.level || a.level === filters.level))
        .sort((a, b) => b.earned - a.earned),
    [filters]
  );

  const commissions = useMemo(() => db.commissions.all(), []);

  const stats = {
    total: db.affiliates.count(),
    active: db.affiliates.all().filter((a) => a.status === "active").length,
    earned: db.affiliates.all().reduce((s, a) => s + a.earned, 0),
    pending: db.affiliates.all().reduce((s, a) => s + a.pendingPayout, 0),
  };

  const leaderboard = useMemo(
    () =>
      db.affiliates
        .all()
        .slice()
        .sort((a, b) => b.earned - a.earned)
        .slice(0, 6)
        .map((a) => ({ label: a.code, value: a.earned })),
    []
  );

  const processPayouts = () => {
    db.affiliates.all().forEach((a) => db.affiliates.update(a.id, { earned: a.earned + a.pendingPayout, pendingPayout: 0 }));
    bumpApiVersion();
    toast.success(`${fmtUsd(stats.pending)} in referral payouts processed.`);
  };

  const affCols: Column<MockAffiliate>[] = [
    { key: "code", label: "Code", sortValue: (a) => a.code, render: (a) => <span className="font-mono text-xs font-semibold text-[rgb(var(--oui-color-primary-light))]">{a.code}</span>, csvValue: (a) => a.code },
    { key: "wallet", label: "Wallet", render: (a) => <span className="font-mono text-xs text-white/40">{shortHash(a.wallet)}</span> },
    { key: "level", label: "Level", sortValue: (a) => a.level, render: (a) => <Badge tone={LEVEL_TONE[a.level]}>{a.level}</Badge>, csvValue: (a) => a.level },
    { key: "refs", label: "Referrals", align: "right", sortValue: (a) => a.referrals },
    { key: "vol", label: "Referred volume", align: "right", sortValue: (a) => a.volume, render: (a) => fmtUsd(a.volume) },
    { key: "earned", label: "Lifetime earned", align: "right", sortValue: (a) => a.earned, render: (a) => fmtUsd(a.earned) },
    { key: "pending", label: "Pending", align: "right", sortValue: (a) => a.pendingPayout, render: (a) => <span className={a.pendingPayout > 0 ? "text-[rgb(var(--oui-color-warning))]" : "text-white/35"}>{fmtUsd(a.pendingPayout)}</span> },
    { key: "status", label: "Status", sortValue: (a) => a.status, render: (a) => <Badge tone={a.status === "active" ? "success" : "neutral"}>{a.status}</Badge> },
    { key: "edit", label: "", render: (a) => <button onClick={() => setEditAffiliate({ ...a })} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><Pencil size={13} /></button> },
  ];

  const comCols: Column<MockCommission>[] = [
    { key: "id", label: "Entry", render: (c) => <span className="font-mono text-xs text-white/55">{c.id}</span> },
    { key: "aff", label: "Affiliate", sortValue: (c) => c.affiliate, render: (c) => <span className="font-mono text-xs text-[rgb(var(--oui-color-primary-light))]">{c.affiliate}</span> },
    { key: "from", label: "From user", render: (c) => <span className="font-mono text-xs text-white/45">{c.fromUser}</span> },
    { key: "pair", label: "Pair", sortValue: (c) => c.pair },
    { key: "fee", label: "Fee", align: "right", sortValue: (c) => c.fee, render: (c) => fmtUsd(c.fee) },
    { key: "rebate", label: "Rebate paid", align: "right", sortValue: (c) => c.rebate, render: (c) => <span className="text-[rgb(var(--oui-color-trading-profit))]">{fmtUsd(c.rebate)}</span> },
    { key: "ts", label: "Time", sortValue: (c) => c.ts, render: (c) => <span className="text-white/45">{fmtTime(c.ts)}</span> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Referral Management"
        description="Affiliate accounts, commission rates, payouts, and the referrer leaderboard."
        actions={
          <>
            <AdminButton onClick={() => setLevelsOpen(true)}>Commission rates</AdminButton>
            <AdminButton variant="primary" onClick={processPayouts}>
              <CircleDollarSign size={15} /> Process payouts ({fmtUsd(stats.pending)})
            </AdminButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Handshake} label="Affiliates" value={fmtNum(stats.total)} hint={`${stats.active} active`} />
        <StatCard icon={CircleDollarSign} label="Lifetime commissions" value={fmtUsd(stats.earned)} accent="success" />
        <StatCard icon={CircleDollarSign} label="Pending payouts" value={fmtUsd(stats.pending)} accent="warning" />
        <StatCard icon={Trophy} label="Top referrer earned" value={fmtUsd(leaderboard[0]?.value ?? 0)} hint={leaderboard[0]?.label} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <FilterBar
            search={filters.q}
            onSearch={(v) => patch({ q: v })}
            searchPlaceholder="Search code or wallet…"
            selects={[{ key: "level", label: "All levels", options: ["Standard", "Bronze", "Silver", "Gold", "Partner"].map((l) => ({ value: l, label: l })) }]}
            values={filters}
            onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
          />
          <DataTable tableKey="affiliates" columns={affCols} rows={affiliates} emptyTitle="No affiliates match" />
        </div>
        <Card title="Referral leaderboard" subtitle="Top earners this month">
          <RankedBars items={leaderboard} formatValue={(v) => fmtUsd(v)} />
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-white">Commission history</h2>
        <DataTable tableKey="commissions" columns={comCols} rows={commissions} emptyTitle="No commissions yet" pageSize={10} />
      </div>

      {/* Levels editor */}
      <Modal
        open={levelsOpen}
        onClose={() => setLevelsOpen(false)}
        title="Partner level commission rates"
        subtitle="Percentage of trading fees paid back to the referrer."
        footer={
          <>
            <AdminButton onClick={() => setLevelsOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={() => {
              try {
                localStorage.setItem("vantide-ref-levels", JSON.stringify(levels));
                toast.success("Commission rates saved.");
                setLevelsOpen(false);
              } catch {
                toast.error("Could not persist rates.");
              }
            }}>Save rates</AdminButton>
          </>
        }
      >
        <div className="space-y-3">
          {Object.entries(levels).map(([level, pct]) => (
            <Field key={level} label={level}>
              <TextInput
                type="number"
                value={pct}
                onChange={(e) => setLevels({ ...levels, [level]: e.target.value })}
              />
            </Field>
          ))}
        </div>
      </Modal>

      {/* Affiliate edit */}
      <Modal
        open={editAffiliate !== null}
        onClose={() => setEditAffiliate(null)}
        title={`Edit affiliate ${editAffiliate?.code}`}
        footer={
          <>
            <AdminButton onClick={() => setEditAffiliate(null)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={() => {
              if (!editAffiliate) return;
              db.affiliates.update(editAffiliate.id, editAffiliate);
              bumpApiVersion();
              setEditAffiliate(null);
              toast.success("Affiliate updated.");
            }}>Save</AdminButton>
          </>
        }
      >
        {editAffiliate && (
          <div className="space-y-4">
            <Field label="Level">
              <Select value={editAffiliate.level} onChange={(e) => setEditAffiliate({ ...editAffiliate, level: e.target.value as MockAffiliate["level"] })}>
                {["Standard", "Bronze", "Silver", "Gold", "Partner"].map((l) => <option key={l}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={editAffiliate.status} onChange={(e) => setEditAffiliate({ ...editAffiliate, status: e.target.value as "active" | "paused" })}>
                <option value="active">active</option>
                <option value="paused">paused</option>
              </Select>
            </Field>
            <div className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/45">
              {editAffiliate.referrals} referrals · {fmtUsd(editAffiliate.volume)} volume · joined {timeAgo(editAffiliate.createdAt)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
