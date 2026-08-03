import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "@/admin/analytics";

/**
 * Records a page view in the local analytics store on every route change.
 * Mounted once near the app root. Admin pages are excluded by the tracker.
 */
export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  return null;
}
