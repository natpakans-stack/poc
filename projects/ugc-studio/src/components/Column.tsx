import { useState, type ReactNode } from "react";

type Variant = "source" | "script" | "output";

// collapsible column; the .col.collapsed class drives the CSS rail + sibling flex-grow
export function Column({ index, title, variant, children }: {
  index: number;
  title: string;
  variant: Variant;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <section className={`col col-${variant}${collapsed ? " collapsed" : ""}`}>
      <button className="col-h" type="button" onClick={() => setCollapsed((c) => !c)}>
        <span className="n">{index}</span>
        <span className="ttl">{title}</span>
        <span className="chev">‹</span>
      </button>
      <div className="col-body">{children}</div>
    </section>
  );
}
