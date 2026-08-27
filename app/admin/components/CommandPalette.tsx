/** ⌘K navigation and live-market search for the admin console. */

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Coins,
  Search,
  Settings,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useFrontendMarketSnapshot } from "@/admin/api/orderly";
import { ALL_NAV_ITEMS } from "@/admin/nav";
import { CONFIG_FIELDS } from "@/admin/fields";

interface Result {
  id: string;
  group: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  to: string;
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
  const marketQuery = useFrontendMarketSnapshot({ enabled: open });

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = useMemo((): Result[] => {
    const query = q.trim().toLowerCase();
    const out: Result[] = [];
    const push = (result: Result) => {
      if (out.length < 40) out.push(result);
    };

    // Navigation remains useful before the live market request completes.
    for (const item of ALL_NAV_ITEMS) {
      const haystack = `${item.label} ${item.keywords}`.toLowerCase();
      if (!query || haystack.includes(query)) {
        push({
          id: `page-${item.to}`,
          group: "Pages",
          icon: item.icon,
          title: item.label,
          subtitle: "Open page",
          to: item.to,
        });
      }
    }

    if (!query) return out.slice(0, 10);

    for (const market of marketQuery.data?.markets ?? []) {
      const haystack = `${market.symbol} ${market.displayName} ${market.base} ${market.quote}`.toLowerCase();
      if (haystack.includes(query)) {
        push({
          id: `market-${market.symbol}`,
          group: "Live markets",
          icon: Coins,
          title: `${market.displayName}/${market.quote}`,
          subtitle: market.symbol,
          to: `/admin/pairs?q=${encodeURIComponent(market.symbol)}`,
        });
      }
    }

    for (const field of CONFIG_FIELDS) {
      const haystack = `${field.key} ${field.label} ${field.description || ""}`.toLowerCase();
      if (haystack.includes(query)) {
        push({
          id: `setting-${field.key}`,
          group: "Settings",
          icon: Settings,
          title: field.label,
          subtitle: field.key,
          to: "/admin/settings",
        });
      }
    }
    return out;
  }, [marketQuery.data?.markets, q]);

  useEffect(() => setActive(0), [results.length, q]);

  const go = (result: Result) => {
    onClose();
    navigate(result.to);
  };

  if (!open || typeof document === "undefined") return null;

  const groups = results.reduce<Record<string, Result[]>>((accumulator, result) => {
    (accumulator[result.group] = accumulator[result.group] || []).push(result);
    return accumulator;
  }, {});

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
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && results.length > 0) {
                event.preventDefault();
                setActive((current) => Math.min(results.length - 1, current + 1));
              } else if (event.key === "ArrowUp" && results.length > 0) {
                event.preventDefault();
                setActive((current) => Math.max(0, current - 1));
              } else if (event.key === "Enter" && results[active]) {
                go(results[active]);
              } else if (event.key === "Escape") {
                onClose();
              }
            }}
            placeholder="Search pages, live markets, settings…"
            className="w-full bg-transparent py-3.5 text-sm text-white placeholder-white/30 outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">ESC</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {marketQuery.error && q && (
            <div className="mx-2 mb-2 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-[11px] text-white/40">
              <WifiOff size={12} /> Live market matches are unavailable right now.
            </div>
          )}
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/35">No results for “{q}”</p>
          ) : (
            Object.entries(groups).map(([group, groupResults]) => (
              <div key={group} className="mb-1">
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">{group}</div>
                {groupResults.map((result) => {
                  const index = results.indexOf(result);
                  const Icon = result.icon;
                  return (
                    <button
                      key={result.id}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(result)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${index === active ? "bg-[rgba(var(--oui-color-primary),0.16)]" : ""}`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/50"><Icon size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white/85">{result.title}</span>
                        {result.subtitle && <span className="block truncate text-[11px] text-white/35">{result.subtitle}</span>}
                      </span>
                      {index === active && <ArrowRight size={13} className="shrink-0 text-white/40" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-white/5 px-4 py-2 text-[10px] text-white/30">
          <span>↑↓ navigate</span><span>↵ open</span><span>esc close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
