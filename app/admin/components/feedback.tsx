/**
 * Feedback primitives: Toast system, ConfirmDialog, Drawer, Modal,
 * Skeletons and an ErrorState. Designed for the admin dark theme.
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, AlertTriangle, Info, X, RotateCcw } from "lucide-react";
import { AdminButton } from "./ui";

/* ------------------------------------------------------------------ */
/* Toasts                                                             */
/* ------------------------------------------------------------------ */

export interface ToastItem {
  id: number;
  type: "success" | "error" | "info";
  text: string;
  /** optional undo callback rendered as a button */
  undo?: () => void;
}

const ToastCtx = createContext<{
  toasts: ToastItem[];
  push: (type: ToastItem["type"], text: string, undo?: () => void) => void;
  dismiss: (id: number) => void;
}>({ toasts: [], push: () => undefined, dismiss: () => undefined });

let toastSeq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastItem["type"], text: string, undo?: () => void) => {
      const id = toastSeq++;
      setToasts((ts) => [...ts.slice(-4), { id, type, text, undo }]);
      setTimeout(() => dismiss(id), undo ? 8000 : 4500);
    },
    [dismiss]
  );

  return (
    <ToastCtx.Provider value={{ toasts, push, dismiss }}>
      {children}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const { push } = useContext(ToastCtx);
  return {
    success: (t: string, undo?: () => void) => push("success", t, undo),
    error: (t: string) => push("error", t),
    info: (t: string) => push("info", t),
  };
}

export function ToastViewport() {
  const { toasts, dismiss } = useContext(ToastCtx);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[999] flex w-[min(92vw,380px)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="admin-toast pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-6))] px-4 py-3 shadow-2xl"
        >
          <span
            className={`shrink-0 ${
              t.type === "success"
                ? "text-[rgb(var(--oui-color-success))]"
                : t.type === "error"
                  ? "text-[rgb(var(--oui-color-danger-light))]"
                  : "text-[rgb(var(--oui-color-primary-light))]"
            }`}
          >
            {t.type === "success" ? <Check size={16} /> : t.type === "error" ? <AlertTriangle size={16} /> : <Info size={16} />}
          </span>
          <span className="flex-1 text-sm text-white/85">{t.text}</span>
          {t.undo && (
            <button
              onClick={() => {
                t.undo?.();
                dismiss(t.id);
              }}
              className="flex shrink-0 items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/20"
            >
              <RotateCcw size={12} />
              Undo
            </button>
          )}
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-white/35 hover:text-white/70"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Modal + Confirm dialog                                             */
/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[998] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        tabIndex={-1}
        className="admin-fade absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`admin-pop relative w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border border-white/10 bg-[rgb(var(--oui-color-base-7))] shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-white/35 hover:text-white/75"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <AdminButton onClick={onClose}>Cancel</AdminButton>
          <AdminButton
            variant={danger ? "danger" : "primary"}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </AdminButton>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            danger
              ? "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger-light))]"
              : "bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]"
          }`}
        >
          <AlertTriangle size={17} />
        </div>
        <div className="text-sm leading-relaxed text-white/70">{message}</div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer (right side)                                                */
/* ------------------------------------------------------------------ */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 440,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[997]">
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        className="admin-fade absolute inset-0 cursor-default bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className="admin-drawer absolute right-0 top-0 flex h-full flex-col border-l border-white/10 bg-[rgb(var(--oui-color-base-8))] shadow-2xl"
        style={{ width: `min(${width}px, 94vw)` }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-white/35 hover:text-white/75"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/5 px-5 py-3.5">
            {footer}
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Skeletons                                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`admin-skeleton rounded-lg ${className}`} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5 p-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton
              key={j}
              className={`h-9 ${j === 0 ? "w-1/4" : j === cols - 1 ? "w-1/6" : "flex-1"}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardsSkeleton({ n = 4 }: { n?: number }) {
  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-${Math.min(n, 4)}`}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-[76px]" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Error state + simulated loading hook                               */
/* ------------------------------------------------------------------ */

export function ErrorState({
  title = "Something went wrong",
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(var(--oui-color-danger),0.12)] text-[rgb(var(--oui-color-danger-light))]">
        <AlertTriangle size={22} />
      </div>
      <p className="text-sm font-medium text-white/80">{title}</p>
      {detail && <p className="max-w-sm text-xs text-white/40">{detail}</p>}
      {onRetry && (
        <AdminButton onClick={onRetry} className="mt-1">
          Retry
        </AdminButton>
      )}
    </div>
  );
}

/**  const ref = useRef(false);
 * Simulated mock-API loading: returns true for `ms` on first mount.
 * Gives tables/pages their skeleton phase, like a real backend fetch.
 */
export function useMockLoading(ms = 350): boolean {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return loading;
}
