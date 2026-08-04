import { useState } from "react";
import { Percent, Plus, Pencil, Trash2, Tag, Users2 } from "lucide-react";
import { bumpApiVersion, useMockApiVersion } from "@/admin/mock/api";
import { uid , collection } from "@/admin/mock/engine";
import { fmtDate , mulberry32, daysFromNow, float } from "@/admin/mock/rng";
import {
  PageHeader, Badge, AdminButton, Card, Field, TextInput, Select,
} from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { Modal, ConfirmDialog, useToast } from "@/admin/components/feedback";

interface VipTier {
  id: string;
  tier: string;
  minVolume: number;
  minBalance: number;
  makerFee: number;
  takerFee: number;
  rebate: number;
}

interface FeeGroup {
  id: string;
  name: string;
  members: number;
  makerFee: number;
  takerFee: number;
  note?: string;
}

interface Coupon {
  id: string;
  code: string;
  discount: number;
  uses: number;
  maxUses: number;
  expiresAt: number;
  status: "active" | "paused" | "expired";
}

function seedTiers(): VipTier[] {
  return [0, 1, 2, 3, 4, 5].map((n) => ({
    id: `tier_${n}`,
    tier: `VIP ${n}`,
    minVolume: n === 0 ? 0 : Math.round(Math.pow(10, 5 + n)),
    minBalance: n === 0 ? 0 : Math.round(Math.pow(10, 3 + n)),
    makerFee: Math.max(0, 0.02 - n * 0.0035),
    takerFee: Math.max(0.01, 0.055 - n * 0.007),
    rebate: n * 5,
  }));
}

function seedGroups(): FeeGroup[] {
  const r = mulberry32(555);
  return [
    { id: "grp_mm1", name: "Market Makers Alpha", members: 12, makerFee: 0, takerFee: 0.02, note: "Top-tier MM program" },
    { id: "grp_mm2", name: "Market Makers Beta", members: 28, makerFee: 0.005, takerFee: 0.03 },
    { id: "grp_aff", name: "Affiliate Partners", members: 86, makerFee: 0.01, takerFee: 0.04 },
    { id: "grp_staff", name: "Internal / Testing", members: 9, makerFee: 0, takerFee: 0, note: "Staff accounts" },
    { id: "grp_whales", name: "Whale Desk", members: 5, makerFee: 0.004, takerFee: float(r, 0.02, 0.03, 3) },
  ];
}

function seedCoupons(): Coupon[] {
  const defs: [string, number, number, number][] = [
    ["WELCOME50", 50, 1204, 5000], ["VIPUPGRADE", 30, 88, 500],
    ["NEWMARKET", 20, 431, 1000], ["REACTIVATE", 25, 62, 400],
    ["FLASHBONUS", 15, 2310, 10000],
  ];
  return defs.map(([code, discount, uses, maxUses], i) => ({
    id: `cpn_${i}`,
    code,
    discount,
    uses,
    maxUses,
    expiresAt: daysFromNow([30, 14, 60, 7, 3][i]),
    status: i === 3 ? "paused" : "active",
  }));
}

const tiersCol = collection("fee-tiers", seedTiers);
const groupsCol = collection("fee-groups", seedGroups);
const couponsCol = collection("fee-coupons", seedCoupons);

