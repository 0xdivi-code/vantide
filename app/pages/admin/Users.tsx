import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UserPlus, Ban, Snowflake, PauseCircle, UserCheck } from "lucide-react";
import { db } from "@/admin/mock/db";
import { matches, useMockApiVersion, bumpApiVersion } from "@/admin/mock/api";
import { fmtNum, fmtUsd, shortHash, timeAgo , evmAddress } from "@/admin/mock/rng";
import type { MockUser, UserStatus } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Field, TextInput, Select } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, useToast } from "@/admin/components/feedback";
import { COUNTRIES } from "@/admin/mock/data";

const STATUS_TONE: Record<UserStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  suspended: "warning",
  frozen: "warning",
  banned: "danger",
};

export function userStatusBadge(status: UserStatus) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

export default function AdminUsers() {
  useMockApiVersion();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const [filters, patch, reset] = useSavedFilters("users", {
    q: params.get("q") ?? "",
    status: "",
    kyc: "",
    tier: "",
  });
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newCountry, setNewCountry] = useState("Nigeria");

  const rows = useMemo(() => {
    return db.users
      .all()
      .filter(
        (u) =>
          matches([u.wallet, u.email, u.id, u.country], filters.q) &&
          (!filters.status || u.status === filters.status) &&
          (!filters.kyc || u.kyc === filters.kyc) &&
          (!filters.tier || u.tier === filters.tier)
      )
      .sort((a, b) => b.lastLoginAt - a.lastLoginAt);
  }, [filters]);

  const setStatus = (users: MockUser[], status: UserStatus) => {
    users.forEach((u) => db.users.update(u.id, { status, tradingEnabled: status === "active" ? u.tradingEnabled : false }));
    bumpApiVersion();
    toast.success(`${users.length} user${users.length > 1 ? "s" : ""} ${status}.`);
  };

  const addUser = () => {
    if (!newEmail.includes("@")) {
      toast.error("Enter a valid email address.");
      return;
    }
    const id = `usr_${Math.floor(100000 + Math.random() * 899999)}`;
    db.users.insert({
      id,
      wallet: evmAddress(Math.random),
      email: newEmail,
      country: newCountry,
      tier: "VIP 0",
      kyc: "none",
      status: "active",
      tradingEnabled: true,
      balance: 0,
      equity: 0,
      pnl30d: 0,
      totalVolume: 0,
      totalTrades: 0,
      referralCount: 0,
      lastLoginAt: Date.now(),
      createdAt: Date.now(),
      ip: "—",
    });
    bumpApiVersion();
    setAddOpen(false);
    setNewEmail("");
    toast.success("User created.", () => {
      db.users.remove(id);
      bumpApiVersion();
    });
  };

  const columns: Column<MockUser>[] = [
    {
      key: "user", label: "User", sortValue: (u) => u.email,
      render: (u) => (
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-white">{u.email}</div>
          <div className="font-mono text-[11px] text-white/35">{shortHash(u.wallet)}</div>
        </div>
      ),
      csvValue: (u) => u.email,
    },
    { key: "country", label: "Country", sortValue: (u) => u.country, csvValue: (u) => u.country },
    { key: "tier", label: "Tier", sortValue: (u) => u.tier, render: (u) => <Badge tone={u.tier === "VIP 0" ? "neutral" : "primary"}>{u.tier}</Badge>, csvValue: (u) => u.tier },
    { key: "balance", label: "Balance", align: "right", sortValue: (u) => u.balance, render: (u) => fmtUsd(u.balance), csvValue: (u) => String(u.balance) },
    { key: "volume", label: "Volume", align: "right", sortValue: (u) => u.totalVolume, render: (u) => fmtUsd(u.totalVolume), csvValue: (u) => String(u.totalVolume) },
    {
      key: "pnl", label: "PnL 30d", align: "right", sortValue: (u) => u.pnl30d,
      render: (u) => (
        <span className={u.pnl30d >= 0 ? "text-[rgb(var(--oui-color-trading-profit))]" : "text-[rgb(var(--oui-color-trading-loss))]"}>
          {u.pnl30d >= 0 ? "+" : ""}{fmtUsd(u.pnl30d)}
        </span>
      ),
      csvValue: (u) => String(u.pnl30d),
    },
    { key: "kyc", label: "KYC", sortValue: (u) => u.kyc, render: (u) => <Badge tone={u.kyc === "verified" ? "success" : u.kyc === "none" ? "neutral" : u.kyc === "rejected" ? "danger" : "warning"}>{u.kyc}</Badge>, csvValue: (u) => u.kyc },
    { key: "status", label: "Status", sortValue: (u) => u.status, render: (u) => userStatusBadge(u.status), csvValue: (u) => u.status },
    { key: "lastLogin", label: "Last login", sortValue: (u) => u.lastLoginAt, render: (u) => <span className="text-white/45">{timeAgo(u.lastLoginAt)}</span>, defaultHidden: true },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Management"
        description={`${fmtNum(db.users.count())} sampled accounts (of 102,438 total). Search, filter, inspect, and take action.`}
        actions={
          <AdminButton variant="primary" onClick={() => setAddOpen(true)}>
            <UserPlus size={15} /> Add user
          </AdminButton>
        }
      />

      <FilterBar
        search={filters.q}
        onSearch={(v) => patch({ q: v })}
        searchPlaceholder="Search wallet, email, ID, country…"
        selects={[
          { key: "status", label: "All statuses", options: ["active", "suspended", "frozen", "banned"].map((s) => ({ value: s, label: s })) },
          { key: "kyc", label: "All KYC", options: ["verified", "pending", "review", "rejected", "none"].map((s) => ({ value: s, label: s })) },
          { key: "tier", label: "All tiers", options: [0, 1, 2, 3, 4, 5].map((n) => ({ value: `VIP ${n}`, label: `VIP ${n}` })) },
        ]}
        values={filters}
        onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
        right={
          (filters.q || filters.status || filters.kyc || filters.tier) ? (
            <AdminButton variant="ghost" className="!py-2 text-xs" onClick={reset}>
              Clear filters
            </AdminButton>
          ) : undefined
        }
      />

      <DataTable
        tableKey="users"
        columns={columns}
        rows={rows}
        onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
        emptyTitle="No users match these filters"
        emptyHint="Try broadening your search or clearing filters."
        bulkActions={(sel, clear) => (
          <>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { setStatus(sel, "suspended"); clear(); }}>
              <PauseCircle size={13} /> Suspend
            </AdminButton>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => { setStatus(sel, "frozen"); clear(); }}>
              <Snowflake size={13} /> Freeze
            </AdminButton>
            <AdminButton variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => { setStatus(sel, "banned"); clear(); }}>
              <Ban size={13} /> Ban
            </AdminButton>
            <AdminButton variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => toast.info(`${sel.length} users queued for KYC verification.`)}>
              <UserCheck size={13} /> Verify KYC
            </AdminButton>
          </>
        )}
      />

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add user"
        subtitle="Creates a mock account in the admin console."
        footer={
          <>
            <AdminButton onClick={() => setAddOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="primary" onClick={addUser}>Create user</AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Email">
            <TextInput value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="trader@example.com" />
          </Field>
          <Field label="Country">
            <Select value={newCountry} onChange={(e) => setNewCountry(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
