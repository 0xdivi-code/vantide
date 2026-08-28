/**
 * Declarative schema for the editable runtime configuration. The Settings
 * page renders forms from this, and new dapp settings become editable in the
 * admin panel by adding entries here.
 */

export interface ConfigFieldDef {
  key: string;
  label: string;
  description?: string;
  type: "text" | "url" | "textarea" | "boolean" | "select";
  placeholder?: string;
  options?: { value: string; label: string }[];
  group: string;
}

export const FIELD_GROUPS = [
  "General",
  "Branding",
  "Social & Community",
  "Navigation",
  "Feature Flags",
  "Admin Panel",
  "Advanced",
] as const;

export const CONFIG_FIELDS: ConfigFieldDef[] = [
  {
    key: "VITE_APP_NAME",
    label: "App name",
    group: "General",
    type: "text",
    placeholder: "Vantide",
    description: "Shown in the browser tab title and SEO tags.",
  },
  {
    key: "VITE_APP_DESCRIPTION",
    label: "App description",
    group: "General",
    type: "textarea",
    placeholder: "Orderly Trading Application",
    description: "Meta description used by search engines and link previews.",
  },
  {
    key: "VITE_ORDERLY_BROKER_NAME",
    label: "Broker name",
    group: "General",
    type: "text",
    placeholder: "Vantide",
    description: "Used as the referral/share-PnL slogan on the trading page.",
  },
  {
    key: "VITE_DEFAULT_CHAIN",
    label: "Default chain ID",
    group: "General",
    type: "text",
    placeholder: "e.g. 56",
    description: "Chain selected by default. Leave empty to ask the wallet.",
  },
  {
    key: "VITE_CUSTOM_LOGO_URL",
    label: "Primary logo",
    group: "Branding",
    type: "text",
    description:
      "Managed in the Appearance tab (upload or URL). Overrides /logo.webp.",
  },
  {
    key: "VITE_CUSTOM_SECONDARY_LOGO_URL",
    label: "Secondary logo",
    group: "Branding",
    type: "text",
    description:
      "Managed in the Appearance tab. Used on the mobile header and wallet screens.",
  },
  {
    key: "VITE_CUSTOM_FAVICON_URL",
    label: "Favicon",
    group: "Branding",
    type: "text",
    description: "Managed in the Appearance tab. Overrides /favicon.webp.",
  },
  {
    key: "VITE_TWITTER_URL",
    label: "Twitter / X URL",
    group: "Social & Community",
    type: "url",
    placeholder: "https://x.com/...",
  },
  {
    key: "VITE_DISCORD_URL",
    label: "Discord URL",
    group: "Social & Community",
    type: "url",
    placeholder: "https://discord.gg/...",
  },
  {
    key: "VITE_TELEGRAM_URL",
    label: "Telegram URL",
    group: "Social & Community",
    type: "url",
    placeholder: "https://t.me/...",
  },
  {
    key: "VITE_ENABLED_MENUS",
    label: "Enabled menus",
    group: "Navigation",
    type: "text",
    placeholder: "Trading,Portfolio,Markets,Swap",
    description:
      "Comma-separated list of: Trading, Portfolio, Markets, Swap, Rewards, Leaderboard, Vaults, Points.",
  },
  {
    key: "VITE_CUSTOM_MENUS",
    label: "Custom menu links",
    group: "Navigation",
    type: "textarea",
    placeholder: "Docs,https://docs.example.com;Blog,https://blog.example.com",
    description: 'Format: "Name,https://url;Name2,https://url2" — opened in a new tab.',
  },
  {
    key: "VITE_ENABLE_CAMPAIGNS",
    label: "Enable campaigns menu ($ORDER)",
    group: "Feature Flags",
    type: "boolean",
  },
  {
    key: "VITE_ENABLE_SERVICE_DISCLAIMER_DIALOG",
    label: "Enable service disclaimer dialog",
    group: "Feature Flags",
    type: "boolean",
  },
  {
    key: "VITE_DISABLE_MAINNET",
    label: "Disable mainnet",
    group: "Feature Flags",
    type: "boolean",
  },
  {
    key: "VITE_DISABLE_TESTNET",
    label: "Disable testnet",
    group: "Feature Flags",
    type: "boolean",
  },
  {
    key: "VITE_ADMIN_ANALYTICS_ENABLED",
    label: "Enable built-in analytics",
    group: "Admin Panel",
    type: "boolean",
    description:
      "Controls the local page-view tracker shown in the Analytics tab.",
  },
  {
    key: "VITE_SUPABASE_URL",
    label: "Supabase project URL",
    group: "Admin Panel",
    type: "url",
    placeholder: "https://your-project.supabase.co",
    description:
      "Enables the email + password sign-in screen that protects /admin. Find it under Project Settings → API.",
  },
  {
    key: "VITE_SUPABASE_ANON_KEY",
    label: "Supabase anon key",
    group: "Admin Panel",
    type: "text",
    placeholder: "eyJhbGciOi…",
    description:
      "The public anon key. Safe for browsers — the service_role key and JWT secret must stay in server environment variables only.",
  },
  {
    key: "VITE_ADMIN_AUTH_MODE",
    label: "Admin sign-in mode",
    group: "Admin Panel",
    type: "select",
    options: [
      { value: "", label: "Automatic (Supabase when configured)" },
      { value: "supabase", label: "Supabase email + password" },
      { value: "passcode", label: "Passcode only" },
      { value: "none", label: "No gate (development)" },
    ],
    description: "Which gate protects the admin panel.",
  },
  {
    key: "VITE_ADMIN_API_URL",
    label: "Admin API URL",
    group: "Admin Panel",
    type: "url",
    placeholder: "/api/admin",
    description:
      "Authorized backend for private users, treasury, compliance, support, and operations data. Served by api/admin/[...path].ts and by the dev server. Prefer a same-origin path; never put an API secret in this setting.",
  },
  {
    key: "VITE_ADMIN_LIVE_REFRESH_MS",
    label: "Live market refresh (ms)",
    group: "Admin Panel",
    type: "text",
    placeholder: "15000",
    description:
      "Polling interval for public market telemetry. Values are safety-clamped between 5 seconds and 5 minutes.",
  },
  {
    key: "VITE_ADMIN_PASSCODE",
    label: "Admin passcode",
    group: "Admin Panel",
    type: "text",
    placeholder: "Leave empty for no protection",
    description:
      "When set, /admin requires this passcode. It protects casual visitors only — set the same value in config.js on your server for consistency.",
  },
  {
    key: "VITE_ADMIN_ENABLED",
    label: "Admin panel enabled",
    group: "Admin Panel",
    type: "select",
    options: [
      { value: "true", label: "Enabled" },
      { value: "false", label: "Disabled (locks /admin)" },
    ],
    description:
      'Set to "false" and export config.js to hide the admin panel in production.',
  },
  {
    key: "VITE_ORDERLY_API_URL",
    label: "Orderly API URL override",
    group: "Advanced",
    type: "url",
    placeholder: "https://api.orderly.org",
    description:
      "Optional API/proxy override for the live admin market queries. Leave empty to follow the frontend's selected Orderly network.",
  },
  {
    key: "VITE_SYMBOL_LIST",
    label: "Frontend market symbols",
    group: "Advanced",
    type: "textarea",
    placeholder: "PERP_BTC_USDC,PERP_ETH_USDC",
    description:
      "Comma-separated symbols exposed by the trading frontend. Live admin market views use this exact list when it is set.",
  },
  {
    key: "VITE_ANALYTICS_SCRIPT",
    label: "External analytics script",
    group: "Advanced",
    type: "textarea",
    placeholder: '<script defer src="https://..." ></script>',
    description:
      "Full script tag(s) for Google Analytics, Plausible, etc. Injected into every page.",
  },
  {
    key: "VITE_TRADING_VIEW_COLOR_CONFIG",
    label: "TradingView color config (JSON)",
    group: "Advanced",
    type: "textarea",
    placeholder: '{"upColor":"#29dfa9","downColor":"#f5618b"}',
  },
];

export const KNOWN_MENU_ITEMS = [
  "Trading",
  "Portfolio",
  "Markets",
  "Swap",
  "Rewards",
  "Leaderboard",
  "Vaults",
  "Points",
];
