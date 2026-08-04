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
