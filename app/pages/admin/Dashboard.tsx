import { Link } from "react-router-dom";
import {
  Activity,
  Eye,
  SlidersHorizontal,
  Database,
  Palette,
  Settings as SettingsIcon,
  Download,
  Image as ImageIcon,
  History,
  BarChart3,
  Check,
  X,
} from "lucide-react";
import { getRuntimeConfig } from "@/utils/runtime-config";
import { withBasePath } from "@/utils/base-path";
import {
  getAdminHistory,
  getAdminOverrides,
  getAdminStorageUsage,
  generateConfigJs,
} from "@/admin/adminStore";
import { getAnalyticsSummary } from "@/admin/analytics";
import { useConfigVersion } from "@/admin/useConfigVersion";
import {
  Card,
  StatCard,
  Badge,
  AdminButton,
  PageHeader,
  EmptyState,
} from "@/admin/components/ui";

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusRow({
  label,
  ok,
  okText,
  badText,
}: {
  label: string;
  ok: boolean;
  okText: string;
  badText: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-white/60">{label}</span>
      <Badge tone={ok ? "success" : "neutral"}>
        {ok ? <Check size={11} /> : <X size={11} />}
        {ok ? okText : badText}
      </Badge>
    </div>
  );
}

export default function AdminDashboard() {
  // Subscribe so stats/cards refresh after changes made in other tabs.
  useConfigVersion();

  const analytics = getAnalyticsSummary();
  const overrides = getAdminOverrides();
  const history = getAdminHistory();
  const overrideCount = Object.keys(overrides).length;

  const appName = getRuntimeConfig("VITE_APP_NAME") || "Vantide";
  const brokerId = getRuntimeConfig("VITE_ORDERLY_BROKER_ID") || "demo";
  const customLogo = getRuntimeConfig("VITE_CUSTOM_LOGO_URL");
  const customSecondaryLogo = getRuntimeConfig("VITE_CUSTOM_SECONDARY_LOGO_URL");
  const primaryLogo =
    customLogo ||
    (getRuntimeConfig("VITE_HAS_PRIMARY_LOGO") === "true"
      ? withBasePath("/logo.webp")
      : null);
  const secondaryLogo =
    customSecondaryLogo ||
    (getRuntimeConfig("VITE_HAS_SECONDARY_LOGO") === "true"
      ? withBasePath("/logo-secondary.webp")
      : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${appName}`}
        description={`Manage your dapp from one place. Broker ID: ${brokerId}.`}
        actions={
          <>
            <Link to="/admin/appearance">
              <AdminButton variant="primary">
                <Palette size={15} />
                Change logo
              </AdminButton>
            </Link>
            <AdminButton onClick={() => downloadFile("config.js", generateConfigJs())}>
              <Download size={15} />
              Export config.js
            </AdminButton>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Eye} label="Page views today" value={analytics.todayViews} />
        <StatCard
          icon={Activity}
          label="Total page views"
          value={analytics.totalViews}
          hint={
            analytics.firstTrackedAt
              ? `since ${formatTime(analytics.firstTrackedAt)}`
              : undefined
          }
        />
        <StatCard
          icon={SlidersHorizontal}
          label="Active admin overrides"
          value={overrideCount}
          hint={overrideCount > 0 ? "Applied live on this browser" : "No local changes"}
          accent={overrideCount > 0 ? "warning" : "primary"}
        />
        <StatCard
          icon={Database}
          label="Admin storage used"
          value={formatBytes(getAdminStorageUsage())}
          hint="localStorage on this device"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Branding */}
        <Card
          title="Branding"
          subtitle="Current logos — manage in Appearance"
          className="lg:col-span-1"
        >
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-white/60">
                  Primary logo
                </span>
                <Badge tone={customLogo ? "primary" : primaryLogo ? "success" : "neutral"}>
                  {customLogo ? "Custom (admin)" : primaryLogo ? "Static file" : "Default"}
                </Badge>
              </div>
              <div className="flex h-16 items-center justify-center rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] px-3">
                {primaryLogo ? (
                  <img src={primaryLogo} alt="Primary logo" className="max-h-10 object-contain" />
                ) : (
                  <img
                    src={withBasePath("/orderly-logo.svg")}
                    alt="Default logo"
                    className="max-h-10 object-contain"
                  />
                )}
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-medium text-white/60">
                  Secondary logo (mobile / wallet)
                </span>
                <Badge
                  tone={
                    customSecondaryLogo ? "primary" : secondaryLogo ? "success" : "neutral"
                  }
                >
                  {customSecondaryLogo ? "Custom (admin)" : secondaryLogo ? "Static file" : "Default"}
                </Badge>
              </div>
              <div className="flex h-16 items-center justify-center rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] px-3">
                {secondaryLogo ? (
                  <img
                    src={secondaryLogo}
                    alt="Secondary logo"
                    className="max-h-8 object-contain"
                  />
                ) : (
                  <span className="text-xs text-white/30">Orderly default</span>
                )}
              </div>
            </div>
            <Link to="/admin/appearance" className="block">
              <AdminButton variant="primary" className="w-full">
                <ImageIcon size={15} />
                Change logo
              </AdminButton>
            </Link>
          </div>
        </Card>

        {/* Configuration status */}
        <Card
          title="Configuration status"
          subtitle="Key settings at a glance"
          className="lg:col-span-1"
        >
          <div className="divide-y divide-white/5">
            <StatusRow
              label="Custom primary logo"
              ok={Boolean(customLogo)}
              okText="Set"
              badText="Not set"
            />
            <StatusRow
              label="External analytics script"
              ok={analytics.externalScriptConfigured}
              okText="Configured"
              badText="Not configured"
            />
            <StatusRow
              label="Built-in tracking"
              ok={analytics.enabled}
              okText="On"
              badText="Off"
            />
            <StatusRow
              label="Admin passcode protection"
              ok={Boolean(getRuntimeConfig("VITE_ADMIN_PASSCODE"))}
              okText="Protected"
              badText="Open"
            />
            <StatusRow
              label="Campaigns menu"
              ok={getRuntimeConfig("VITE_ENABLE_CAMPAIGNS") === "true"}
              okText="Enabled"
              badText="Disabled"
            />
            <StatusRow
              label="Service disclaimer"
              ok={
                getRuntimeConfig("VITE_ENABLE_SERVICE_DISCLAIMER_DIALOG") === "true"
              }
              okText="Enabled"
              badText="Disabled"
            />
          </div>
          <Link to="/admin/settings" className="mt-3 block">
            <AdminButton className="w-full">
              <SettingsIcon size={15} />
              Edit settings
            </AdminButton>
          </Link>
        </Card>

        {/* Quick actions */}
        <Card title="Quick actions" subtitle="Common tasks" className="lg:col-span-1">
          <div className="flex flex-col gap-2.5">
            <Link to="/admin/appearance">
              <AdminButton variant="secondary" className="w-full justify-start">
                <Palette size={15} className="text-[rgb(var(--oui-color-primary-light))]" />
                Change logo & branding
              </AdminButton>
            </Link>
            <Link to="/admin/analytics">
              <AdminButton variant="secondary" className="w-full justify-start">
                <BarChart3 size={15} className="text-[rgb(var(--oui-color-primary-light))]" />
                View analytics
              </AdminButton>
            </Link>
            <Link to="/admin/settings">
              <AdminButton variant="secondary" className="w-full justify-start">
                <SettingsIcon size={15} className="text-[rgb(var(--oui-color-primary-light))]" />
                Edit configuration
              </AdminButton>
            </Link>
            <AdminButton
              variant="secondary"
              className="w-full justify-start"
              onClick={() => downloadFile("config.js", generateConfigJs())}
            >
              <Download size={15} className="text-[rgb(var(--oui-color-primary-light))]" />
              Export config.js for deployment
            </AdminButton>
            <p className="mt-1 rounded-lg bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-white/40">
              Tip: changes made here are saved in this browser and applied
              instantly. To roll them out to every visitor, export config.js
              and replace public/config.js on your deployment.
            </p>
          </div>
        </Card>
      </div>

      {/* Recent changes */}
      <Card
        title="Recent changes"
        subtitle="Latest admin actions on this browser"
      >
        {history.length === 0 ? (
          <EmptyState
            icon={History}
            title="No changes yet"
            description="Changes you make in Appearance or Settings will show up here."
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {history.slice(0, 8).map((entry, i) => (
              <li key={`${entry.ts}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <span className="text-sm text-white/80">
                    {entry.action === "set" && (
                      <>
                        Updated{" "}
                        <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-[rgb(var(--oui-color-primary-light))]">
                          {entry.key}
                        </code>
                      </>
                    )}
                    {entry.action === "remove" && (
                      <>
                        Reset{" "}
                        <code className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] text-[rgb(var(--oui-color-primary-light))]">
                          {entry.key}
                        </code>{" "}
                        to default
                      </>
                    )}
                    {entry.action === "clear" && "Cleared all overrides"}
                    {entry.action === "import" && `Imported config (${entry.value})`}
                  </span>
                </div>
                <span className="shrink-0 text-[11px] text-white/30">
                  {formatTime(entry.ts)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
