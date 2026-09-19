import { useRef, type ReactNode } from "react";

export const OTP_LEN = 6;

export function AuthField({
  label,
  icon,
  type = "text",
  value,
  onChange,
  autoComplete,
  extra,
  onEnter,
}: {
  label: string;
  icon: ReactNode;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  extra?: ReactNode;
  onEnter?: () => void;
}) {
  return (
    <label className="auth-field">
      <span className="auth-ico" aria-hidden="true">{icon}</span>
      <span className="auth-field-body">
        <span className="auth-label">{label}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        />
      </span>
      {extra}
    </label>
  );
}

export function IconPerson() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19c1.5-3.2 4-5 7-5s5.5 1.8 7 5" />
    </svg>
  );
}

export function IconMail() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <path d="M4 7.5l8 6.2 8-6.2" />
    </svg>
  );
}

export function IconLock() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8.2A4 4 0 0112 4.2 4 4 0 0116 8.2V11" />
    </svg>
  );
}

export function OtpBoxes({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: OTP_LEN }, (_, i) => value[i] ?? "");

  function apply(next: string, focusAt?: number) {
    const code = next.replace(/\D/g, "").slice(0, OTP_LEN);
    onChange(code);
    if (focusAt !== undefined) refs.current[Math.min(focusAt, OTP_LEN - 1)]?.focus();
    if (code.length === OTP_LEN) onComplete?.(code);
  }

  return (
    <div className="otp-row" role="group">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className={`otp-cell${d ? " filled" : ""}`}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={i === 0 ? OTP_LEN : 1}
          value={d}
          disabled={disabled}
          aria-label={`${i + 1}`}
          onChange={(e) => {
            const raw = e.target.value.replace(/\D/g, "");
            if (raw.length > 1) {
              apply(value.slice(0, i) + raw, i + raw.length);
              return;
            }
            const next = digits.slice();
            next[i] = raw.slice(-1);
            apply(next.join(""), raw ? i + 1 : i);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              const next = digits.slice();
              next[i - 1] = "";
              apply(next.join(""), i - 1);
            }
            if (e.key === "ArrowLeft" && i > 0) {
              e.preventDefault();
              refs.current[i - 1]?.focus();
            }
            if (e.key === "ArrowRight" && i < OTP_LEN - 1) {
              e.preventDefault();
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            apply(e.clipboardData.getData("text"), OTP_LEN);
          }}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
