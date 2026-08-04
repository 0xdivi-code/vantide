/**
 * Working theme customization. Selected colors are stored as admin config
 * overrides (THEME_COLOR_* keys). <ThemeInjector/> (mounted in App.tsx)
 * converts them to the "R G B" triplet format the Orderly UI CSS variables
 * expect and injects a :root override, so the whole dapp — buttons, links,
 * badges, charts — re-themes live, no reload. Exported config.js carries
 * the same keys for production.
 */

import { getRuntimeConfig } from "@/utils/runtime-config";

export interface ThemeColorDef {
  key: string;
  label: string;
  cssVar: string;
  defaultHex: string;
  description: string;
}

export const THEME_COLORS: ThemeColorDef[] = [
  {
    key: "THEME_COLOR_PRIMARY",
    label: "Primary (buttons)",
    cssVar: "--oui-color-primary",
    defaultHex: "#B084E9",
    description: "Main buttons, active states, highlights.",
  },
  {
    key: "THEME_COLOR_PRIMARY_DARKEN",
    label: "Primary hover",
    cssVar: "--oui-color-primary-darken",
    defaultHex: "#894CD1",
    description: "Button hover/pressed state.",
  },
  {
    key: "THEME_COLOR_LINK",
    label: "Links",
    cssVar: "--oui-color-link",
    defaultHex: "#BD6BED",
    description: "Hyperlinks and accent text.",
  },
  {
    key: "THEME_COLOR_SUCCESS",
    label: "Success / Buy",
    cssVar: "--oui-color-success",
    defaultHex: "#29E9A9",
    description: "Success states, buy side.",
  },
  {
    key: "THEME_COLOR_DANGER",
    label: "Danger / Sell",
    cssVar: "--oui-color-danger",
    defaultHex: "#F5618B",
    description: "Destructive actions, sell side.",
  },
  {
    key: "THEME_COLOR_WARNING",
    label: "Warning",
    cssVar: "--oui-color-warning",
    defaultHex: "#FFD146",
    description: "Warnings and cautions.",
  },
  {
    key: "THEME_COLOR_TRADING_PROFIT",
    label: "PnL profit",
    cssVar: "--oui-color-trading-profit",
    defaultHex: "#29E9A9",
    description: "Profit numbers in the trading UI.",
  },
  {
    key: "THEME_COLOR_TRADING_LOSS",
    label: "PnL loss",
    cssVar: "--oui-color-trading-loss",
    defaultHex: "#F5618B",
    description: "Loss numbers in the trading UI.",
  },
];

export interface ThemePreset {
  name: string;
  swatch: string;
  colors: Partial<Record<string, string>>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: "Vantide Purple",
    swatch: "#B084E9",
    colors: {
      THEME_COLOR_PRIMARY: "#B084E9",
      THEME_COLOR_PRIMARY_DARKEN: "#894CD1",
      THEME_COLOR_LINK: "#BD6BED",
      THEME_COLOR_SUCCESS: "#29E9A9",
      THEME_COLOR_DANGER: "#F5618B",
      THEME_COLOR_WARNING: "#FFD146",
      THEME_COLOR_TRADING_PROFIT: "#29E9A9",
      THEME_COLOR_TRADING_LOSS: "#F5618B",
    },
  },
  {
    name: "Ocean Blue",
    swatch: "#3B82F6",
    colors: {
      THEME_COLOR_PRIMARY: "#3B82F6",
      THEME_COLOR_PRIMARY_DARKEN: "#1D4ED8",
      THEME_COLOR_LINK: "#60A5FA",
      THEME_COLOR_SUCCESS: "#34D399",
      THEME_COLOR_DANGER: "#FB7185",
      THEME_COLOR_WARNING: "#FBBF24",
      THEME_COLOR_TRADING_PROFIT: "#34D399",
      THEME_COLOR_TRADING_LOSS: "#FB7185",
    },
  },
  {
    name: "Emerald",
    swatch: "#10B981",
    colors: {
      THEME_COLOR_PRIMARY: "#10B981",
      THEME_COLOR_PRIMARY_DARKEN: "#047857",
      THEME_COLOR_LINK: "#34D399",
      THEME_COLOR_SUCCESS: "#4ADE80",
      THEME_COLOR_DANGER: "#F87171",
      THEME_COLOR_WARNING: "#FACC15",
      THEME_COLOR_TRADING_PROFIT: "#4ADE80",
      THEME_COLOR_TRADING_LOSS: "#F87171",
    },
  },
  {
    name: "Sunset",
    swatch: "#F97316",
    colors: {
      THEME_COLOR_PRIMARY: "#F97316",
      THEME_COLOR_PRIMARY_DARKEN: "#C2410C",
      THEME_COLOR_LINK: "#FB923C",
      THEME_COLOR_SUCCESS: "#22C55E",
      THEME_COLOR_DANGER: "#EF4444",
      THEME_COLOR_WARNING: "#FDE047",
      THEME_COLOR_TRADING_PROFIT: "#22C55E",
      THEME_COLOR_TRADING_LOSS: "#EF4444",
    },
  },
  {
    name: "Crimson",
    swatch: "#E11D48",
    colors: {
      THEME_COLOR_PRIMARY: "#E11D48",
      THEME_COLOR_PRIMARY_DARKEN: "#9F1239",
      THEME_COLOR_LINK: "#FB7185",
      THEME_COLOR_SUCCESS: "#34D399",
      THEME_COLOR_DANGER: "#F43F5E",
      THEME_COLOR_WARNING: "#FBBF24",
      THEME_COLOR_TRADING_PROFIT: "#34D399",
      THEME_COLOR_TRADING_LOSS: "#F43F5E",
    },
  },
  {
    name: "Gold",
    swatch: "#EAB308",
    colors: {
      THEME_COLOR_PRIMARY: "#EAB308",
      THEME_COLOR_PRIMARY_DARKEN: "#A16207",
      THEME_COLOR_LINK: "#FACC15",
      THEME_COLOR_SUCCESS: "#4ADE80",
      THEME_COLOR_DANGER: "#F87171",
      THEME_COLOR_WARNING: "#FDE047",
      THEME_COLOR_TRADING_PROFIT: "#4ADE80",
      THEME_COLOR_TRADING_LOSS: "#F87171",
    },
  },
];

