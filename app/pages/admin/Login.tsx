/**
 * Admin sign-in screen.
 *
 * Email + password against Supabase Auth. The resulting access token is used
 * both to unlock the panel and as the `Authorization: Bearer` credential for
 * every `/api/admin/*` call, so the UI and the API share one identity.
 */

import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Eye, EyeOff, KeyRound, LoaderCircle, Lock, ShieldCheck } from "lucide-react";
import { AdminButton, TextInput } from "@/admin/components/ui";
import { getRuntimeConfig } from "@/utils/runtime-config";
import {
  SUPABASE_ANON_KEY,
  SUPABASE_URL_KEY,
  SupabaseAuthError,
} from "@/admin/auth/supabase";
import { useAdminAuth } from "@/admin/auth/AdminAuthProvider";

function friendlyMessage(error: unknown): string {
  if (error instanceof SupabaseAuthError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Sign-in failed. Please try again.";
}

function NotConfiguredNotice() {
  return (
    <div className="mt-5 rounded-xl border border-[rgba(var(--oui-color-warning),0.35)] bg-[rgba(var(--oui-color-warning),0.08)] p-3.5 text-left">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[rgb(var(--oui-color-warning))]" />
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs font-semibold text-white">Supabase is not configured</p>
          <p className="text-[11px] leading-relaxed text-white/55">
            Add both values to <code className="rounded bg-white/10 px-1 py-0.5">public/config.js</code> (or set them
            from the Config Editor once unlocked):
          </p>
          <ul className="space-y-1 font-mono text-[11px] text-white/60">
            <li>{SUPABASE_URL_KEY}=https://your-project.supabase.co</li>
            <li>{SUPABASE_ANON_KEY}=eyJhbGciOi…</li>
          </ul>
          <p className="text-[11px] leading-relaxed text-white/40">
            Then grant your account admin access — see <code className="rounded bg-white/10 px-1 py-0.5">docs/admin-api.md</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  const { signIn, supabaseConfigured } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appName = getRuntimeConfig("VITE_APP_NAME") || "Vantide";

  useEffect(() => {
    document.title = "Sign in · Control Panel";
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!email.trim() || !password) {
      setError("Enter both your email and password.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(friendlyMessage(caught));
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--oui-color-base-10))] px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <div className="rounded-2xl border border-white/10 bg-[rgb(var(--oui-color-base-8))] p-8 shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(var(--oui-color-primary),0.15)] text-[rgb(var(--oui-color-primary-light))]">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-center text-lg font-bold text-white">Admin sign in</h1>
          <p className="mt-1 text-center text-xs text-white/45">
            Use the email and password of your {appName} operator account.
          </p>

          <form className="mt-6 space-y-3.5" onSubmit={submit} noValidate>
            <div className="space-y-1.5">
              <label htmlFor="admin-email" className="block text-xs font-medium text-white/60">
                Email
              </label>
              <TextInput
                id="admin-email"
                type="email"
                autoComplete="username"
                value={email}
                placeholder="operator@yourdomain.com"
                disabled={busy}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="admin-password" className="block text-xs font-medium text-white/60">
                Password
              </label>
              <div className="relative">
                <TextInput
                  id="admin-password"
                  type={reveal ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  placeholder="••••••••"
                  disabled={busy}
                  className="pr-10"
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setReveal((current) => !current)}
                  aria-label={reveal ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -mt-2 flex h-7 w-7 items-center justify-center rounded-md text-white/35 hover:bg-white/5 hover:text-white/70"
                >
                  {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[rgba(var(--oui-color-danger),0.35)] bg-[rgba(var(--oui-color-danger),0.08)] px-3 py-2 text-xs leading-relaxed text-[rgb(var(--oui-color-danger-light))]"
              >
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <AdminButton variant="primary" type="submit" className="w-full" disabled={busy || !supabaseConfigured}>
              {busy ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}
              {busy ? "Signing in…" : "Sign in"}
            </AdminButton>
          </form>

          {!supabaseConfigured && <NotConfiguredNotice />}

          <div className="mt-6 flex items-center justify-between text-[11px] text-white/35">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={12} /> Sessions are verified by Supabase
            </span>
            <Link to="/" className="hover:text-white/70">
              Back to site
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-white/25">
          Trouble signing in? Your account must exist in Supabase Auth and be listed in{" "}
          <code className="font-mono">admin_operators</code>, have{" "}
          <code className="font-mono">{'app_metadata.role = "admin"'}</code>, or be listed in{" "}
          <code className="font-mono">ADMIN_ALLOWLIST_EMAILS</code>.
        </p>
      </div>
    </div>
  );
}
