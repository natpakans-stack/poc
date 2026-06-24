import { Dropdown } from "../components/Dropdown";
import type { Template } from "../lib/api";

export type Settings = { mode: string; aspect: string; duration: string; resolution: string };

const TEMPLATES: { value: Template; ic: string; t: string; d: string }[] = [
  { value: "avatar", ic: "🧑‍💼", t: "Avatar พูด", d: "คนพูด sync ปาก" },
  { value: "full", ic: "🎬", t: "Full pipeline", d: "คน+b-roll+SFX" },
  { value: "no_person", ic: "📦", t: "ไม่เห็นคน", d: "สินค้า/มือ" },
];
export type GenState = {
  phase: "idle" | "sending" | "processing" | "done" | "error";
  videoUrl: string | null;
  statusText: string;
  statusErr: boolean;
};

const MODES = [
  { value: "product_review", label: "Product Review" },
  { value: "ugc", label: "UGC" },
  { value: "ugc_unboxing", label: "Unboxing" },
  { value: "product_showcase", label: "Showcase" },
  { value: "tv_spot", label: "TV Spot" },
];
const ASPECTS = [
  { value: "9:16", label: "9:16 (แนวตั้ง)" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
];
const RESOLUTIONS = [
  { value: "720p", label: "720p" },
  { value: "480p", label: "480p" },
  { value: "1080p", label: "1080p" },
];

function Stage({ gen }: { gen: GenState }) {
  if (gen.phase === "done" && gen.videoUrl)
    return <video src={gen.videoUrl} controls autoPlay loop playsInline />;
  if (gen.phase === "sending" || gen.phase === "processing")
    return (
      <div className="frame">
        <div style={{ textAlign: "center" }}>
          <div className="spinner" />
          <div style={{ color: "var(--muted)", fontSize: 13 }}>
            {gen.phase === "sending" ? "กำลังส่งงาน…" : "กำลังสร้างวิดีโอ…"}
          </div>
        </div>
      </div>
    );
  if (gen.phase === "error")
    return <div className="ph" style={{ color: "#ff6b6b" }}>❌ {gen.statusText}</div>;
  return <div className="ph">กรอกข้อมูล แล้วกด “สร้างวิดีโอ”<br />วิดีโอจะแสดงที่นี่</div>;
}

export function OutputColumn({ settings, setSettings, template, setTemplate, gen, onGenerate, onEdit }: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  template: Template;
  setTemplate: (t: Template) => void;
  gen: GenState;
  onGenerate: () => void;
  onEdit: () => void;
}) {
  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });
  const busy = gen.phase === "sending" || gen.phase === "processing";

  return (
    <>
      <span className="tpl-label">ทรงคลิป</span>
      <div className="tpl-grid">
        {TEMPLATES.map((t) => (
          <div key={t.value} className={`tpl${template === t.value ? " sel" : ""}`} onClick={() => setTemplate(t.value)}>
            <div className="ic">{t.ic}</div>
            <div className="t">{t.t}</div>
            <div className="d">{t.d}</div>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="ctl">
          <label>โหมด</label>
          <Dropdown options={MODES} value={settings.mode} onChange={(v) => set({ mode: v })} />
        </div>
        <div className="ctl">
          <label>สัดส่วน</label>
          <Dropdown options={ASPECTS} value={settings.aspect} onChange={(v) => set({ aspect: v })} />
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <div className="ctl">
          <label>ความยาว (วิ)</label>
          <input
            type="number" value={settings.duration} min={5} max={30}
            onChange={(e) => set({ duration: e.target.value })}
          />
        </div>
        <div className="ctl">
          <label>ความละเอียด</label>
          <Dropdown options={RESOLUTIONS} value={settings.resolution} onChange={(v) => set({ resolution: v })} />
        </div>
      </div>

      <button className="gen" disabled={busy} onClick={onGenerate}>สร้างวิดีโอ</button>

      <div className="stage"><Stage gen={gen} /></div>
      <div className={`status${gen.statusErr ? " err" : ""}`}>{gen.statusText}</div>
      {gen.phase === "done" && (
        <button className="edit-btn" onClick={onEdit}>✎ แก้บน Remotion timeline</button>
      )}
    </>
  );
}
