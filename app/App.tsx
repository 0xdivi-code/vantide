import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import OrderlyProvider from "@/components/orderlyProvider";
import { HttpsRequiredWarning } from "@/components/HttpsRequiredWarning";
import AnalyticsTracker from "@/admin/AnalyticsTracker";
import ThemeInjector from "@/admin/ThemeInjector";
import { useConfigVersion } from "@/admin/useConfigVersion";
import { getRuntimeConfig } from "./utils/runtime-config";
import { withBasePath } from "./utils/base-path";
import { getSEOConfig, getUserLanguage } from "./utils/seo";

export default function App() {
  const seoConfig = getSEOConfig();
  const defaultLanguage = getUserLanguage();
  // Re-render when admin overrides change (e.g. custom favicon).
  useConfigVersion();
  const favicon =
    getRuntimeConfig("VITE_CUSTOM_FAVICON_URL") || withBasePath("/favicon.webp");

  return (
    <>
      <Helmet>
        <html lang={seoConfig.language || defaultLanguage} />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/webp" href={favicon} />
      </Helmet>
      <HttpsRequiredWarning />
      <AnalyticsTracker />
      <ThemeInjector />
      <OrderlyProvider>
        <Outlet />
      </OrderlyProvider>
    </>
  );
}

