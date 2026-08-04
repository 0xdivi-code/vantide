import { buildThemeCss } from "@/admin/theme";
import { useConfigVersion } from "@/admin/useConfigVersion";

/**
 * Injects the :root CSS variable overrides for the admin-selected theme.
 * Mounted once near the app root; re-renders instantly when theme colors
 * change (via the admin override store's pub/sub).
 */
export default function ThemeInjector() {
  useConfigVersion();
  const css = buildThemeCss();
  if (!css) return null;
  return <style data-admin-theme="">{css}</style>;
}
