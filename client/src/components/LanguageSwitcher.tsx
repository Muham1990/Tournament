import { useTranslation } from "react-i18next";
import { useState } from "react";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cur = i18n.language.startsWith("en") ? "en" : i18n.language.startsWith("tg") ? "tg" : "ru";
  const label = cur === "en" ? t("lang.en") : cur === "tg" ? t("lang.tg") : t("lang.ru");

  return (
    <div style={{ position: "relative" }}>
      <button className="lang-btn" onClick={() => setOpen((v) => !v)}>
        <span className="lang-short">{cur.toUpperCase()}</span>
        <span className="lang-full">{label} ▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 42, background: "#fff", border: "1px solid #eee", zIndex: 20, minWidth: 140, borderRadius: 10, overflow: "hidden", boxShadow: "0 8px 20px rgba(0,0,0,.08)" }}>
          {(["ru", "tg", "en"] as const).map((lng) => (
            <button
              key={lng}
              className="lang-btn"
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px" }}
              onClick={() => {
                void i18n.changeLanguage(lng);
                setOpen(false);
              }}
            >
              {t(`lang.${lng}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
