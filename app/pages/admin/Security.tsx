import { useMemo, useState } from "react";
import {
  ShieldCheck, KeyRound, Ban, Plus, Trash2, Lock, Bot, AlertTriangle, Clock, Check,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { bumpApiVersion, matches, useMockApiVersion } from "@/admin/mock/api";
import { uid } from "@/admin/mock/engine";
import { fmtNum, fmtTime, timeAgo } from "@/admin/mock/rng";
import type { LoginRecord, BlockedIp, SecurityAlert } from "@/admin/mock/types";
import { PageHeader, Badge, AdminButton, Card, StatCard, Field, TextInput, Select, Toggle } from "@/admin/components/ui";
import { DataTable, type Column } from "@/admin/components/DataTable";
import { FilterBar, useSavedFilters } from "@/admin/components/FilterBar";
import { Modal, useToast } from "@/admin/components/feedback";

interface SecurityPolicy {
  enforce2fa: boolean;
  captcha: boolean;
  botDetection: boolean;
  sessionTimeout: string;
  passwordMinLength: string;
  passwordRequireSymbol: boolean;
  newDeviceAlert: boolean;
  ipAllowlistEnabled: boolean;
}

const POLICY_KEY = "vantide-security-policy";

const SEV_TONE: Record<SecurityAlert["severity"], "danger" | "warning" | "primary" | "neutral"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export default function AdminSecurity() {
  useMockApiVersion();
  const toast = useToast();
  const [filters, patch] = useSavedFilters("security-logins", { q: "", result: "" });
  const [ipInput, setIpInput] = useState("");
  const [addIpOpen, setAddIpOpen] = useState(false);
  const [policy, setPolicy] = useState<SecurityPolicy>(() => {
    const defaults: SecurityPolicy = {
      enforce2fa: true,
      captcha: true,
      botDetection: true,
      sessionTimeout: "30",
      passwordMinLength: "10",
      passwordRequireSymbol: true,
      newDeviceAlert: true,
      ipAllowlistEnabled: false,
    };
    try {
      const raw = localStorage.getItem(POLICY_KEY);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return defaults;
  });

  const logins = useMemo(
    () =>
      db.logins
        .all()
        .filter(
          (l) =>
            matches([l.user, l.ip, l.country, l.device], filters.q) &&
            (!filters.result || (filters.result === "success" ? l.success : !l.success)),
        ),
    [filters],
  );

  const failed24h = db.logins.all().filter((l) => !l.success && l.ts > Date.now() - 86_400_000).length;
  const blocked = db.blockedIps.all();
  const unresolvedAlerts = db.securityAlerts.all().filter((a) => !a.resolved);

  const savePolicy = () => {
    try {
      localStorage.setItem(POLICY_KEY, JSON.stringify(policy));
      toast.success("Security policy saved.");
    } catch {
      toast.error("Could not persist policy.");
    }
  };

  const loginCols: Column<LoginRecord>[] = [
    { key: "ts", label: "Time", sortValue: (l) => l.ts, render: (l) => <span className="text-white/45">{fmtTime(l.ts)}</span> },
    { key: "user", label: "User", sortValue: (l) => l.user, render: (l) => <span className="font-mono text-xs text-white/60">{l.user}</span> },
    { key: "ip", label: "IP", render: (l) => <span className="font-mono text-xs text-white/50">{l.ip}</span> },
    { key: "country", label: "Country", sortValue: (l) => l.country },
    { key: "device", label: "Device", sortValue: (l) => l.device, defaultHidden: true },
    {
      key: "result", label: "Result", sortValue: (l) => String(l.success),
      render: (l) => <Badge tone={l.success ? "success" : "danger"}>{l.success ? "success" : "failed"}</Badge>,
      csvValue: (l) => String(l.success),
    },
    {
      key: "act", label: "",
      render: (l) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            db.blockedIps.insert({ id: uid("bip"), ip: l.ip, reason: "Blocked from login history", ts: Date.now() });
            bumpApiVersion();
            toast.success(`${l.ip} blocked.`);
          }}
          className="rounded-md p-1.5 text-white/30 hover:bg-white/10 hover:text-[rgb(var(--oui-color-danger-light))]"
          title="Block this IP"
        >
          <Ban size={12} />
        </button>
      ),
    },
  ];

  const ipCols: Column<BlockedIp>[] = [
    { key: "ip", label: "IP address", sortValue: (b) => b.ip, render: (b) => <span className="font-mono text-xs text-white/70">{b.ip}</span>, csvValue: (b) => b.ip },
    { key: "reason", label: "Reason", sortValue: (b) => b.reason, render: (b) => <span className="text-white/60">{b.reason}</span> },
    { key: "ts", label: "Blocked", sortValue: (b) => b.ts, render: (b) => <span className="text-white/40">{timeAgo(b.ts)}</span> },
    {
      key: "x", label: "",
      render: (b) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            db.blockedIps.remove(b.id);
            bumpApiVersion();
            toast.success(`${b.ip} unblocked.`);
          }}
          className="rounded-md p-1.5 text-white/30 hover:bg-white/10 hover:text-[rgb(var(--oui-color-danger-light))]"
          title="Unblock"
        >
          <Trash2 size={13} />
        </button>
      ),
    },
  ];

  const alertCols: Column<SecurityAlert>[] = [
    { key: "sev", label: "Severity", sortValue: (a) => a.severity, render: (a) => <Badge tone={SEV_TONE[a.severity]}>{a.severity}</Badge>, csvValue: (a) => a.severity },
    { key: "title", label: "Alert", render: (a) => <div><div className="font-medium text-white">{a.title}</div><div className="text-[11px] text-white/35">{a.detail}</div></div> },
    { key: "ts", label: "Time", sortValue: (a) => a.ts, render: (a) => <span className="text-white/40">{timeAgo(a.ts)}</span> },
    {
      key: "status", label: "Status",
      render: (a) =>
        a.resolved ? (
          <Badge tone="success">resolved</Badge>
        ) : (
          <AdminButton
            variant="ghost"
            className="!px-2 !py-1 text-[11px] text-[rgb(var(--oui-color-success))]"
            onClick={(e) => {
              e.stopPropagation();
              db.securityAlerts.update(a.id, { resolved: true });
              bumpApiVersion();
              toast.success("Alert resolved.");
            }}
          >
            <Check size={12} /> Resolve
          </AdminButton>
        ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Security Center" description="Access policies, login monitoring, IP controls, and security alerts." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Security posture" value="Strong" hint="All checks passing" accent="success" />
        <StatCard icon={Clock} label="Failed logins (24h)" value={fmtNum(failed24h)} hint={`${db.logins.count()} total records`} accent={failed24h > 40 ? "danger" : "warning"} />
        <StatCard icon={Ban} label="Blocked IPs" value={blocked.length} accent={blocked.length > 25 ? "warning" : "primary"} />
        <StatCard icon={AlertTriangle} label="Open alerts" value={unresolvedAlerts.length} accent={unresolvedAlerts.length > 5 ? "danger" : "primary"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Policy */}
        <Card title="Access policies" subtitle="Authentication & session hardening" className="xl:col-span-1">
          <div className="space-y-4">
            {[
              { key: "enforce2fa" as const, label: "Enforce 2FA", hint: "Require authenticator for all withdrawals & admin access.", icon: KeyRound },
              { key: "captcha" as const, label: "Captcha on login", hint: "Challenge after 3 failed attempts.", icon: Lock },
              { key: "botDetection" as const, label: "Bot detection", hint: "Behavioral analysis on trading endpoints.", icon: Bot },
              { key: "newDeviceAlert" as const, label: "New device alerts", hint: "Email users on unrecognized devices.", icon: AlertTriangle },
              { key: "ipAllowlistEnabled" as const, label: "Admin IP allowlist", hint: "Restrict /admin to allowlisted IPs.", icon: ShieldCheck },
            ].map((row) => (
              <div key={row.key} className="flex items-center justify-between rounded-lg border border-white/10 p-3">
                <div className="flex items-start gap-2.5">
                  <row.icon size={15} className="mt-0.5 text-[rgb(var(--oui-color-primary-light))]" />
                  <div>
                    <div className="text-sm text-white/80">{row.label}</div>
                    <div className="text-[11px] text-white/35">{row.hint}</div>
                  </div>
                </div>
                <Toggle checked={policy[row.key]} onChange={(v) => setPolicy({ ...policy, [row.key]: v })} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Session timeout (min)">
                <Select value={policy.sessionTimeout} onChange={(e) => setPolicy({ ...policy, sessionTimeout: e.target.value })}>
                  {["15", "30", "60", "120"].map((v) => <option key={v} value={v}>{v} min</option>)}
                </Select>
              </Field>
              <Field label="Min password length">
                <Select value={policy.passwordMinLength} onChange={(e) => setPolicy({ ...policy, passwordMinLength: e.target.value })}>
                  {["8", "10", "12", "16"].map((v) => <option key={v} value={v}>{v} chars</option>)}
                </Select>
              </Field>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Require symbol in password</span>
              <Toggle checked={policy.passwordRequireSymbol} onChange={(v) => setPolicy({ ...policy, passwordRequireSymbol: v })} />
            </div>
            <AdminButton variant="primary" className="w-full" onClick={savePolicy}>
              Save security policy
            </AdminButton>
            <div className="rounded-lg bg-[rgba(var(--oui-color-success),0.08)] px-3 py-2 text-[11px] text-[rgb(var(--oui-color-success))]">
              Encryption: AES-256 at rest · TLS 1.3 in transit · HSM key custody
            </div>
          </div>
        </Card>

        {/* Blocked IPs + alerts */}
        <div className="space-y-4 xl:col-span-2">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Blocked IPs</h2>
              <AdminButton className="!px-2.5 !py-1 text-xs" onClick={() => setAddIpOpen(true)}>
                <Plus size={13} /> Block IP
              </AdminButton>
            </div>
            <DataTable tableKey="blocked-ips" columns={ipCols} rows={blocked} emptyTitle="No blocked IPs" pageSize={5} />
          </div>
          <div>
            <h2 className="mb-2 text-sm font-semibold text-white">Security alerts</h2>
            <DataTable tableKey="security-alerts" columns={alertCols} rows={db.securityAlerts.all()} emptyTitle="No alerts" pageSize={5} />
          </div>
        </div>
      </div>

      {/* Login history */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Login history</h2>
        <FilterBar
          search={filters.q}
          onSearch={(v) => patch({ q: v })}
          searchPlaceholder="Search user, IP, country, device…"
          selects={[{ key: "result", label: "Success & failed", options: [{ value: "success", label: "Success only" }, { value: "failed", label: "Failed only" }] }]}
          values={filters}
          onSelect={(k, v) => patch({ [k]: v } as Partial<typeof filters>)}
        />
        <DataTable tableKey="logins" columns={loginCols} rows={logins} emptyTitle="No login records match" />
      </div>

      {/* Block IP */}
      <Modal
        open={addIpOpen}
        onClose={() => setAddIpOpen(false)}
        title="Block IP address"
        footer={
          <>
            <AdminButton onClick={() => setAddIpOpen(false)}>Cancel</AdminButton>
            <AdminButton variant="danger" onClick={() => {
              const ip = ipInput.trim();
              if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
                toast.error("Enter a valid IPv4 address.");
                return;
              }
              db.blockedIps.insert({ id: uid("bip"), ip, reason: "Manually blocked by admin", ts: Date.now() });
              bumpApiVersion();
              setAddIpOpen(false);
              setIpInput("");
              toast.success(`${ip} blocked.`);
            }}>
              <Ban size={14} /> Block
            </AdminButton>
          </>
        }
      >
        <Field label="IP address" hint="All traffic from this IP will be dropped at the edge.">
          <TextInput value={ipInput} onChange={(e) => setIpInput(e.target.value)} placeholder="203.0.113.42" className="font-mono text-sm" />
        </Field>
      </Modal>
    </div>
  );
}
