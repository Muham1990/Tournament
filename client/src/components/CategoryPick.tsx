import { useEffect, useRef, useState } from "react";

export function CategoryPick({
  label,
  items,
  activeId,
  onPick,
}: {
  label: string;
  items: { id: string; name: string }[];
  activeId?: string;
  onPick: (id: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = items.find((x) => x.id === activeId);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setMenu(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className="cat-pick" ref={ref}>
      <button type="button" className="cat-pick-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu}>
        <span className="cat-pick-ico" aria-hidden>
          <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z" /></svg>
        </span>
        <span className="cat-pick-txt">{active?.name || label}</span>
        <span className="cat-pick-caret">▾</span>
      </button>
      {menu && (
        <div className="cat-pick-menu">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={activeId === it.id ? "on" : ""}
              onClick={() => { onPick(it.id); setMenu(false); }}
            >
              {it.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
