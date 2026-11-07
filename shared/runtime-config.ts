/**
 * Browser-safe settings that may be published through the admin API.
 *
 * This is deliberately not an arbitrary key/value namespace. Broker identity,
 * chain selection, wallet credentials, admin authentication and executable
 * analytics markup stay deployment-controlled. Keep this module free of DOM
 * and Node dependencies: it is imported by both the browser and the server.
 */
export const SHARED_RUNTIME_CONFIG_KEYS = [
  "VITE_APP_NAME",
  "VITE_APP_DESCRIPTION",
  "VITE_ORDERLY_BROKER_NAME",
  "VITE_CUSTOM_LOGO_URL",
  "VITE_CUSTOM_SECONDARY_LOGO_URL",
  "VITE_CUSTOM_FAVICON_URL",
  "VITE_HAS_PRIMARY_LOGO",
  "VITE_HAS_SECONDARY_LOGO",
  "VITE_TELEGRAM_URL",
  "VITE_DISCORD_URL",
  "VITE_TWITTER_URL",
  "VITE_ENABLED_MENUS",
  "VITE_CUSTOM_MENUS",
  "VITE_ENABLE_CAMPAIGNS",
  "VITE_ENABLE_SERVICE_DISCLAIMER_DIALOG",
  "VITE_SEO_SITE_NAME",
  "VITE_SEO_SITE_DESCRIPTION",
  "VITE_SEO_SITE_URL",
  "VITE_SEO_SITE_LANGUAGE",
  "VITE_SEO_SITE_LOCALE",
  "VITE_SEO_TWITTER_HANDLE",
  "VITE_SEO_THEME_COLOR",
  "VITE_SEO_KEYWORDS",
  "VITE_AVAILABLE_LANGUAGES",
  "VITE_USE_CUSTOM_PNL_POSTERS",
  "VITE_CUSTOM_PNL_POSTER_COUNT",
  "VITE_TRADING_VIEW_COLOR_CONFIG",
  "VITE_SYMBOL_LIST",
  "VITE_ADMIN_ANALYTICS_ENABLED",
  "VITE_ADMIN_LIVE_REFRESH_MS",
  "THEME_COLOR_PRIMARY",
  "THEME_COLOR_PRIMARY_DARKEN",
  "THEME_COLOR_LINK",
  "THEME_COLOR_SUCCESS",
  "THEME_COLOR_DANGER",
  "THEME_COLOR_WARNING",
  "THEME_COLOR_TRADING_PROFIT",
  "THEME_COLOR_TRADING_LOSS",
] as const;

export type SharedRuntimeConfigKey = (typeof SHARED_RUNTIME_CONFIG_KEYS)[number];
export type SharedRuntimeConfig = Partial<Record<SharedRuntimeConfigKey, string>>;
export type SharedRuntimeConfigChanges = Partial<
  Record<SharedRuntimeConfigKey, string | null>
>;

const SHARED_KEY_SET: ReadonlySet<string> = new Set(SHARED_RUNTIME_CONFIG_KEYS);
const BOOLEAN_KEYS: ReadonlySet<string> = new Set([
  "VITE_HAS_PRIMARY_LOGO",
  "VITE_HAS_SECONDARY_LOGO",
  "VITE_ENABLE_CAMPAIGNS",
  "VITE_ENABLE_SERVICE_DISCLAIMER_DIALOG",
  "VITE_USE_CUSTOM_PNL_POSTERS",
  "VITE_ADMIN_ANALYTICS_ENABLED",
]);
const HTTP_URL_KEYS: ReadonlySet<string> = new Set([
  "VITE_TELEGRAM_URL",
  "VITE_DISCORD_URL",
  "VITE_TWITTER_URL",
  "VITE_SEO_SITE_URL",
]);
const IMAGE_URL_KEYS: ReadonlySet<string> = new Set([
  "VITE_CUSTOM_LOGO_URL",
  "VITE_CUSTOM_SECONDARY_LOGO_URL",
  "VITE_CUSTOM_FAVICON_URL",
]);

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validImageUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  if (/^data:image\/(?:png|jpeg|webp|gif|svg\+xml);base64,[a-z0-9+/=\r\n]+$/i.test(value)) {
    return true;
  }
  return validHttpUrl(value);
}

