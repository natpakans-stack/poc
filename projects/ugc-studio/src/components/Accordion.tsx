import { useState, type ReactNode } from "react";

// nested sub-session inside a column; collapses independently
export function Accordion({ title, subtitle, defaultOpen = true, children }: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(!defaultOpen);
  return (
    <div className={`acc${collapsed ? " collapsed" : ""}`}>
      <button className="acc-h" type="button" onClick={() => setCollapsed((c) => !c)}>
        <span>{title} {subtitle && <small>{subtitle}</small>}</span>
        <span className="chev">‹</span>
      </button>
      <div className="acc-b">{children}</div>
    </div>
  );
}
