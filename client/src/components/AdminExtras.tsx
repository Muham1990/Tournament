import type { ReactNode, SelectHTMLAttributes } from "react";

export { Header as AdminHeader } from "./Header";

export function AdminSidebar() {
  return null;
}

export function TatamiCard({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <article className="tatami-card">
      <h3>{name}</h3>
      {children}
    </article>
  );
}

export function ScheduleTable({ rows }: { rows: Array<{ id: string; when: string; title: string }> }) {
  return (
    <table className="data">
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{r.when}</td>
            <td>{r.title}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatisticsCards({ items }: { items: Array<{ n: number; l: string }> }) {
  return (
    <div className="stat-grid">
      {items.map((i) => (
        <div className="stat" key={i.l}>
          <div className="n">{i.n}</div>
          <div className="l">{i.l}</div>
        </div>
      ))}
    </div>
  );
}

export function ResultsTable({ children }: { children: ReactNode }) {
  return <table className="data">{children}</table>;
}

export function CategoryTable({ children }: { children: ReactNode }) {
  return <table className="data">{children}</table>;
}

export function ParticipantCard({ name }: { name: string }) {
  return (
    <div className="ath">
      <div className="avatar" />
      <div className="name">{name}</div>
    </div>
  );
}

export function CategoryFilter(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} />;
}