/** Return a user-facing validation error, or undefined when the value is safe. */
export function validateSharedRuntimeConfigValue(
  key: SharedRuntimeConfigKey,
  value: string
): string | undefined {
  if (BOOLEAN_KEYS.has(key) && value !== "true" && value !== "false") {
    return `${key} must be "true" or "false".`;
  }
  if (HTTP_URL_KEYS.has(key) && value && !validHttpUrl(value)) {
    return `${key} must be a full HTTP(S) URL.`;
  }
  if (IMAGE_URL_KEYS.has(key) && value && !validImageUrl(value)) {
    return `${key} must be an HTTP(S) URL, a root-relative path, or a supported base64 image data URL.`;
  }
  if (key.startsWith("THEME_COLOR_") && !/^#[0-9a-f]{6}$/i.test(value)) {
    return `${key} must be a six-digit hex color such as #B084E9.`;
  }
  if (key === "VITE_CUSTOM_PNL_POSTER_COUNT") {
    const count = Number(value);
    if (!Number.isInteger(count) || count < 0 || count > 100) {
      return "VITE_CUSTOM_PNL_POSTER_COUNT must be an integer from 0 to 100.";
    }
  }
  if (key === "VITE_ADMIN_LIVE_REFRESH_MS") {
    const interval = Number(value);
    if (!Number.isInteger(interval) || interval < 5_000 || interval > 300_000) {
      return "VITE_ADMIN_LIVE_REFRESH_MS must be an integer from 5000 to 300000.";
    }
  }
  if (key === "VITE_CUSTOM_MENUS" && value) {
    const items = value.split(";").map((item) => item.trim()).filter(Boolean);
    if (items.length > 50) return "VITE_CUSTOM_MENUS supports at most 50 items.";
    for (const item of items) {
      const [name, href, extra] = item.split(",").map((part) => part.trim());
      if (!name || !href || extra !== undefined || name.length > 60 || !validHttpUrl(href)) {
        return "Each custom menu must be Name,https://safe-url.example with a name of at most 60 characters.";
      }
    }
  }
  if (key === "VITE_TRADING_VIEW_COLOR_CONFIG" && value) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return "VITE_TRADING_VIEW_COLOR_CONFIG must be a JSON object.";
      }
    } catch {
      return "VITE_TRADING_VIEW_COLOR_CONFIG must contain valid JSON.";
    }
  }
  if (key === "VITE_SYMBOL_LIST" && value) {
    const symbols = value.split(",").map((symbol) => symbol.trim()).filter(Boolean);
    if (symbols.some((symbol) => !/^PERP_[A-Z0-9]+(?:_[A-Z0-9]+)*$/.test(symbol))) {
      return "VITE_SYMBOL_LIST must contain comma-separated Orderly symbols such as PERP_BTC_USDC.";
    }
  }
  if (key === "VITE_AVAILABLE_LANGUAGES" && value) {
    const languages = value.split(",").map((language) => language.trim()).filter(Boolean);
    if (languages.some((language) => !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language))) {
      return "VITE_AVAILABLE_LANGUAGES must contain comma-separated language codes such as en,zh,es.";
    }
  }
  return undefined;
}

export function isSharedRuntimeConfigKey(
  key: string
): key is SharedRuntimeConfigKey {
  return SHARED_KEY_SET.has(key);
}

/** Drop unknown or non-string values before data reaches browser config. */
export function sanitizeSharedRuntimeConfig(value: unknown): SharedRuntimeConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: SharedRuntimeConfig = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      isSharedRuntimeConfigKey(key) &&
      typeof item === "string" &&
      validateSharedRuntimeConfigValue(key, item) === undefined
    ) {
      result[key] = item;
    }
  }
  return result;
}
