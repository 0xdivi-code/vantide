/**
 * Working theme editor: pick a preset or fine-tune every token.
 * Selections are saved as admin overrides; <ThemeInjector/> in App.tsx
 * applies them to the whole dapp INSTANTLY (no reload) — buttons, links,
 * profit/loss colors and all CSS-var-driven UI included.
 */

import { useState } from "react";
import { Paintbrush, RotateCcw, Check, Download } from "lucide-react";
import {
  THEME_COLORS,
  THEME_PRESETS,
  effectiveColor,
  hasThemeOverrides,
  hexToTriplet,
} from "@/admin/theme";
import { setAdminOverride, removeAdminOverride, generateConfigJs } from "@/admin/adminStore";
import { useConfigVersion } from "@/admin/useConfigVersion";
import { Card, Badge, AdminButton } from "@/admin/components/ui";
import { useToast } from "./feedback";

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ThemeEditor() {
  useConfigVersion();
  const toast = useToast();
  const [, force] = useState(0);

  const applyPreset = (presetName: string) => {
    const preset = THEME_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    Object.entries(preset.colors).forEach(([key, value]) => {
      setAdminOverride(key, value as string);
    });
    toast.success(`Theme "${preset.name}" applied — live across the dapp.`);
  };

  const setColor = (key: string, hex: string) => {
    if (!hexToTriplet(hex)) return;
    setAdminOverride(key, hex);
  };

  const resetColor = (key: string) => {
    removeAdminOverride(key);
    force((v) => v + 1);
  };

  const resetAll = () => {
    THEME_COLORS.forEach((d) => removeAdminOverride(d.key));
    toast.success("Theme reset to the default purple.", undefined);
  };

  const custom = hasThemeOverrides();

  return (
    <Card
      title="Theme & button colors"
      subtitle="Applies LIVE to the whole dapp — not a mock. Export config.js to ship it to production."
      actions={
        custom ? (
          <Badge tone="primary">
            <Check size={11} /> Custom theme active
          </Badge>
        ) : (
          <Badge tone="neutral">Default theme</Badge>
        )
      }
    >
      <div className="space-y-6">
        {/* Presets */}
        <div>
          <div className="mb-2.5 flex items-center gap-2 text-xs font-medium text-white/60">
            <Paintbrush size={13} className="text-[rgb(var(--oui-color-primary-light))]" />
            One-click presets
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p.name)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition-all hover:border-[rgba(var(--oui-color-primary),0.6)] hover:bg-[rgba(var(--oui-color-primary),0.08)]"
              >
                <span
                  className="h-8 w-8 rounded-full border-2 border-white/20 shadow-lg transition-transform group-hover:scale-110"
                  style={{ background: p.swatch }}
                />
                <span className="text-[10px] font-medium text-white/60 group-hover:text-white/90">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Fine-tune */}
        <div>
          <div className="mb-2.5 text-xs font-medium text-white/60">Fine-tune individual colors</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {THEME_COLORS.map((def) => {
              const value = effectiveColor(def);
              const overridden = value !== def.defaultHex;
              return (
                <div
                  key={def.key}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5"
                >
                  <label className="relative h-9 w-9 shrink-0 cursor-pointer" title={def.description}>
                    <span
                      className="absolute inset-0 rounded-full border-2 border-white/15"
                      style={{ background: value }}
                    />
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setColor(def.key, e.target.value.toUpperCase())}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      aria-label={`${def.label} color`}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-medium text-white/75">{def.label}</div>
                    <div className="font-mono text-[10px] uppercase text-white/35">{value}</div>
                  </div>
                  {overridden && (
                    <button
                      onClick={() => resetColor(def.key)}
                      className="shrink-0 rounded-md p-1 text-white/30 hover:bg-white/10 hover:text-white/70"
                      title="Reset to default"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Live preview strip */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-9))] p-4">
          <span className="text-[11px] uppercase tracking-wide text-white/30">Live preview</span>
          <button className="rounded-lg bg-[rgb(var(--oui-color-primary))] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[rgb(var(--oui-color-primary-darken))]">
            Primary button
          </button>
          <button className="rounded-lg border border-[rgba(var(--oui-color-primary),0.6)] px-4 py-2 text-sm text-[rgb(var(--oui-color-primary-light))]">
            Secondary
          </button>
          <span className="cursor-pointer text-sm text-[rgb(var(--oui-color-link))] underline-offset-2 hover:underline">
            Sample link
          </span>
          <span className="rounded-full bg-[rgba(var(--oui-color-success),0.15)] px-2.5 py-1 text-xs text-[rgb(var(--oui-color-success))]">
            Success
          </span>
          <span className="rounded-full bg-[rgba(var(--oui-color-danger),0.15)] px-2.5 py-1 text-xs text-[rgb(var(--oui-color-danger-light))]">
            Danger
          </span>
          <span className="text-sm font-semibold text-[rgb(var(--oui-color-trading-profit))]">+12.4%</span>
          <span className="text-sm font-semibold text-[rgb(var(--oui-color-trading-loss))]">-3.18%</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AdminButton variant="primary" onClick={() => download("config.js", generateConfigJs())}>
            <Download size={15} /> Export config.js with theme
          </AdminButton>
          {custom && (
            <AdminButton variant="danger" onClick={resetAll}>
              <RotateCcw size={15} /> Reset theme
            </AdminButton>
          )}
          <span className="text-[11px] text-white/35">
            Changes persist in this browser instantly; the export carries them to all visitors.
          </span>
        </div>
      </div>
    </Card>
  );
}
