import {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Check, AlertTriangle, LucideIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Layout primitives                                                  */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className = "",
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] ${className}`}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-white/5 px-5 py-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold text-white">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-xs text-white/45">{subtitle}</p>
            )}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger";
}) {
  const accents: Record<string, string> = {
    primary:
      "bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]",
    success:
      "bg-[rgba(var(--oui-color-success),0.15)] text-[rgb(var(--oui-color-success))]",
    warning:
      "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]",
    danger:
      "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger))]",
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] px-5 py-4">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${accents[accent]}`}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-xs text-white/45">{label}</div>
        <div className="truncate text-xl font-bold text-white">{value}</div>
        {hint && <div className="truncate text-[11px] text-white/35">{hint}</div>}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/10 text-white/60",
    primary:
      "bg-[rgba(var(--oui-color-primary),0.18)] text-[rgb(var(--oui-color-primary-light))]",
    success:
      "bg-[rgba(var(--oui-color-success),0.15)] text-[rgb(var(--oui-color-success))]",
    warning:
      "bg-[rgba(var(--oui-color-warning),0.15)] text-[rgb(var(--oui-color-warning))]",
    danger:
      "bg-[rgba(var(--oui-color-danger),0.15)] text-[rgb(var(--oui-color-danger))]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                            */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function AdminButton({
  variant = "secondary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-[rgb(var(--oui-color-primary))] text-white hover:bg-[rgb(var(--oui-color-primary-darken))] disabled:opacity-50",
    secondary:
      "border border-white/15 bg-white/5 text-white/80 hover:bg-white/10 disabled:opacity-50",
    danger:
      "border border-[rgba(var(--oui-color-danger),0.4)] bg-[rgba(var(--oui-color-danger),0.12)] text-[rgb(var(--oui-color-danger-light))] hover:bg-[rgba(var(--oui-color-danger),0.2)] disabled:opacity-50",
    ghost: "text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${variants[variant]} ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                      */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-lg border border-white/10 bg-[rgb(var(--oui-color-base-9))] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-[rgba(var(--oui-color-primary),0.6)] focus:ring-1 focus:ring-[rgba(var(--oui-color-primary),0.4)]";

export function Field({
  label,
  hint,
  children,
  overridden,
  onReset,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  overridden?: boolean;
  onReset?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-white/60">{label}</label>
        {overridden && (
          <span className="flex items-center gap-2">
            <Badge tone="primary">Modified</Badge>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-[11px] text-white/40 underline-offset-2 hover:text-white/80 hover:underline"
              >
                Reset
              </button>
            )}
          </span>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-white/35">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className || ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`${inputClass} min-h-[80px] font-mono text-xs ${props.className || ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${props.className || ""}`} />
  );
}

/**
 * ON/OFF switch.
 *
 * The visuals live in `app/styles/index.css` (`.admin-switch*`) instead of
 * Tailwind transform utilities: `translate-x-*` compiles to a shared
 * `transform` declaration that CSS minifiers merge between rules, which is
 * what made the knob sit on top of the track edge in the "off" state of
 * production builds. Plain CSS with `data-on` cannot be purged or merged
 * away, and the track now carries an explicit ON/OFF label so the current
 * state is never ambiguous.
 */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  size = "md",
  ariaLabel,
  id,
  className = "",
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  /** `true` renders Enabled/Disabled beside the track, a string renders that text. */
  label?: boolean | string;
  size?: "sm" | "md";
  ariaLabel?: string;
  id?: string;
  className?: string;
}) {
  const stateLabel = checked ? "Enabled" : "Disabled";
  const describedBy = typeof label === "string" ? label : stateLabel;

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-label={ariaLabel ?? describedBy}
        title={`${describedBy} — click to turn ${checked ? "off" : "on"}`}
        disabled={disabled}
        data-on={checked ? "true" : "false"}
        data-state={checked ? "on" : "off"}
        onClick={() => onChange(!checked)}
        className={`admin-switch admin-switch-${size}`}
      >
        <span className="admin-switch-text admin-switch-text-on" aria-hidden="true">
          ON
        </span>
        <span className="admin-switch-text admin-switch-text-off" aria-hidden="true">
          OFF
        </span>
        <span className="admin-switch-knob" aria-hidden="true" />
      </button>
      {label && (
        <span className="admin-switch-label" data-on={checked ? "true" : "false"}>
          {describedBy}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Flash messages                                                     */
/* ------------------------------------------------------------------ */

export interface FlashMessage {
  type: "success" | "error";
  text: string;
}

export function useFlashMessage(timeoutMs = 4000) {
  const [message, setMessage] = useState<FlashMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (type: FlashMessage["type"], text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage({ type, text });
      timer.current = setTimeout(() => setMessage(null), timeoutMs);
    },
    [timeoutMs]
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { message, show };
}

export function FlashBanner({ message }: { message: FlashMessage | null }) {
  if (!message) return null;
  const success = message.type === "success";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
        success
          ? "border-[rgba(var(--oui-color-success),0.35)] bg-[rgba(var(--oui-color-success),0.1)] text-[rgb(var(--oui-color-success))]"
          : "border-[rgba(var(--oui-color-danger),0.35)] bg-[rgba(var(--oui-color-danger),0.1)] text-[rgb(var(--oui-color-danger-light))]"
      }`}
    >
      {success ? <Check size={16} /> : <AlertTriangle size={16} />}
      <span>{message.text}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                               */
/* ------------------------------------------------------------------ */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-white/45">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-white/30">
        <Icon size={22} />
      </div>
      <p className="text-sm font-medium text-white/70">{title}</p>
      {description && (
        <p className="max-w-sm text-xs text-white/40">{description}</p>
      )}
    </div>
  );
}