export default function AdminFees() {
  useMockApiVersion();
  const toast = useToast();
  const [global, setGlobal] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("vantide-global-fees") || "") as { maker: string; taker: string; withdrawal: string; deposit: string; rebate: string };
    } catch {
      return { maker: "0.02", taker: "0.055", withdrawal: "0.1", deposit: "0", rebate: "30" };
    }
  });
  const [tierEdit, setTierEdit] = useState<VipTier | null>(null);
  const [groupEdit, setGroupEdit] = useState<FeeGroup | null | "new">(null);
  const [couponEdit, setCouponEdit] = useState<Coupon | null | "new">(null);
  const [toDelete, setToDelete] = useState<{ kind: "group" | "coupon"; id: string; label: string } | null>(null);

  const saveGlobal = () => {
    try {
      localStorage.setItem("vantide-global-fees", JSON.stringify(global));
      toast.success("Global fee schedule saved.");
    } catch {
      toast.error("Could not persist fee schedule.");
    }
  };

  const tierCols: Column<VipTier>[] = [
    { key: "tier", label: "Tier", sortValue: (t) => t.tier, render: (t) => <Badge tone={t.id === "tier_0" ? "neutral" : "primary"}>{t.tier}</Badge> },
    { key: "vol", label: "30d Volume ≥", align: "right", sortValue: (t) => t.minVolume, render: (t) => t.minVolume === 0 ? "—" : `$${(t.minVolume / 1e6).toFixed(0)}M` },
    { key: "bal", label: "Balance ≥", align: "right", sortValue: (t) => t.minBalance, render: (t) => t.minBalance === 0 ? "—" : `$${(t.minBalance / 1e3).toFixed(0)}K` },
    { key: "maker", label: "Maker", align: "right", sortValue: (t) => t.makerFee, render: (t) => `${t.makerFee}%` },
    { key: "taker", label: "Taker", align: "right", sortValue: (t) => t.takerFee, render: (t) => `${t.takerFee}%` },
    { key: "rebate", label: "Referral rebate", align: "right", sortValue: (t) => t.rebate, render: (t) => `${t.rebate}%` },
    { key: "edit", label: "", render: (t) => <button onClick={() => setTierEdit({ ...t })} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><Pencil size={13} /></button> },
  ];

  const groupCols: Column<FeeGroup>[] = [
    { key: "name", label: "Group", sortValue: (g) => g.name, render: (g) => <span className="font-medium text-white">{g.name}</span> },
    { key: "members", label: "Members", align: "right", sortValue: (g) => g.members },
    { key: "maker", label: "Maker", align: "right", sortValue: (g) => g.makerFee, render: (g) => `${g.makerFee}%` },
    { key: "taker", label: "Taker", align: "right", sortValue: (g) => g.takerFee, render: (g) => `${g.takerFee}%` },
    { key: "note", label: "Note", render: (g) => <span className="text-white/40">{g.note ?? "—"}</span> },
    {
      key: "x", label: "", render: (g) => (
        <div className="flex gap-0.5">
          <button onClick={() => setGroupEdit({ ...g })} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><Pencil size={13} /></button>
          <button onClick={() => setToDelete({ kind: "group", id: g.id, label: g.name })} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-[rgb(var(--oui-color-danger-light))]"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  const couponCols: Column<Coupon>[] = [
    { key: "code", label: "Code", sortValue: (c) => c.code, render: (c) => <span className="font-mono text-xs font-semibold text-[rgb(var(--oui-color-primary-light))]">{c.code}</span> },
    { key: "disc", label: "Discount", align: "right", sortValue: (c) => c.discount, render: (c) => `${c.discount}% off fees` },
    { key: "uses", label: "Uses", align: "right", sortValue: (c) => c.uses, render: (c) => `${c.uses.toLocaleString()} / ${c.maxUses.toLocaleString()}` },
    { key: "exp", label: "Expires", sortValue: (c) => c.expiresAt, render: (c) => <span className="text-white/45">{fmtDate(c.expiresAt)}</span> },
    { key: "status", label: "Status", sortValue: (c) => c.status, render: (c) => <Badge tone={c.status === "active" ? "success" : c.status === "paused" ? "warning" : "neutral"}>{c.status}</Badge> },
    {
      key: "x", label: "", render: (c) => (
        <div className="flex gap-0.5">
          <button onClick={() => setCouponEdit({ ...c })} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"><Pencil size={13} /></button>
          <button onClick={() => setToDelete({ kind: "coupon", id: c.id, label: c.code })} className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-[rgb(var(--oui-color-danger-light))]"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Fee Management" description="Global fee schedule, VIP tiers, special fee groups, and promotional coupons." />

      {/* Global */}
      <Card title="Global trading fees" subtitle="Default schedule applied to all VIP 0 accounts">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <Field label="Maker fee (%)">
            <TextInput type="number" step="0.005" value={global.maker} onChange={(e) => setGlobal({ ...global, maker: e.target.value })} />
          </Field>
          <Field label="Taker fee (%)">
            <TextInput type="number" step="0.005" value={global.taker} onChange={(e) => setGlobal({ ...global, taker: e.target.value })} />
          </Field>
          <Field label="Withdrawal fee (%)">
            <TextInput type="number" step="0.01" value={global.withdrawal} onChange={(e) => setGlobal({ ...global, withdrawal: e.target.value })} />
          </Field>
          <Field label="Deposit fee (%)">
            <TextInput type="number" step="0.01" value={global.deposit} onChange={(e) => setGlobal({ ...global, deposit: e.target.value })} />
          </Field>
          <Field label="Referral rebate base (%)">
            <TextInput type="number" value={global.rebate} onChange={(e) => setGlobal({ ...global, rebate: e.target.value })} />
          </Field>
          <div className="flex items-end">
            <AdminButton variant="primary" className="w-full" onClick={saveGlobal}>
              <Percent size={14} /> Save
            </AdminButton>
          </div>
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-white">VIP fee tiers</h2>
        <DataTable tableKey="fees-vip" columns={tierCols} rows={tiersCol.all()} pageSize={10} emptyTitle="No tiers" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Users2 size={15} className="text-[rgb(var(--oui-color-primary-light))]" /> Special fee groups</h2>
            <AdminButton className="!px-2.5 !py-1 text-xs" onClick={() => setGroupEdit("new")}><Plus size={13} /> New group</AdminButton>
          </div>
          <DataTable tableKey="fees-groups" columns={groupCols} rows={groupsCol.all()} pageSize={6} emptyTitle="No fee groups" />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Tag size={15} className="text-[rgb(var(--oui-color-primary-light))]" /> Coupons & promotions</h2>
            <AdminButton className="!px-2.5 !py-1 text-xs" onClick={() => setCouponEdit("new")}><Plus size={13} /> New coupon</AdminButton>
          </div>
          <DataTable tableKey="fees-coupons" columns={couponCols} rows={couponsCol.all()} pageSize={6} emptyTitle="No coupons" />
        </div>
      </div>

      {/* Tier edit */}
      <Modal
        open={tierEdit !== null}
        onClose={() => setTierEdit(null)}
        title={`Edit ${tierEdit?.tier}`}
        footer={
          <>
            <AdminButton onClick={() => setTierEdit(null)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={() => {
              if (!tierEdit) return;
              tiersCol.update(tierEdit.id, tierEdit);
              bumpApiVersion();
              setTierEdit(null);
              toast.success(`${tierEdit.tier} fees updated.`);
            }}>Save tier</AdminButton>
          </>
        }
      >
        {tierEdit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Maker fee (%)">
                <TextInput type="number" step="0.001" value={tierEdit.makerFee} onChange={(e) => setTierEdit({ ...tierEdit, makerFee: Number(e.target.value) })} />
              </Field>
              <Field label="Taker fee (%)">
                <TextInput type="number" step="0.001" value={tierEdit.takerFee} onChange={(e) => setTierEdit({ ...tierEdit, takerFee: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min 30d volume ($)">
                <TextInput type="number" value={tierEdit.minVolume} onChange={(e) => setTierEdit({ ...tierEdit, minVolume: Number(e.target.value) })} />
              </Field>
              <Field label="Min balance ($)">
                <TextInput type="number" value={tierEdit.minBalance} onChange={(e) => setTierEdit({ ...tierEdit, minBalance: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Referral rebate (%)">
              <TextInput type="number" value={tierEdit.rebate} onChange={(e) => setTierEdit({ ...tierEdit, rebate: Number(e.target.value) })} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Group edit/new */}
      <Modal
        open={groupEdit !== null}
        onClose={() => setGroupEdit(null)}
        title={groupEdit === "new" ? "New fee group" : `Edit ${groupEdit?.name}`}
        footer={
          <>
            <AdminButton onClick={() => setGroupEdit(null)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={() => {
              if (!groupEdit || groupEdit === "new") {
                groupsCol.insert({ id: uid("grp"), name: "New group", members: 0, makerFee: 0.01, takerFee: 0.04 });
                toast.success("Fee group created.");
              } else {
                groupsCol.update(groupEdit.id, groupEdit);
                toast.success("Fee group updated.");
              }
              bumpApiVersion();
              setGroupEdit(null);
            }}>{groupEdit === "new" ? "Create" : "Save"}</AdminButton>
          </>
        }
      >
        {groupEdit && groupEdit !== "new" && (
          <div className="space-y-4">
            <Field label="Group name">
              <TextInput value={groupEdit.name} onChange={(e) => setGroupEdit({ ...groupEdit, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Maker fee (%)">
                <TextInput type="number" step="0.001" value={groupEdit.makerFee} onChange={(e) => setGroupEdit({ ...groupEdit, makerFee: Number(e.target.value) })} />
              </Field>
              <Field label="Taker fee (%)">
                <TextInput type="number" step="0.001" value={groupEdit.takerFee} onChange={(e) => setGroupEdit({ ...groupEdit, takerFee: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Note">
              <TextInput value={groupEdit.note ?? ""} onChange={(e) => setGroupEdit({ ...groupEdit, note: e.target.value })} />
            </Field>
          </div>
        )}
        {groupEdit === "new" && <p className="text-sm text-white/55">A sample group will be created — edit it right after to set details.</p>}
      </Modal>

      {/* Coupon edit/new */}
      <Modal
        open={couponEdit !== null}
        onClose={() => setCouponEdit(null)}
        title={couponEdit === "new" ? "New coupon" : `Edit ${couponEdit?.code}`}
        footer={
          <>
            <AdminButton onClick={() => setCouponEdit(null)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={() => {
              if (couponEdit === "new") {
                couponsCol.insert({ id: uid("cpn"), code: `PROMO${Math.floor(Math.random() * 900 + 100)}`, discount: 20, uses: 0, maxUses: 1000, expiresAt: daysFromNow(30), status: "active" });
                toast.success("Coupon created.");
              } else if (couponEdit) {
                couponsCol.update(couponEdit.id, couponEdit);
                toast.success("Coupon updated.");
              }
              bumpApiVersion();
              setCouponEdit(null);
            }}>{couponEdit === "new" ? "Create" : "Save"}</AdminButton>
          </>
        }
      >
        {couponEdit && couponEdit !== "new" && (
          <div className="space-y-4">
            <Field label="Code">
              <TextInput value={couponEdit.code} onChange={(e) => setCouponEdit({ ...couponEdit, code: e.target.value.toUpperCase() })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Discount (%)">
                <TextInput type="number" value={couponEdit.discount} onChange={(e) => setCouponEdit({ ...couponEdit, discount: Number(e.target.value) })} />
              </Field>
              <Field label="Max uses">
                <TextInput type="number" value={couponEdit.maxUses} onChange={(e) => setCouponEdit({ ...couponEdit, maxUses: Number(e.target.value) })} />
              </Field>
              <Field label="Status">
                <Select value={couponEdit.status} onChange={(e) => setCouponEdit({ ...couponEdit, status: e.target.value as Coupon["status"] })}>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="expired">expired</option>
                </Select>
              </Field>
            </div>
          </div>
        )}
        {couponEdit === "new" && <p className="text-sm text-white/55">A sample coupon will be created — edit it right after to set details.</p>}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return;
          if (toDelete.kind === "group") groupsCol.remove(toDelete.id);
          else couponsCol.remove(toDelete.id);
          bumpApiVersion();
          toast.success(`${toDelete.label} deleted.`);
        }}
        title={`Delete ${toDelete?.label}?`}
        message="This removes the entry from the mock fee configuration."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
