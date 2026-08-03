/**
 * Lightweight, privacy-friendly client-side analytics for the admin panel.
 *
 * There is no backend in this template, so page-view events are stored in
 * the browser's localStorage and aggregated on read. This gives the
 * operator a sense of how the dapp is used on this browser/device. For
 * real cross-user analytics, configure an external analytics script via
 * `VITE_ANALYTICS_SCRIPT` (there is a field for it in the admin Settings).
 *
 * This module intentionally avoids importing runtime-config consumers that
 * would create import cycles; it reads the enable-flag defensively through
 * runtime-config, which only depends on adminStore.
 */

import { getRuntimeConfig } from "@/utils/runtime-config";

const EVENTS_KEY = "vantide-analytics-events";
const SESSION_KEY = "vantide-analytics-session-id";
const FIRST_SEEN_KEY = "vantide-analytics-first-seen";
const MAX_EVENTS = 2000;

export interface PageViewEvent {
  /** path + search */
  p: string;
  /** epoch ms */
  t: number;
  /** session id */
  s: string;
  /** referrer hostname, if any */
  r?: string;
}

export interface DailyBucket {
  /** YYYY-MM-DD (local) */
  date: string;
  label: string;
  views: number;
  sessions: number;
}

export interface TopPage {
  path: string;
  views: number;
}

export interface AnalyticsSummary {
  enabled: boolean;
  totalViews: number;
  todayViews: number;
  uniqueSessions: number;
  avgViewsPerSession: number;
  firstTrackedAt: number | null;
  daily: DailyBucket[];
  topPages: TopPage[];
  recent: PageViewEvent[];
  externalScriptConfigured: boolean;
}

function generateId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = generateId();
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "unknown";
  }
}

export function isAnalyticsEnabled(): boolean {
  // enabled unless explicitly turned off
  return getRuntimeConfig("VITE_ADMIN_ANALYTICS_ENABLED") !== "false";
}

export function getAnalyticsEvents(): PageViewEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PageViewEvent[]) : [];
  } catch {
    return [];
  }
}

export function trackPageView(path: string): void {
  if (typeof window === "undefined") return;
  if (!isAnalyticsEnabled()) return;
  // Don't pollute stats with admin browsing.
  if (path === "/admin" || path.startsWith("/admin/")) return;

  try {
    const events = getAnalyticsEvents();
    let referrer: string | undefined;
    try {
      if (document.referrer) {
        referrer = new URL(document.referrer).hostname;
      }
    } catch {
      /* ignore */
    }

    events.push({ p: path, t: Date.now(), s: getSessionId(), r: referrer });

    if (!window.localStorage.getItem(FIRST_SEEN_KEY)) {
      window.localStorage.setItem(FIRST_SEEN_KEY, String(Date.now()));
    }

    window.localStorage.setItem(
      EVENTS_KEY,
      JSON.stringify(events.slice(-MAX_EVENTS))
    );
  } catch (e) {
    console.warn("[analytics] could not persist page view:", e);
  }
}

export function clearAnalyticsEvents(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(EVENTS_KEY);
    window.localStorage.removeItem(FIRST_SEEN_KEY);
  } catch {
    /* ignore */
  }
}

function dayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dayLabel(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function getAnalyticsSummary(): AnalyticsSummary {
  const events = getAnalyticsEvents();
  const enabled = isAnalyticsEnabled();

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const startOfToday = now.getTime();

  // Build the last 14 day buckets (oldest -> newest).
  const daily: DailyBucket[] = [];
  for (let i = 13; i >= 0; i--) {
    const dayStart = startOfToday - i * 24 * 60 * 60 * 1000;
    daily.push({
      date: dayKey(dayStart),
      label: dayLabel(dayStart),
      views: 0,
      sessions: 0,
    });
  }
  const bucketByDate = new Map(daily.map((b) => [b.date, b]));
  const sessionsByDate = new Map<string, Set<string>>();

  const sessions = new Set<string>();
  const pageCounts = new Map<string, number>();
  let todayViews = 0;

  for (const event of events) {
    sessions.add(event.s);
    pageCounts.set(event.p, (pageCounts.get(event.p) || 0) + 1);
    if (event.t >= startOfToday) todayViews += 1;

    const bucket = bucketByDate.get(dayKey(event.t));
    if (bucket) {
      bucket.views += 1;
      let set = sessionsByDate.get(bucket.date);
      if (!set) {
        set = new Set();
        sessionsByDate.set(bucket.date, set);
      }
      set.add(event.s);
    }
  }

  sessionsByDate.forEach((set, date) => {
    const bucket = bucketByDate.get(date);
    if (bucket) bucket.sessions = set.size;
  });

  const topPages: TopPage[] = Array.from(pageCounts.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  let firstTrackedAt: number | null = null;
  try {
    const raw = window.localStorage.getItem(FIRST_SEEN_KEY);
    if (raw) firstTrackedAt = Number(raw) || null;
  } catch {
    /* ignore */
  }

  const uniqueSessions = sessions.size;

  return {
    enabled,
    totalViews: events.length,
    todayViews,
    uniqueSessions,
    avgViewsPerSession:
      uniqueSessions > 0 ? Math.round((events.length / uniqueSessions) * 10) / 10 : 0,
    firstTrackedAt,
    daily,
    topPages,
    recent: events.slice(-15).reverse(),
    externalScriptConfigured: Boolean(getRuntimeConfig("VITE_ANALYTICS_SCRIPT")),
  };
}

export function trackAnalyticsEvent(): void {
  // Reserved for future custom events (wallet connected, trade placed, ...).
}
