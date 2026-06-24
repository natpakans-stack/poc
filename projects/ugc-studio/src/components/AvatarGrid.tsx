import type { Avatar } from "../lib/api";

export function AvatarGrid({ avatars, loading, error, selected, onSelect, onZoom }: {
  avatars: Avatar[];
  loading: boolean;
  error: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  onZoom: (a: Avatar) => void;
}) {
  if (error) return <div style={{ color: "#ff6b6b", fontSize: 13 }}>โหลด avatar ไม่ได้</div>;
  if (loading) return <div className="ph" style={{ color: "var(--muted)", fontSize: 13 }}>กำลังโหลด avatar…</div>;
  return (
    <div className="avatars">
      {avatars.map((a) => (
        <div
          key={a.id}
          className={`av${selected === a.id ? " sel" : ""}`}
          onClick={() => onSelect(a.id)}
        >
          <button className="zoom" title="ดูรูปใหญ่" onClick={(e) => { e.stopPropagation(); onZoom(a); }}>⤢</button>
          <img src={a.preview_url} alt={a.name} loading="lazy" />
          <div className="nm">{a.name}</div>
        </div>
      ))}
    </div>
  );
}
