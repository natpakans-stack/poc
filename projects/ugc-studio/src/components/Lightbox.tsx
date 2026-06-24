import { useEffect } from "react";

// fullscreen avatar preview; rendered only when src is set, Esc/backdrop/✕ to close
export function Lightbox({ src, name, onClose }: {
  src: string | null;
  name: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!src) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [src, onClose]);

  if (!src) return null;
  return (
    <div className="lightbox open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <button className="lb-x" aria-label="ปิด" onClick={onClose}>✕</button>
      <img src={src} alt={name} />
      <div className="lb-nm">{name}</div>
    </div>
  );
}
