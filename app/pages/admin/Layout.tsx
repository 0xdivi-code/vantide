import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  BarChart3,
  Palette,
  Settings,
  Lock,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { getRuntimeConfig } from "@/utils/runtime-config";
import { useConfigVersion } from "@/admin/useConfigVersion";
import { AdminButton, TextInput } from "@/admin/components/ui";

const AUTH_KEY = "vantide-admin-unlocked";

const NAV_ITEMS = [
  { to: "/admin", end: true, label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/analytics", end: false, label: "Analytics", icon: BarChart3 },
  { to: "/admin/appearance", end: false, label: "Appearance", icon: Palette },
  { to: "/admin/settings", end: false, label: "Settings", icon: Settings },
];

function AdminBrand() {
  useConfigVersion();
  const logo = getRuntimeConfig("VITE_CUSTOM_LOGO_URL");
  const appName = getRuntimeConfig("VITE_APP_NAME") || "Vantide";
  return (
    <Link to="/admin" className="flex items-center gap-2.5 px-2">
      {logo ? (
        <img src={logo} alt="logo" className="h-8 max-w-[120px] object-contain" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgb(var(--oui-color-primary))] text-sm font-bold text-white">
          {appName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="leading-tight">
        <div className="text-sm font-bold text-white">{appName}</div>
        <div className="text-[10px] font-medium uppercase tracking-wider text-[rgb(var(--oui-color-primary-light))]">
          Admin Panel
        </div>
      </div>
    </Link>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const passcode = getRuntimeConfig("VITE_ADMIN_PASSCODE") || "";

  const submit = () => {
    if (value === passcode) {
      try {
        sessionStorage.setItem(AUTH_KEY, "1");
      } catch {
        /* ignore */
      }
      onUnlock();
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--oui-color-base-10))] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]">
          <Lock size={22} />
        </div>
        <h1 className="text-center text-lg font-bold text-white">
          Admin access required
        </h1>
        <p className="mt-1 text-center text-xs text-white/45">
          Enter the admin passcode to continue.
        </p>
        <form
          className="mt-6 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <TextInput
            type="password"
            value={value}
            placeholder="Passcode"
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
          />
          {error && (
            <p className="text-xs text-[rgb(var(--oui-color-danger-light))]">
              Incorrect passcode. Try again.
            </p>
          )}
          <AdminButton variant="primary" className="w-full" type="submit">
            Unlock admin panel
          </AdminButton>
          <Link
            to="/"
            className="block text-center text-xs text-white/40 hover:text-white/70"
          >
            Back to site
          </Link>
        </form>
      </div>
    </div>
  );
}

function DisabledScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--oui-color-base-10))] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]">
          <ShieldAlert size={22} />
        </div>
        <h1 className="text-lg font-bold text-white">Admin panel disabled</h1>
        <p className="mt-2 text-xs leading-relaxed text-white/45">
          The admin panel has been disabled via{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-[10px]">
            VITE_ADMIN_ENABLED=false
          </code>
          . Remove that override or update config.js to re-enable it.
        </p>
        <Link
          to="/"
          className="mt-5 inline-block text-xs text-white/40 hover:text-white/70"
        >
          Back to site
        </Link>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(AUTH_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Re-render when overrides change so lock state reacts to config edits.
  useConfigVersion();

  const enabled = getRuntimeConfig("VITE_ADMIN_ENABLED") !== "false";
  const passcode = getRuntimeConfig("VITE_ADMIN_PASSCODE");

  useEffect(() => {
    document.title = "Admin Panel";
  }, []);

  if (!enabled) return <DisabledScreen />;
  if (passcode && !unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="flex min-h-screen bg-[rgb(var(--oui-color-base-10))] text-white">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-[rgb(var(--oui-color-base-9))] px-4 py-5 md:flex">
        <AdminBrand />
        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[rgba(var(--oui-color-primary),0.18)] text-[rgb(var(--oui-color-primary-light))]"
                    : "text-white/55 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <item.icon size={17} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/55 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink size={17} />
            Back to site
          </Link>
          <p className="px-3 pt-2 text-[10px] leading-relaxed text-white/25">
            Changes are stored in this browser and can be exported for
            deployment via Settings → Export.
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-white/10 bg-[rgba(var(--oui-color-base-10),0.9)] backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="md:hidden">
              <AdminBrand />
            </div>
            <div className="hidden text-sm text-white/40 md:block">
              Manage branding, configuration and view site analytics.
            </div>
            <Link to="/" className="shrink-0">
              <AdminButton variant="secondary" className="!px-3 !py-1.5 text-xs">
                <ExternalLink size={14} />
                View site
              </AdminButton>
            </Link>
          </div>
          {/* Mobile nav */}
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2 md:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    isActive
                      ? "bg-[rgba(var(--oui-color-primary),0.18)] text-[rgb(var(--oui-color-primary-light))]"
                      : "text-white/55"
                  }`
                }
              >
                <item.icon size={14} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
