import { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  DatabaseZap,
  LoaderCircle,
  RefreshCw,
  ServerCog,
  Settings2,
  WifiOff,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  ADMIN_API_CONFIG_KEY,
  getAdminApiConfigurationError,
  getAdminApiUrl,
} from "@/admin/api/client";
import { formatAge } from "@/admin/data/format";
import { AdminButton, Card } from "./ui";

export function LiveDataBar({
  source,
  updatedAt,
  refreshing = false,
  onRefresh,
  className = "",
}: {
  source: string;
  updatedAt?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[rgba(var(--oui-color-success),0.22)] bg-[rgba(var(--oui-color-success),0.06)] px-3 py-2.5 text-xs ${className}`}
    >
      <div className="flex min-w-0 items-center gap-2 text-[rgb(var(--oui-color-success))]">
        <DatabaseZap size={14} className={refreshing ? "animate-pulse" : ""} />
        <span className="font-medium">Live data</span>
        <span className="truncate text-white/45">{source}</span>
        {updatedAt && <span className="shrink-0 text-white/35">· updated {formatAge(updatedAt)}</span>}
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-white/50 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      )}
    </div>
  );
}

export function QueryErrorState({
  error,
  onRetry,
  title = "Could not load live data",
  compact = false,
}: {
  error: Error | undefined;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) {
  if (!error) return null;
  const content = (
    <>
      <div className="flex min-w-0 items-start gap-2.5">
        <AlertCircle size={compact ? 15 : 18} className="mt-0.5 shrink-0 text-[rgb(var(--oui-color-danger-light))]" />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white">{title}</div>
          <p className="mt-1 break-words text-xs leading-relaxed text-white/50">{error.message}</p>
        </div>
      </div>
      {onRetry && (
        <AdminButton onClick={onRetry} className="shrink-0">
          <RefreshCw size={14} /> Try again
        </AdminButton>
      )}
    </>
  );

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgba(var(--oui-color-danger),0.3)] bg-[rgba(var(--oui-color-danger),0.06)] p-3">
        {content}
      </div>
    );
  }
  return <Card className="border-[rgba(var(--oui-color-danger),0.3)]">{content}</Card>;
}

export function LoadingDataState({ label = "Loading live data…" }: { label?: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] text-white/45">
      <LoaderCircle size={22} className="animate-spin text-[rgb(var(--oui-color-primary-light))]" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyDataState({
  title = "No live records found",
  hint,
  action,
}: {
  title?: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-[rgb(var(--oui-color-base-8))] px-5 text-center">
      <WifiOff size={22} className="text-white/25" />
      <div>
        <p className="text-sm font-medium text-white/70">{title}</p>
        {hint && <div className="mt-1 max-w-md text-xs leading-relaxed text-white/40">{hint}</div>}
      </div>
      {action}
    </div>
  );
}

/**
 * Private data must come from the operator's backend, not from a browser
 * bundle. This view replaces the previous locally generated admin records.
 */
export function AdminApiRequired({
  resource,
  title = "Connect an admin data source",
  description,
}: {
  resource?: string;
  title?: string;
  description?: ReactNode;
}) {
  const configurationError = getAdminApiConfigurationError();
  const endpoint = getAdminApiUrl(resource || "");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 rounded-2xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] p-6 text-center sm:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]">
        <ServerCog size={22} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/50">
          {description ||
            "This area contains private operational data. It intentionally stays empty until it can fetch records from your authorized admin API — no sample users, balances, or transactions are shown."}
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
        <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-white/70">
          <Settings2 size={13} className="text-[rgb(var(--oui-color-primary-light))]" />
          Runtime configuration
        </div>
        {configurationError ? (
          <p className="text-xs leading-relaxed text-[rgb(var(--oui-color-danger-light))]">{configurationError}</p>
        ) : (
          <p className="font-mono text-xs leading-relaxed text-white/45">
            {ADMIN_API_CONFIG_KEY}={endpoint || '"/api/admin"'}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
          Use a same-origin path when possible. The backend must enforce authorization and return JSON; browser-visible runtime config must never contain an admin secret.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/admin/settings">
          <AdminButton variant="primary">
            <Settings2 size={14} /> Open settings
          </AdminButton>
        </Link>
        <a
          href="https://orderly.network/docs/build-on-omnichain/public-info-api/overview"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-white/45 transition-colors hover:bg-white/5 hover:text-white/75"
        >
          <CheckCircle2 size={13} /> Public data is live on Dashboard
        </a>
      </div>
    </div>
  );
}
