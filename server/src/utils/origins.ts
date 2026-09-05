function clean(url: string) {
  return url.trim().replace(/\/$/, "");
}

export function allowedOrigins(): string[] {
  const extra = (process.env.CLIENT_URLS || "")
    .split(",")
    .map(clean)
    .filter(Boolean);
  return [
    clean(process.env.CLIENT_URL || "http://localhost:5173"),
    clean(process.env.TELEGRAM_WEBAPP_URL || ""),
    ...extra,
  ].filter(Boolean);
}

export function corsOrigin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) {
  if (!origin) {
    cb(null, true);
    return;
  }
  const host = (() => {
    try { return new URL(origin).hostname; } catch { return ""; }
  })();
  const ok = allowedOrigins().includes(clean(origin)) || host.endsWith(".vercel.app");
  cb(null, ok);
}

export function cookieOptions(maxAge: number) {
  const crossSite = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    maxAge,
    sameSite: (crossSite ? "none" : "lax") as "none" | "lax",
    secure: crossSite,
  };
}
