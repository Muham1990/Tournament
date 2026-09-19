import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { requireSupabase, supabase } from "../lib/supabase";

export function isEmailConfirmed(user: User | null | undefined) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at);
}

interface SbAuth {
  user: User | null;
  session: Session | null;
  loading: boolean;
  confirmed: boolean;
  signUp: (email: string, password: string, name: string) => Promise<User | null>;
  verifySignup: (email: string, token: string) => Promise<void>;
  resendSignup: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SbAuth | null>(null);

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let off = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!off) {
        setSession(data.session);
        setLoading(false);
      }
    }).catch(() => {
      if (!off) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => {
      off = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const confirmed = isEmailConfirmed(user);

  const value = useMemo<SbAuth>(
    () => ({
      user,
      session,
      loading,
      confirmed,
      signUp: async (email, password, name) => {
        const sb = requireSupabase();
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        if (data.user?.identities && data.user.identities.length === 0) {
          const dup = new Error("already registered");
          (dup as { code?: string }).code = "user_already_exists";
          throw dup;
        }
        if (data.session) setSession(data.session);
        return data.user;
      },
      verifySignup: async (email, token) => {
        const sb = requireSupabase();
        const { data, error } = await sb.auth.verifyOtp({
          email,
          token: token.trim(),
          type: "signup",
        });
        if (error) throw error;
        if (data.session) setSession(data.session);
        const user = data.user ?? data.session?.user ?? null;
        if (!isEmailConfirmed(user)) {
          throw new Error("email_not_confirmed");
        }
      },
      resendSignup: async (email) => {
        const sb = requireSupabase();
        const { error } = await sb.auth.resend({ type: "signup", email });
        if (error) throw error;
      },
      signOut: async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
      },
    }),
    [user, session, loading, confirmed],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSupabaseAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSupabaseAuth");
  return v;
}
