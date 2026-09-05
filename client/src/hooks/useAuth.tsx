import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthApi } from "../services/endpoints";
import type { User } from "../types";
import { markAdminEntry } from "../lib/adminGate";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    AuthApi.me()
      .then((r) => setUser(r.data.user))
      .catch(() => {
        localStorage.removeItem("token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const r = await AuthApi.login(email, password);
        localStorage.setItem("token", r.data.token);
        markAdminEntry();
        setUser(r.data.user);
      },
      logout: async () => {
        await AuthApi.logout().catch(() => undefined);
        localStorage.removeItem("token");
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth");
  return v;
}
