type TFn = (key: string) => string;

export function supabaseAuthMessage(err: unknown, t: TFn): string {
  if (err instanceof Error && err.message === "NO_SUPABASE") return t("auth.errConfig");
  const raw = err as { message?: string; code?: string; error?: { message?: string; code?: string } };
  const code = String(raw?.code || raw?.error?.code || "").toLowerCase();
  const m = String(raw?.message || raw?.error?.message || "").toLowerCase();

  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || m.includes("rate limit") || m.includes("security purposes")) {
    return t("auth.errRate");
  }
  if (code === "user_already_exists" || m.includes("already registered") || m.includes("already been registered")) {
    return t("auth.errExists");
  }
  if (code === "otp_expired" || m.includes("expired")) return t("auth.errExpired");
  if (code === "otp_disabled") return t("auth.errCode");
  if (m.includes("invalid") && (m.includes("otp") || m.includes("token") || m.includes("code") || code.includes("otp"))) {
    return t("auth.errCode");
  }
  if (code === "email_not_confirmed" || m.includes("email_not_confirmed") || m.includes("email not confirmed")) {
    return t("auth.errUnconfirmed");
  }
  if (m.includes("invalid login") || m.includes("invalid credentials") || code === "invalid_credentials") {
    return t("auth.errCreds");
  }
  if (m.includes("password") && (m.includes("least") || m.includes("weak") || m.includes("short") || m.includes("6"))) {
    return t("auth.errPassword");
  }
  if (m.includes("unable to validate email") || m.includes("invalid email") || code === "email_address_invalid") {
    return t("auth.errEmail");
  }
  if (m.includes("signup is disabled") || m.includes("signups not allowed")) return t("auth.errDisabled");
  return t("auth.errGeneric");
}
