/**
 * React bindings for the admin Supabase session.
 *
 * `AdminLayout` renders the login screen while `status === "signed-out"` and
 * the console while `status === "signed-in"`. The API client reads the same
 * session for its `Authorization` header, so a 401 from the admin API can
 * trigger a refresh here instead of dropping the operator out.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ADMIN_UNAUTHORIZED_EVENT,
  getAdminSession,
  handleUnauthorized,
  isSessionExpired,
  isSupabaseAuthConfigured,
  refreshSession,
  signInWithPassword,
  signOut as signOutSession,
  subscribeAdminAuth,
  type AdminSession,
} from "./supabase";

export { ADMIN_UNAUTHORIZED_EVENT };

export type AdminAuthStatus = "checking" | "signed-out" | "signed-in";

export interface AdminAuthValue {
  status: AdminAuthStatus;
  session: AdminSession | null;
  email: string | undefined;
  role: string | undefined;
  /** False when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
  supabaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [status, setStatus] = useState<AdminAuthStatus>("checking");
  const supabaseConfigured = isSupabaseAuthConfigured();

  useEffect(() => {
    let cancelled = false;

    const sync = (value: AdminSession | null) => {
      if (cancelled) return;
      setSession(value);
      setStatus(value ? "signed-in" : "signed-out");
    };

    const unsubscribe = subscribeAdminAuth(() => sync(getAdminSession()));
    const stored = getAdminSession();
    sync(stored);

    if (stored && isSessionExpired(stored)) {
      void refreshSession()
        .then((next) => sync(next ?? getAdminSession()))
        .catch(() => sync(getAdminSession()));
    }

    // The API client fires this when a request is rejected with 401.
    const onUnauthorized = () => {
      void handleUnauthorized().then((recovered) => sync(recovered ? getAdminSession() : null));
    };
    window.addEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener(ADMIN_UNAUTHORIZED_EVENT, onUnauthorized);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
  }, []);

  const signOut = useCallback(async () => {
    await signOutSession();
  }, []);

  const refresh = useCallback(async () => {
    await refreshSession();
  }, []);

  const value = useMemo<AdminAuthValue>(
    () => ({
      status,
      session,
      email: session?.user.email,
      role: session?.user.role,
      supabaseConfigured,
      signIn,
      signOut,
      refresh,
    }),
    [status, session, supabaseConfigured, signIn, signOut, refresh]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error("useAdminAuth must be used inside <AdminAuthProvider>.");
  }
  return context;
}
