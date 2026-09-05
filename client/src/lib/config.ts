/** Empty in local Vite (uses proxy). On Railway/Vercel set VITE_API_URL to the API origin. */
const FALLBACK_API = "https://kumite-arena-server-production.up.railway.app";
export const API_ORIGIN = String(import.meta.env.VITE_API_URL || (import.meta.env.PROD ? FALLBACK_API : "")).replace(/\/$/, "");

export function apiBase() {
  return API_ORIGIN ? `${API_ORIGIN}/api` : "/api";
}

export function mediaUrl(src?: string | null) {
  if (!src) return "";
  if (/^https?:\/\//i.test(src) || src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (!API_ORIGIN) return src;
  if (src.startsWith("/uploads")) return `${API_ORIGIN}${src}`;
  return src;
}
