/** ⌘K global search across pages, users, pairs, tickets, orders, wallets, admins, settings. */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Users,
  Coins,
  Headset,
  FileText,
  Vault,
  ShieldCheck,
  Settings,
  ArrowRight,
  Clock,
} from "lucide-react";
import { db } from "@/admin/mock/db";
import { ALL_NAV_ITEMS } from "@/admin/nav";
import { CONFIG_FIELDS } from "@/admin/fields";
import { shortHash } from "@/admin/mock/rng";

interface Result {
  id: string;
  group: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  subtitle?: string;
  to: string;
}

const RECENT_KEY = "vantide-admin-recent-searches";

function loadRecent(): Result[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(results: Result[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(results.slice(0, 5)));
  } catch {
    /* ignore */
  }
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Result[]>([]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setRecent(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo((): Result[] => {
    const query = q.trim().toLowerCase();
    if (!query) return recent;

    const out: Result[] = [];
    const push = (r: Result) => {
      if (out.length < 40) out.push(r);
    };

    // pages
    for (const item of ALL_NAV_ITEMS) {
      const hay = `${item.label} ${item.keywords}`.toLowerCase();
      if (hay.includes(query)) {
        push({ id: `page-${item.to}`, group: "Pages", icon: item.icon, title: item.label, subtitle: "Go to page", to: item.to });
      }
    }
    // users
    for (const u of db.users.all()) {
      if (out.filter((x) => x.group === "Users").length >= 4) break;
      const hay = `${u.wallet} ${u.email} ${u.id} ${u.country}`.toLowerCase();
      if (hay.includes(query)) {
        push({ id: `user-${u.id}`, group: "Users", icon: Users, title: u.email, subtitle: `${shortHash(u.wallet)} · ${u.country}`, to: `/admin/users/${u.id}` });
      }
    }
    // pairs
    for (const p of db.pairs.all()) {
      if (out.filter((x) => x.group === "Trading pairs").length >= 5) break;
      if (p.symbol.toLowerCase().includes(query)) {
        push({ id: `pair-${p.id}`, group: "Trading pairs", icon: Coins, title: p.symbol, subtitle: `${p.chain} · ${p.status}`, to: `/admin/pairs?q=${encodeURIComponent(p.symbol)}` });
      }
    }
    // tickets
    for (const t of db.tickets.all()) {
      if (out.filter((x) => x.group === "Support tickets").length >= 3) break;
      const hay = `${t.id} ${t.subject} ${t.category}`.toLowerCase();
      if (hay.includes(query)) {
        push({ id: `ticket-${t.id}`, group: "Support tickets", icon: Headset, title: t.subject, subtitle: `${t.id} · ${t.status}`, to: `/admin/support` });
      }
    }
    // orders & trades
    for (const o of db.orders.all()) {
      if (out.filter((x) => x.group === "Orders").length >= 3) break;
      if (o.id.toLowerCase().includes(query)) {
        push({ id: `order-${o.id}`, group: "Orders", icon: FileText, title: o.id, subtitle: `${o.pair} ${o.side} · ${o.status}`, to: `/admin/users/${o.user}` });
      }
    }
    // treasury wallets
    for (const w of db.wallets.all()) {
      const hay = `${w.name} ${w.address}`.toLowerCase();
      if (hay.includes(query)) {
        push({ id: `wallet-${w.id}`, group: "Treasury", icon: Vault, title: w.name, subtitle: shortHash(w.address), to: "/admin/treasury" });
      }
    }
    // admins
    for (const a of db.admins.all()) {
      const hay = `${a.name} ${a.email} ${a.role}`.toLowerCase();
      if (hay.includes(query)) {
        push({ id: `admin-${a.id}`, group: "Admins", icon: ShieldCheck, title: a.name, subtitle: a.role, to: "/admin/security" });
      }
    }
    // settings keys
    for (const f of CONFIG_FIELDS) {
      if (out.filter((x) => x.group === "Settings").length >= 3) break;
      const hay = `${f.key} ${f.label}`.toLowerCase();
      if (hay.includes(query)) {
        push({ id: `setting-${f.key}`, group: "Settings", icon: Settings, title: f.label, subtitle: f.key, to: "/admin/settings" });
      }
    }
    return out;
  }, [q, recent]);

  useEffect(() => setActive(0), [results.length]);

  const go = (r: Result) => {
    const next = [r, ...recent.filter((x) => x.id !== r.id)].slice(0, 5);
    // serialize without component refs
    saveRecent(next.map((x) => ({ ...x, icon: Search })));
    onClose();
    navigate(r.to);
  };

  if (!open || typeof document === "undefined") return null;

  const groups = results.reduce<Record<string, Result[]>>((acc, r) => {
    (acc[r.group] = acc[r.group] || []).push(r);
    return acc;
  }, {});
  const flat = results;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        tabIndex={-1}
        className="admin-fade absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="admin-pop relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[rgb(var(--oui-color-base-6))] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/5 px-4">
          <Search size={16} className="shrink-0 text-white/35" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(flat.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && flat[active]) {
                go(flat[active]);
              } else if (e.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search users, pairs, orders, wallets, settings…"
            className="w-full bg-transparent py-3.5 text-sm text-white placeholder-white/30 outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
            ESC
          </kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/35">
              No results for “{q}”
            </p>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group} className="mb-1">
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {group === "Recent" && <Clock size={10} />}
                  {group}
                </div>
                {items.map((r) => {
                  const idx = flat.indexOf(r);
                  const IconCmp = r.icon;
                  return (
                    <button
                      key={r.id}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => go(r)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                        idx === active ? "bg-[rgba(var(--oui-color-primary),0.16)]" : ""
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/50">
                        <IconCmp size={14} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white/85">{r.title}</span>
                        {r.subtitle && (
                          <span className="block truncate text-[11px] text-white/35">{r.subtitle}</span>
                        )}
                      </span>
                      {idx === active && <ArrowRight size={13} className="shrink-0 text-white/40" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-white/5 px-4 py-2 text-[10px] text-white/30">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
