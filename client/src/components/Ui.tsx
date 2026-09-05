import type { ReactNode } from "react";

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="lang-btn" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmModal({
  title, text, confirmLabel, cancelLabel, onConfirm, onClose,
}: {
  title: string; text: string; confirmLabel: string; cancelLabel: string;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{text}</p>
      <div className="btn-row">
        <button className="btn btn-ghost" onClick={onClose}>{cancelLabel}</button>
        <button className="btn" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p>{text}</p>
      {action}
    </div>
  );
}

export function Loading() {
  return <div className="empty">…</div>;
}

export function ErrorState({ text }: { text: string }) {
  return <div className="empty err">{text}</div>;
}

export function Pagination({
  page, pageSize, total, onChange,
}: { page: number; pageSize: number; total: number; onChange: (p: number, s: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="btn-row" style={{ marginTop: 12, alignItems: "center" }}>
      <button className="btn btn-ghost" disabled={page <= 1} onClick={() => onChange(page - 1, pageSize)}>‹</button>
      <span>{page} / {pages}</span>
      <button className="btn btn-ghost" disabled={page >= pages} onClick={() => onChange(page + 1, pageSize)}>›</button>
      <select value={pageSize} onChange={(e) => onChange(1, Number(e.target.value))}>
        {[25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="grow">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <span className="search-ico">🔍</span>
    </div>
  );
}

export function CountryFilter({
  value, onChange, countries, label,
}: {
  value: string; onChange: (v: string) => void;
  countries: { id: string; nameRu: string; name: string; flag: string }[];
  label: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 180 }}>
      <option value="">{label}</option>
      {countries.map((c) => (
        <option key={c.id} value={c.id}>{c.flag} {c.nameRu || c.name}</option>
      ))}
    </select>
  );
}
