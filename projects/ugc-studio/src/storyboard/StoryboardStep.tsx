import { useState } from "react";
import { Dropdown } from "../components/Dropdown";
import { generateStoryboard, type Scene, type StoryboardResult } from "../lib/api";
import { narrativeStyles, moodKeywords, visualStyles } from "./data";
import type { PromptMode, PlatformMode } from "./engine";

const PLATFORMS: { value: PlatformMode; label: string }[] = [
  { value: "flow", label: "🌊 Flow — 8 วิ (20–25 คำ)" },
  { value: "grok", label: "⚡ Grok — 6 วิ (15–18 คำ)" },
  { value: "supergrok", label: "🚀 Super Grok — 10 วิ (25–30 คำ)" },
];
const moodOpts = moodKeywords.map((m) => ({ value: m.id, label: `${m.icon} ${m.name}` }));
const visualOpts = visualStyles.map((v) => ({ value: v.id, label: `${v.icon} ${v.name}${v.category !== "None" ? ` · ${v.category}` : ""}` }));

// join every scene's spoken line into one continuous voiceover for the Script column
const dialoguesToScript = (scenes: Scene[]) =>
  scenes.map((s) => s.dialogue).filter(Boolean).join(" ");

export function StoryboardStep({ onUse, onSkip }: { onUse: (script: string, result: StoryboardResult) => void; onSkip: () => void }) {
  const [object, setObject] = useState("");
  const [mode, setMode] = useState<PromptMode>("review");
  const [platform, setPlatform] = useState<PlatformMode>("flow");
  const [styleNums, setStyleNums] = useState<number[]>([]);
  const [moodId, setMoodId] = useState("none");
  const [visualStyleId, setVisualStyleId] = useState("none");
  const [sceneCount, setSceneCount] = useState(8);
  const [textOverlay, setTextOverlay] = useState(true);
  const [glassSkin, setGlassSkin] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<StoryboardResult | null>(null);

  const toggleStyle = (n: number) =>
    setStyleNums((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  async function generate() {
    if (!object.trim()) { setErr("ใส่หัวข้อ / ชื่อสินค้า ก่อน เช่น “เซรั่มวิตามินซี AURA” หรือ “ผักด่ากัน”"); return; }
    setErr(""); setBusy(true); setResult(null);
    try {
      setResult(await generateStoryboard({
        object: object.trim(), styleNums, moodId, visualStyleId,
        sceneCount, promptMode: mode, platformMode: platform,
        includeTextOverlay: textOverlay, glassSkin,
      }));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const copy = (t: string) => navigator.clipboard?.writeText(t);

  return (
    <div className="sb-wrap">
      <div className="sb-grid">
        {/* ── left: the brief + picks ── */}
        <div className="sb-form">
          <div className="field">
            <label>หัวข้อ / ชื่อสินค้า / ตัวละคร</label>
            <div className="hint">เช่น “ครีม” · “Hero+Villain หมูหมา” · “ผักด่ากัน” · “เซรั่ม AURA”</div>
            <textarea className="sb-object" value={object} onChange={(e) => setObject(e.target.value)}
              placeholder="พิมพ์สิ่งที่คุณต้องการ…" />
          </div>

          <div className="field">
            <label>โหมด</label>
            <div className="sb-seg">
              <button className={mode === "review" ? "on" : ""} onClick={() => setMode("review")}>📦 รีวิวสินค้า (UGC)</button>
              <button className={mode === "storytelling" ? "on" : ""} onClick={() => setMode("storytelling")}>📚 Story Telling</button>
            </div>
          </div>

          <div className="row" style={{ marginBottom: 22 }}>
            <div className="ctl">
              <label>Platform</label>
              <Dropdown options={PLATFORMS} value={platform} onChange={(v) => setPlatform(v as PlatformMode)} />
            </div>
            <div className="ctl">
              <label>จำนวนฉาก</label>
              <input type="number" min={1} max={40} value={sceneCount}
                onChange={(e) => setSceneCount(Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 1)))} />
            </div>
          </div>

          <div className="row" style={{ marginBottom: 22 }}>
            <div className="ctl">
              <label>Mood &amp; Tone</label>
              <Dropdown options={moodOpts} value={moodId} onChange={setMoodId} />
            </div>
            <div className="ctl">
              <label>Visual Style</label>
              <Dropdown options={visualOpts} value={visualStyleId} onChange={setVisualStyleId} />
            </div>
          </div>

          <div className="field">
            <label>บุคลิก (Style) — เลือกได้หลายอัน · ว่าง = Auto</label>
            <div className="sb-pills">
              {narrativeStyles.filter((s) => s.num > 0).map((s) => (
                <button key={s.num} title={s.desc}
                  className={`sb-pill${styleNums.includes(s.num) ? " on" : ""}`}
                  onClick={() => toggleStyle(s.num)}>
                  {s.icon} {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sb-toggles">
            <label><input type="checkbox" checked={textOverlay} onChange={(e) => setTextOverlay(e.target.checked)} /> Text overlay บนภาพ</label>
            {mode === "review" && <label><input type="checkbox" checked={glassSkin} onChange={(e) => setGlassSkin(e.target.checked)} /> Glass skin</label>}
          </div>

          {err && <div className="hint" style={{ color: "#ff6b6b" }}>{err}</div>}
          <button className="gen" disabled={busy} onClick={generate}>{busy ? "กำลังสร้าง storyboard…" : "💎 สร้าง Storyboard"}</button>
          <button className="sb-skip" onClick={onSkip}>ข้ามขั้นตอนนี้ — พิมพ์สคริปต์เอง →</button>
        </div>

        {/* ── right: the result ── */}
        <div className="sb-result">
          {!result && !busy && <div className="ph">เลือกค่าทางซ้าย แล้วกด “สร้าง Storyboard”<br />ผลลัพธ์ราย scene จะแสดงที่นี่</div>}
          {busy && <div className="ph"><div className="spinner" />กำลังให้ AI ร่าง storyboard…</div>}
          {result && (
            <>
              {result.storyboardOverview && <pre className="sb-overview">{result.storyboardOverview}</pre>}
              {result.scenes.map((s) => (
                <div className="sb-scene" key={s.scene_number}>
                  <div className="sb-scene-h">
                    <b>Scene {s.scene_number}</b> {s.scene_name}
                    {s.tag && <span className="sb-tag">{s.tag}</span>}
                  </div>
                  {s.speaker && <div className="sb-line"><span>🎤 {s.speaker}</span></div>}
                  {s.dialogue && <div className="sb-dialogue">“{s.dialogue}”</div>}
                  {s.action && <div className="sb-action">🎬 {s.action}</div>}
                  <div className="sb-prompts">
                    <button onClick={() => copy(s.image_prompt)} title={s.image_prompt}>📋 Image Prompt</button>
                    <button onClick={() => copy(s.video_prompt)} title={s.video_prompt}>📋 Video Prompt</button>
                  </div>
                </div>
              ))}
              {result.caption && <div className="sb-meta"><b>Caption</b><p>{result.caption}</p></div>}
              {result.hashtags && <div className="sb-meta"><b>Hashtags</b><p>{result.hashtags}</p></div>}
              <button className="gen" onClick={() => onUse(dialoguesToScript(result.scenes), result)}>
                ใช้ storyboard นี้ → ไปสร้างวิดีโอ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
