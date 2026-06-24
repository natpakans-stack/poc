import { Dropdown } from "../components/Dropdown";
import type { Template } from "../lib/api";

export type Settings = { mode: string; aspect: string; duration: string; resolution: string };
export type GenState = {
  phase: "idle" | "sending" | "processing" | "done" | "error";
  videoUrl: string | null;
  statusText: string;
  statusErr: boolean;
};

// single axis: structure (+ implied style) in one dropdown — replaces the old ทรง-cards + Higgsfield "โหมด"
const TEMPLATE_OPTS: { value: Template; label: string }[] = [
  { value: "avatar", label: "🧑‍💼 Avatar พูด — คนพูด sync ปาก" },
  { value: "full", label: "🎬 Full pipeline — คน + b-roll + SFX" },
  { value: "no_person", label: "📦 ไม่เห็นคน — โชว์สินค้า / มือ" },
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
      <div className="ctl" style={{ marginBottom: 14 }}>
        <label>ทรงคลิป</label>
        <Dropdown options={TEMPLATE_OPTS} value={template} onChange={(v) => setTemplate(v as Template)} />
      </div>

      <div className="row">
        <div className="ctl">
          <label>สัดส่วน</label>
          <Dropdown options={ASPECTS} value={settings.aspect} onChange={(v) => set({ aspect: v })} />
        </div>
        <div className="ctl">
          <label>ความยาว (วิ)</label>
          <input
            type="number" value={settings.duration} min={5} max={60}
            onChange={(e) => set({ duration: e.target.value })}
          />
        </div>
      </div>
      <div className="ctl" style={{ marginTop: 12 }}>
        <label>ความละเอียด</label>
        <Dropdown options={RESOLUTIONS} value={settings.resolution} onChange={(v) => set({ resolution: v })} />
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
