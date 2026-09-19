export const RESEND_WAIT_SEC = 60;

const EMAIL_KEY = "ka-signup-email";
const RESEND_KEY = "ka-signup-resend-until";

function read(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

export function getPendingSignupEmail() {
  return read(EMAIL_KEY) || "";
}

export function setPendingSignupEmail(email: string) {
  write(EMAIL_KEY, email);
}

export function markSignupEmailSent() {
  write(RESEND_KEY, String(Date.now() + RESEND_WAIT_SEC * 1000));
}

export function signupResendWaitSec() {
  const until = Number(read(RESEND_KEY) || 0);
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

export function clearPendingSignup() {
  try {
    sessionStorage.removeItem(EMAIL_KEY);
    sessionStorage.removeItem(RESEND_KEY);
  } catch {
    /* ignore */
  }
}
