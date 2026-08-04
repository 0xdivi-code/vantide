import { useState } from "react";
import { Link } from "react-router-dom";
import { Settings2, Paintbrush, Globe2, Moon, RefreshCw, AlertOctagon, Languages } from "lucide-react";
import { getRuntimeConfig } from "@/utils/runtime-config";
import { setAdminOverride, removeAdminOverride, clearAdminOverrides, generateConfigJs } from "@/admin/adminStore";
import { useConfigVersion } from "@/admin/useConfigVersion";
import { resetAllMockStorage } from "@/admin/mock/engine";
import { bumpApiVersion } from "@/admin/mock/api";
import { PageHeader, Badge, AdminButton, Card, Field, TextInput, Select, Toggle } from "@/admin/components/ui";
import { ConfirmDialog, useToast } from "@/admin/components/feedback";

interface PlatformSettings {
  exchangeName: string;
  status: string;
  maintenance: boolean;
  maintenanceMessage: string;
  defaultCurrency: string;
  timezone: string;
  languages: string;
  darkMode: boolean;
}

const SYS_KEY = "vantide-platform-settings";

function loadSettings(): PlatformSettings {
  const defaults: PlatformSettings = {
    exchangeName: getRuntimeConfig("VITE_APP_NAME") || "Vantide",
    status: "operational",
    maintenance: false,
    maintenanceMessage: "We're upgrading the matching engine. Trading resumes at 03:30 UTC.",
    defaultCurrency: "USD",
    timezone: "UTC",
    languages: "en,zh,es",
    darkMode: true,
  };
  try {
    const raw = localStorage.getItem(SYS_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults;
}

export default function AdminSystem() {
  useConfigVersion();
  const toast = useToast();
  const [settings, setSettings] = useState<PlatformSettings>(loadSettings);
  const [confirmAction, setConfirmAction] = useState<"reset-mock" | "reset-all" | null>(null);

  const set = (p: Partial<PlatformSettings>) => setSettings((s) => ({ ...s, ...p }));

  const save = () => {
    try {
      localStorage.setItem(SYS_KEY, JSON.stringify(settings));
      setAdminOverride("VITE_APP_NAME", settings.exchangeName);
      setAdminOverride("VITE_ORDERLY_BROKER_NAME", settings.exchangeName);
      setAdminOverride("VITE_PLATFORM_STATUS", settings.status);
      setAdminOverride("VITE_MAINTENANCE_MODE", settings.maintenance ? "true" : "false");
      toast.success("Platform settings saved & applied.");
    } catch {
      toast.error("Could not persist settings.");
    }
  };

  const download = () => {
    const blob = new Blob([generateConfigJs()], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "config.js";
    a.click();
    URL.revokeObjectURL(url);
  };

  const appVersion = "2.4.1-mock";
  const statusColors: Record<string, "success" | "warning" | "danger"> = {
    operational: "success",
    degraded: "warning",
    maintenance: "danger",
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="System Settings"
        description="Exchange identity, platform status, and environment. Changes marked LIVE apply to the dapp instantly."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Identity */}
        <Card title="Exchange identity" subtitle="Name shown across the app and emails">
          <div className="space-y-4">
            <Field label="Exchange name" hint="LIVE — applied to the running dapp immediately.">
              <TextInput value={settings.exchangeName} onChange={(e) => set({ exchangeName: e.target.value })} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-white/10 p-3.5">
              <div className="flex items-center gap-3">
                <Paintbrush size={16} className="text-[rgb(var(--oui-color-primary-light))]" />
                <div>
                  <div className="text-sm text-white/80">Logo & brand colors</div>
                  <div className="text-[11px] text-white/35">Managed visually in Appearance.</div>
                </div>
              </div>
              <Link to="/admin/appearance">
                <AdminButton>Open Appearance</AdminButton>
              </Link>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 p-3.5">
              <div className="flex items-center gap-3">
                <Moon size={16} className="text-[rgb(var(--oui-color-primary-light))]" />
                <div>
                  <div className="text-sm text-white/80">Dark mode</div>
                  <div className="text-[11px] text-white/35">The admin theme from Appearance follows this.</div>
                </div>
              </div>
              <Toggle checked={settings.darkMode} onChange={(v) => set({ darkMode: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default currency">
                <Select value={settings.defaultCurrency} onChange={(e) => set({ defaultCurrency: e.target.value })}>
                  {["USD", "EUR", "GBP", "NGN", "BRL"].map((c) => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Timezone">
                <Select value={settings.timezone} onChange={(e) => set({ timezone: e.target.value })}>
                  {["UTC", "Africa/Lagos", "Europe/London", "America/New_York", "Asia/Singapore"].map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Languages" hint="Comma-separated enabled locale codes.">
              <TextInput value={settings.languages} onChange={(e) => set({ languages: e.target.value })} />
            </Field>
          </div>
        </Card>

        {/* Platform status */}
        <div className="space-y-4">
          <Card title="Platform status" subtitle="Controls the status chip users see">
            <div className="space-y-4">
              <Field label="Current status" hint="LIVE — exported config carries it to production.">
                <Select value={settings.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="operational">Operational</option>
                  <option value="degraded">Degraded performance</option>
                  <option value="maintenance">Under maintenance</option>
                </Select>
              </Field>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5">
                <span className="text-sm text-white/60">Public status</span>
                <Badge tone={statusColors[settings.status]}>{settings.status}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/10 p-3.5">
                <div>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    Maintenance mode
                    {settings.maintenance && <Badge tone="danger">ON</Badge>}
                  </div>
                  <div className="text-[11px] text-white/35">Blocks logins & trading venue-wide (mock).</div>
                </div>
                <Toggle checked={settings.maintenance} onChange={(v) => set({ maintenance: v })} />
              </div>
              {settings.maintenance && (
                <Field label="Maintenance banner message">
                  <TextInput value={settings.maintenanceMessage} onChange={(e) => set({ maintenanceMessage: e.target.value })} />
                </Field>
              )}
            </div>
          </Card>

          <Card title="Environment">
            <ul className="space-y-2.5 text-sm">
              {[
                ["Version", appVersion],
                ["Environment", "production (mock data)"],
                ["Region", "eu-west-1"],
                ["Uptime (30d)", "99.97%"],
                ["Build", "507f013 + admin-suite"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <span className="text-white/45">{k}</span>
                  <span className="font-mono text-xs text-white/80">{v}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Danger zone">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white/80">Reset mock data</div>
                  <div className="text-[11px] text-white/35">Regenerate users, pairs, trades, wallets…</div>
                </div>
                <AdminButton variant="danger" onClick={() => setConfirmAction("reset-mock")}>
                  <RefreshCw size={14} /> Reset data
                </AdminButton>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-sm text-white/80">
                    <AlertOctagon size={13} className="text-[rgb(var(--oui-color-danger-light))]" />
                    Reset everything
                  </div>
                  <div className="text-[11px] text-white/35">Mock data + all theme/config overrides</div>
                </div>
                <AdminButton variant="danger" onClick={() => setConfirmAction("reset-all")}>
                  <AlertOctagon size={14} /> Factory reset
                </AdminButton>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <AdminButton variant="primary" onClick={save}>
          <Settings2 size={15} /> Save platform settings
        </AdminButton>
        <AdminButton onClick={download}>
          <Globe2 size={15} /> Export config.js
        </AdminButton>
        <AdminButton variant="ghost" onClick={() => {
          removeAdminOverride("VITE_PLATFORM_STATUS");
          toast.info("Status override removed.");
        }}>
          Clear status override
        </AdminButton>
        <AdminButton variant="ghost" onClick={() => {
          clearAdminOverrides();
          toast.info("All config overrides cleared (theme reverts to purple).");
        }}>
          Clear all overrides
        </AdminButton>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === "reset-mock") {
            resetAllMockStorage();
            bumpApiVersion();
            toast.success("Mock data regenerated — fresh users, pairs, and ledgers.");
          } else {
            resetAllMockStorage();
            clearAdminOverrides();
            bumpApiVersion();
            toast.success("Factory reset complete.");
          }
        }}
        title={confirmAction === "reset-mock" ? "Reset mock data?" : "Factory reset?"}
        message={
          confirmAction === "reset-mock"
            ? "All entities regenerate from seeds. Your manual edits (new pairs, banned users, etc.) are lost."
            : "Mock data AND every admin override (theme colors, logo, config edits) will be wiped."
        }
        confirmLabel={confirmAction === "reset-mock" ? "Reset data" : "Factory reset"}
        danger
      />

      <p className="flex items-center gap-1.5 text-[11px] text-white/30">
        <Languages size={11} /> {settings.languages.split(",").length} languages enabled · currency {settings.defaultCurrency} · timezone {settings.timezone}
      </p>
    </div>
  );
}
