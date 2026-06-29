import { Dropdown } from "../components/Dropdown";
import type { Template, Engine } from "../lib/api";

const ENGINE_LABEL: Record<Engine, string> = { higgsfield: "🟢 Higgsfield", flow: "🔵 Google Flow" };

export type Settings = { mode: string; aspect: string; duration: string; resolution: string };
export type GenState = {
  phase: "idle" | "sending" | "processing" | "done" | "error";
  videoUrl: string | null;
  statusText: string;
  statusErr: boolean;
  kind?: "hf" | "pipeline"; // pipeline outputs are Remotion compositions → editable in Studio
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

export function OutputColumn({ settings, template, engine, setSettings, sceneCount, scriptStale, gen, onGenerate, onEdit, onBack }: {
  settings: Settings;
  setSettings: (s: Settings) => void;
  template: Template;
  engine: Engine;
  sceneCount?: number; // from the kept storyboard result — proof it's not discarded
  scriptStale?: boolean; // script edited after this render started → result is for the OLD script
  gen: GenState;
  onGenerate: () => void;
  onEdit: () => void;
  onBack: () => void; // baked-in settings change only by going back to ตั้งโจทย์
}) {
  const set = (patch: Partial<Settings>) => setSettings({ ...settings, ...patch });
  const busy = gen.phase === "sending" || gen.phase === "processing";
  const templateLabel = TEMPLATE_OPTS.find((t) => t.value === template)?.label ?? template;
  const aspectLabel = ASPECTS.find((a) => a.value === settings.aspect)?.label ?? settings.aspect;

  return (
    <>
      {/* baked at ตั้งโจทย์ → locked recap (editing here would desync the generated prompts) */}
      <div className="recap">
        <div className="recap-h"><span>ตั้งไว้ที่ “ตั้งโจทย์”</span><button className="link-btn" onClick={onBack}>← แก้</button></div>
        <div className="recap-row"><span>รูปแบบคลิป</span><b>{templateLabel}</b></div>
        <div className="recap-row"><span>Engine</span><b>{ENGINE_LABEL[engine]}</b></div>
        <div className="recap-row"><span>สัดส่วน</span><b>{aspectLabel}</b></div>
        <div className="recap-row"><span>ความยาว</span><b>{settings.duration} วิ <i>{sceneCount ? "≈ จากบท" : "จาก platform×ฉาก"}</i></b></div>
        {!!sceneCount && <div className="recap-row"><span>Storyboard</span><b>{sceneCount} ฉาก → pipeline</b></div>}
      </div>

      {/* render-only knob — doesn't touch the prompts, safe to set here */}
      <div className="ctl" style={{ marginTop: 14 }}>
        <label>ความละเอียด <span className="ctl-note">ตั้งได้ที่นี่ — ไม่กระทบ prompt</span></label>
        <Dropdown options={RESOLUTIONS} value={settings.resolution} onChange={(v) => set({ resolution: v })} />
      </div>

      {scriptStale && (
        <div className="stale-warn">⚠️ บทถูกแก้หลังเริ่มสร้าง — วิดีโอ{busy ? "ที่กำลังสร้างนี้" : "นี้"}ยังเป็นบทเดิม{busy ? " (กดสร้างใหม่ได้เมื่อเสร็จ)" : ""}</div>
      )}
      <button className={`gen${scriptStale && !busy ? " regen" : ""}`} disabled={busy} onClick={onGenerate}>
        {busy ? "กำลังสร้าง…" : scriptStale ? "🔄 สร้างใหม่ (บทเปลี่ยน)" : "สร้างวิดีโอ"}
      </button>

      <div className="stage"><Stage gen={gen} /></div>
      <div className={`status${gen.statusErr ? " err" : ""}`}>{gen.statusText}</div>
      {gen.phase === "done" && gen.kind === "pipeline" && (
        <button className="edit-btn" onClick={onEdit}>🎬 เปิดใน Remotion — ปรับจังหวะคลิป + เสียง</button>
      )}
    </>
  );
}
