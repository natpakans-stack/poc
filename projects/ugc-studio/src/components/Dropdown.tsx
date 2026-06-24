import { useState, useEffect, useRef } from "react";

export type Option = { value: string; label: string };

// custom dropdown matching the theme (lime highlight, radius) — replaces native <select>
export function Dropdown({ options, value, onChange }: {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  const sel = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className={`dd${open ? " open" : ""}`} ref={ref}>
      <button type="button" className="dd-btn" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
        <span>{sel?.label}</span>
        <span className="dd-caret">▾</span>
      </button>
      <div className="dd-list">
        {options.map((o) => (
          <div
            key={o.value}
            className={`dd-opt${o.value === value ? " sel" : ""}`}
            onClick={() => { onChange(o.value); setOpen(false); }}
          >
            {o.label}{o.value === value && <span>✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
