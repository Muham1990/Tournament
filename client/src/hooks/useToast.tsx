import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<{ show: (m: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2800);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("toast");
  return v;
}
