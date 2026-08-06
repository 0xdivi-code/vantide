import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Lock,
  ExternalLink,
  ShieldAlert,
  Bell,
  Search,
  Menu,
  ChevronRight,
  LogOut,
  X,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { getRuntimeConfig } from "@/utils/runtime-config";
import { useConfigVersion } from "@/admin/useConfigVersion";
import { AdminButton, TextInput } from "@/admin/components/ui";
import { ToastProvider, ToastViewport, useToast } from "@/admin/components/feedback";
import { CommandPalette } from "@/admin/components/CommandPalette";
import { NAV_GROUPS, ALL_NAV_ITEMS } from "@/admin/nav";
import { db } from "@/admin/mock/db";
import { timeAgo } from "@/admin/mock/rng";

const AUTH_KEY = "vantide-admin-unlocked";

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
          Control Panel
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Sidebar ---------------- */

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="mt-4 first:mt-0">
          <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
            {group.label}
          </div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end ?? false}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-[rgba(var(--oui-color-primary),0.18)] text-[rgb(var(--oui-color-primary-light))]"
                    : "text-white/50 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <item.icon size={16} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

/* ---------------- Breadcrumbs ---------------- */

const SEGMENT_LABELS: Record<string, string> = Object.fromEntries(
  ALL_NAV_ITEMS.map((i) => [i.to.replace("/admin", "").replace(/^\//, "") || "dashboard", i.label])
);

function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split("/").filter(Boolean); // ["admin", "users", ...]
  if (parts.length <= 1) {
    return <span className="text-sm font-semibold text-white">Dashboard</span>;
  }
  const crumbs = parts.slice(1).map((seg, i) => {
    const isLast = i === parts.length - 2;
    const label = SEGMENT_LABELS[seg] || (seg.startsWith("usr_") ? "User detail" : seg);
    const to = "/" + parts.slice(0, i + 2).join("/");
    return { label, to, isLast };
  });
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Link to="/admin" className="text-white/40 hover:text-white/75">
        Admin
      </Link>
      {crumbs.map((c) => (
        <span key={c.to} className="flex items-center gap-1.5">
          <ChevronRight size={13} className="text-white/20" />
          {c.isLast ? (
            <span className="font-semibold text-white">{c.label}</span>
          ) : (
            <Link to={c.to} className="text-white/40 hover:text-white/75">
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Notifications bell ---------------- */

function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("vantide-admin-read-notifs") || "[]"));
    } catch {
      return new Set();
    }
  });

  const items = useMemo(() => {
    const alerts = db.securityAlerts.all().filter((a) => !a.resolved).slice(0, 4);
    const tickets = db.tickets.all().filter((t) => t.status === "open").slice(0, 3);
    return [
      ...alerts.map((a) => ({
        id: `n-${a.id}`,
        icon: AlertTriangle,
        tone: a.severity === "critical" || a.severity === "high" ? "danger" : "warning",
        text: a.title,
        sub: timeAgo(a.ts),
        to: "/admin/security",
      })),
      ...tickets.map((t) => ({
        id: `n-${t.id}`,
        icon: Info,
        tone: "info",
        text: `Open ticket: ${t.subject}`,
        sub: timeAgo(t.updatedAt),
        to: "/admin/support",
      })),
    ];
  }, []);

  const unread = items.filter((i) => !readIds.has(i.id)).length;

  const markAllRead = () => {
    const next = new Set(items.map((i) => i.id));
    setReadIds(next);
    try {
      localStorage.setItem("vantide-admin-read-notifs", JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-white/55 hover:bg-white/5 hover:text-white"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--oui-color-danger))] text-[9px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="admin-pop absolute right-0 top-11 z-40 w-[min(92vw,340px)] rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-6))] p-2 shadow-2xl">
            <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
              <span className="text-xs font-semibold text-white/70">Notifications</span>
              <button onClick={markAllRead} className="text-[11px] text-[rgb(var(--oui-color-link))] hover:underline">
                Mark all read
              </button>
            </div>
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-white/35">
                <CheckCircle2 size={20} />
                <span className="text-xs">All clear — nothing needs attention</span>
              </div>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-white/5 ${
                    readIds.has(n.id) ? "opacity-45" : ""
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                      n.tone === "danger"
                        ? "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger-light))]"
                        : n.tone === "warning"
                          ? "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]"
                          : "bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]"
                    }`}
                  >
                    <n.icon size={12} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs text-white/85">{n.text}</span>
                    <span className="text-[10px] text-white/35">{n.sub}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Lock screen / disabled ---------------- */

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
        <h1 className="text-center text-lg font-bold text-white">Admin access required</h1>
        <p className="mt-1 text-center text-xs text-white/45">Enter the admin passcode to continue.</p>
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
          <Link to="/" className="block text-center text-xs text-white/40 hover:text-white/70">
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
          <code className="rounded bg-white/10 px-1 py-0.5 text-[10px]">VITE_ADMIN_ENABLED=false</code>.
        </p>
        <Link to="/" className="mt-5 inline-block text-xs text-white/40 hover:text-white/70">
          Back to site
        </Link>
      </div>
    </div>
  );
}

/* ---------------- Shell ---------------- */

function AdminShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const toast = useToast();

  // ⌘K / Ctrl+K opens global search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileNav(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[rgb(var(--oui-color-base-10))] text-white">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-[rgb(var(--oui-color-base-9))] px-3 py-4 md:flex">
        <AdminBrand />
        <div className="mt-5 flex-1 overflow-y-auto pb-2 [scrollbar-width:thin]">
          <SidebarNav />
        </div>
        <div className="space-y-1 border-t border-white/10 pt-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ExternalLink size={16} />
            Back to site
          </Link>
          <p className="px-3 pt-1 text-[10px] leading-relaxed text-white/25">
            Vantide Admin console · v{getRuntimeConfig("VITE_APP_VERSION") || "0.1.0"}
          </p>
        </div>
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            tabIndex={-1}
            className="admin-fade absolute inset-0 cursor-default bg-black/60"
            onClick={() => setMobileNav(false)}
          />
          <aside className="admin-drawer absolute left-0 top-0 h-full w-64 border-r border-white/10 bg-[rgb(var(--oui-color-base-9))] px-3 py-4">
            <div className="flex items-center justify-between">
              <AdminBrand />
              <button onClick={() => setMobileNav(false)} className="text-white/40" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 h-[calc(100%-80px)] overflow-y-auto">
              <SidebarNav onNavigate={() => setMobileNav(false)} />
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top navigation */}
        <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-white/10 bg-[rgba(var(--oui-color-base-10),0.92)] px-4 py-2.5 backdrop-blur md:px-6">
          <button
            onClick={() => setMobileNav(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 hover:bg-white/5 md:hidden"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>

          {/* Quick actions */}
          <Link to="/admin/pairs?new=1" className="hidden sm:block">
            <AdminButton variant="primary" className="!px-3 !py-1.5 text-xs">
              + New pair
            </AdminButton>
          </Link>
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-white/40 hover:border-white/20 hover:text-white/70"
          >
            <Search size={14} />
            <span className="hidden lg:inline">Search anything…</span>
            <kbd className="hidden rounded border border-white/10 bg-white/5 px-1 text-[10px] lg:inline">
              ⌘K
            </kbd>
          </button>
          <NotificationsBell />
          <div className="relative">
            <button
              onClick={() => {
                toast.info("Signed out of the admin session.");
                try {
                  sessionStorage.removeItem(AUTH_KEY);
                } catch {
                  /* ignore */
                }
                navigate("/");
              }}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
              title="Sign out"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgb(var(--oui-color-primary))] text-xs font-bold text-white">
                A
              </span>
              <LogOut size={14} className="text-white/40" />
            </button>
          </div>
        </header>

        {/* Page body */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
          <div key={location.pathname} className="admin-page">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <ToastViewport />
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

  useConfigVersion();

  const enabled = getRuntimeConfig("VITE_ADMIN_ENABLED") !== "false";
  const passcode = getRuntimeConfig("VITE_ADMIN_PASSCODE");

  useEffect(() => {
    document.title = "Control Panel";
  }, []);

  if (!enabled) return <DisabledScreen />;
  if (passcode && !unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <ToastProvider>
      <AdminShell />
    </ToastProvider>
  );
}