/* ------------------------------------------------------------------ */
/* Color math                                                         */
/* ------------------------------------------------------------------ */

export function hexToTriplet(hex: string): string | null {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function tripletToHex(triplet: string): string | null {
  const parts = triplet.trim().split(/\s+/).map(Number);
  if (parts.length !== 3 || parts.some((x) => isNaN(x))) return null;
  return (
    "#" +
    parts.map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("")
  ).toUpperCase();
}

function shiftLightness(hex: string, delta: number): string {
  const t = hexToTriplet(hex);
  if (!t) return hex;
  const [r, g, b] = t.split(" ").map(Number);
  const adj = (c: number) =>
    Math.max(0, Math.min(255, Math.round(delta > 0 ? c + (255 - c) * delta : c * (1 + delta))));
  return tripletToHex(`${adj(r)} ${adj(g)} ${adj(b)}`) || hex;
}

export const lighten = (hex: string, amt = 0.16): string => shiftLightness(hex, amt);
export const darken = (hex: string, amt = -0.16): string => shiftLightness(hex, amt);

/* ------------------------------------------------------------------ */
/* CSS building                                                       */
/* ------------------------------------------------------------------ */

/**
 * Builds the :root override stylesheet from the current effective config
 * (admin overrides OR exported config.js). Returns "" when untouched.
 */
export function buildThemeCss(): string {
  const rules: string[] = [];

  for (const def of THEME_COLORS) {
    const value = getRuntimeConfig(def.key);
    if (!value) continue;
    const triplet = hexToTriplet(value);
    if (!triplet) continue;
    rules.push(`${def.cssVar}: ${triplet};`);

    // Derive companion variables so hover/light states stay coherent.
    if (def.key === "THEME_COLOR_PRIMARY") {
      rules.push(`--oui-color-primary-light: ${hexToTriplet(lighten(value))};`);
      rules.push(`--oui-gradient-primary-end: ${triplet};`);
      rules.push(
        `--oui-gradient-primary-start: ${hexToTriplet(darken(value, -0.55))};`
      );
      rules.push(`--oui-gradient-secondary-start: ${hexToTriplet(darken(value, -0.35))};`);
      rules.push(`--oui-gradient-secondary-end: ${triplet};`);
    }
    if (def.key === "THEME_COLOR_PRIMARY_DARKEN") {
      // Only inject the derived value if admin didn't set it explicitly.
      if (!getRuntimeConfig("THEME_COLOR_PRIMARY_DARKEN")) continue;
    }
    if (def.key === "THEME_COLOR_LINK") {
      rules.push(`--oui-color-link-light: ${hexToTriplet(lighten(value))};`);
    }
    if (def.key === "THEME_COLOR_SUCCESS") {
      rules.push(`--oui-color-success-light: ${hexToTriplet(lighten(value))};`);
      rules.push(`--oui-color-success-darken: ${hexToTriplet(darken(value, -0.2))};`);
      rules.push(`--oui-gradient-success-end: ${triplet};`);
      rules.push(`--oui-gradient-success-start: ${hexToTriplet(darken(value, -0.55))};`);
    }
    if (def.key === "THEME_COLOR_DANGER") {
      rules.push(`--oui-color-danger-light: ${hexToTriplet(lighten(value))};`);
      rules.push(`--oui-color-danger-darken: ${hexToTriplet(darken(value, -0.15))};`);
      rules.push(`--oui-gradient-danger-end: ${triplet};`);
      rules.push(`--oui-gradient-danger-start: ${hexToTriplet(darken(value, -0.55))};`);
    }
    if (def.key === "THEME_COLOR_WARNING") {
      rules.push(`--oui-color-warning-light: ${hexToTriplet(lighten(value))};`);
      rules.push(`--oui-color-warning-darken: ${hexToTriplet(darken(value, -0.2))};`);
    }
    if (def.key === "THEME_COLOR_TRADING_PROFIT") {
      rules.push(`--oui-color-trading-profit-contrast: 255 255 255;`);
    }
    if (def.key === "THEME_COLOR_TRADING_LOSS") {
      rules.push(`--oui-color-trading-loss-contrast: 255 255 255;`);
    }
  }

  if (rules.length === 0) return "";
  return `:root {\n  ${rules.join("\n  ")}\n}`;
}

/** True when any theme color override is active. */
export function hasThemeOverrides(): boolean {
  return THEME_COLORS.some((d) => Boolean(getRuntimeConfig(d.key)));
}

/** The effective hex for a color (override or default). */
export function effectiveColor(def: ThemeColorDef): string {
  const v = getRuntimeConfig(def.key);
  return v && hexToTriplet(v) ? v.toUpperCase() : def.defaultHex;
}
