import { useState, useMemo, useEffect, useRef } from "react";
import { Dropdown } from "../components/Dropdown";
import { AvatarGrid } from "../components/AvatarGrid";
import { generateStoryboard, fetchAvatars, type Avatar, type Scene, type StoryboardResult, type Template } from "../lib/api";
import { narrativeStyles, moodKeywords, visualStyles } from "./data";
import type { PromptMode, PlatformMode } from "./engine";

// one source of truth for clip length: platform seconds × scene count (matches the per-scene word budget the engine writes to)
const PLATFORM_SEC: Record<PlatformMode, number> = { flow: 8, grok: 6, supergrok: 10 };
const PLATFORMS: { value: PlatformMode; label: string }[] = [
  { value: "flow", label: "🌊 Flow — 8 วิ (20–25 คำ)" },
  { value: "grok", label: "⚡ Grok — 6 วิ (15–18 คำ)" },
  { value: "supergrok", label: "🚀 Super Grok — 10 วิ (25–30 คำ)" },
];
const TEMPLATES: { value: Template; label: string; hint: string }[] = [
  { value: "avatar", label: "🧑‍💼 Avatar พูด", hint: "คนพูด sync ปาก" },
  { value: "full", label: "🎬 Full pipeline", hint: "คน + b-roll + SFX" },
  { value: "no_person", label: "📦 ไม่เห็นคน", hint: "โชว์สินค้า / มือ" },
];
const moodOpts = moodKeywords.map((m) => ({ value: m.id, label: `${m.icon} ${m.name}` }));
const visualOpts = visualStyles.map((v) => ({ value: v.id, label: `${v.icon} ${v.name}${v.category !== "None" ? ` · ${v.category}` : ""}` }));

// the brief is one screen broken into ordered steps — the left rail mirrors these
const STEPS = [
  { id: "fmt", n: 1, label: "รูปแบบคลิป" },
  { id: "what", n: 2, label: "สินค้า & หัวข้อ" },
  { id: "len", n: 3, label: "ความยาว & แพลตฟอร์ม" },
  { id: "tone", n: 4, label: "โทน & สไตล์" },
];

// join every scene's spoken line into one continuous voiceover for the Script column
const dialoguesToScript = (scenes: Scene[]) =>
  scenes.map((s) => s.dialogue).filter(Boolean).join(" ");

export function StoryboardStep({
  images, setImages, template, setTemplate, avatarId, setAvatarId, onZoom, onUse, onSkip,
}: {
  images: File[];
  setImages: (f: File[]) => void;
  template: Template;
  setTemplate: (t: Template) => void;
  avatarId: string | null;
  setAvatarId: (id: string) => void;
  onZoom: (a: Avatar) => void;
  onUse: (script: string, result: StoryboardResult, totalSec: number) => void;
  onSkip: (totalSec: number) => void;
}) {
  // avatar belongs here: choosing the "Avatar พูด" format means choosing who talks, in the same breath
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [avLoading, setAvLoading] = useState(true);
  const [avError, setAvError] = useState(false);
  useEffect(() => { fetchAvatars().then(setAvatars).catch(() => setAvError(true)).finally(() => setAvLoading(false)); }, []);
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
  const [err, setErr] = useState("");          // generation / API failure → shown by the CTA
  const [objErr, setObjErr] = useState("");    // empty-object validation → shown inline at the หัวข้อ field
  const [result, setResult] = useState<StoryboardResult | null>(null);
  const [active, setActive] = useState("fmt");

  // length = single source of truth, derived here and carried into the studio
  const totalSec = PLATFORM_SEC[platform] * sceneCount;

  // product thumbnails — revoked when the list changes
  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  // scroll-spy: highlight the rail step nearest the top of the scroll area
  const sectionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = sectionsRef.current;
    if (!root || busy || result) return;
    const scroller = root.closest(".sb-grid") as HTMLElement | null;
    if (!scroller) return;
    const secs = [...root.querySelectorAll<HTMLElement>("[data-step]")];
    // single deterministic scroll handler (no IO race): active = last section above the 20% line, or the last step at bottom
    const onScroll = () => {
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8) { setActive(STEPS[STEPS.length - 1].id); return; }
      const line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.2;
      let cur = secs[0];
      for (const s of secs) if (s.getBoundingClientRect().top <= line) cur = s;
      if (cur) setActive(cur.dataset.step!);
    };
    onScroll();
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [busy, result]);

  const goto = (id: string) => document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const toggleStyle = (n: number) =>
    setStyleNums((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));

  async function generate() {
    if (!object.trim()) {
      setObjErr("ใส่หัวข้อ / ชื่อสินค้า ก่อน เช่น “เซรั่มวิตามินซี AURA” หรือ “ผักด่ากัน”");
      goto("what");
      document.getElementById("sb-object")?.focus();
      return;
    }
    setObjErr(""); setErr(""); setBusy(true); setResult(null);
    try {
      setResult(await generateStoryboard({
        object: object.trim(), styleNums, moodId, visualStyleId,
        sceneCount, promptMode: mode, platformMode: platform,
        includeTextOverlay: textOverlay, glassSkin,
        noPerson: template === "no_person",
      }));
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  // copy with feedback (✓ คัดลอกแล้ว) + inline expand of the raw prompt
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [openPrompts, setOpenPrompts] = useState<Set<number>>(() => new Set());
  const copy = (t: string, k: string) => {
    navigator.clipboard?.writeText(t);
    setCopiedKey(k);
    setTimeout(() => setCopiedKey((cur) => (cur === k ? null : cur)), 1400);
  };
  const togglePrompt = (n: number) =>
    setOpenPrompts((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  // Full/no_person consume the per-scene prompts → let the user tune them here (Avatar ignores them, stays read-only)
  const promptsEditable = template !== "avatar";
  const editScene = (n: number, field: "image_prompt" | "video_prompt" | "dialogue", value: string) =>
    setResult((r) => (r ? { ...r, scenes: r.scenes.map((s) => (s.scene_number === n ? { ...s, [field]: value } : s)) } : r));
  const styleCount = styleNums.length;

  return (
    <div className={`sb-wrap${busy || result ? " split" : ""}`}>
      <div className="sb-grid">
        {/* ── left: ตั้งโจทย์ (brief) — rail navigator + ordered sections ── */}
        <div className="sb-form">
          <div className="sb-brief">
            {/* step navigator (hidden once generating — the form narrows) */}
            <nav className="sb-rail">
              <div className="sb-rail-h">ตั้งโจทย์</div>
              {STEPS.map((s) => {
                const done =
                  s.id === "fmt" ? (template !== "avatar" || !!avatarId) :
                  s.id === "what" ? object.trim().length > 0 :
                  s.id === "len" ? sceneCount >= 1 :
                  moodId !== "none" || visualStyleId !== "none" || styleNums.length > 0;
                return (
                  <button key={s.id} className={`sb-rail-item${active === s.id ? " on" : ""}${done ? " done" : ""}`} onClick={() => goto(s.id)}>
                    <span className="sb-rail-n">{done ? "✓" : s.n}</span>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* ordered sections */}
            <div className="sb-sections" ref={sectionsRef}>
              <section id="step-fmt" data-step="fmt" className="sb-sec">
                <header className="sb-sec-h"><span className="sb-sec-n">1</span><div><b>รูปแบบคลิป</b><small>กำหนดทั้งหมด — ต้องมีคนพูดไหม · มี b-roll ไหม</small></div></header>
                <div className="sb-templates">
                  {TEMPLATES.map((t) => (
                    <button key={t.value} className={`sb-tpl${template === t.value ? " on" : ""}`} onClick={() => setTemplate(t.value)}>
                      <b>{t.label}</b><small>{t.hint}</small>
                    </button>
                  ))}
                </div>
                {template === "avatar" && (
                  <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
                    <label>เลือก Avatar (พรีเซนเตอร์) {avatarId ? <span className="sb-badge">✓</span> : <span className="hint" style={{ display: "inline" }}>· ต้องเลือกหน้าคนพูด</span>}</label>
                    <AvatarGrid avatars={avatars} loading={avLoading} error={avError} selected={avatarId} onSelect={setAvatarId} onZoom={onZoom} />
                  </div>
                )}
              </section>

              <section id="step-what" data-step="what" className="sb-sec">
                <header className="sb-sec-h"><span className="sb-sec-n">2</span><div><b>สินค้า & หัวข้อ</b><small>สิ่งที่จะขาย + รูปให้ AI เห็นของจริงก่อนร่างบท</small></div></header>
                <div className="field">
                  <label>หัวข้อ / ชื่อสินค้า / ตัวละคร</label>
                  <div className="hint">เช่น “ครีม” · “Hero+Villain หมูหมา” · “ผักด่ากัน” · “เซรั่ม AURA”</div>
                  <textarea id="sb-object" className={`sb-object${objErr ? " err" : ""}`} value={object}
                    onChange={(e) => { setObject(e.target.value); if (objErr) setObjErr(""); }} placeholder="พิมพ์สิ่งที่คุณต้องการ…" />
                  {objErr && <div className="field-err">{objErr}</div>}
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>รูปสินค้า <span className="hint" style={{ display: "inline" }}>(หลายมุม · ไม่บังคับ)</span></label>
                  <label className="drop" htmlFor="sbImg">＋ ลากวาง หรือคลิกเพื่อเลือกรูป</label>
                  <input type="file" id="sbImg" accept="image/*" multiple style={{ display: "none" }}
                    onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ""; setImages([...images, ...f]); }} />
                  {images.length > 0 && (
                    <div className="thumbs">
                      {images.map((_, i) => (
                        <div className="t" key={i}><img src={previews[i]} alt="" /><button onClick={() => setImages(images.filter((_, j) => j !== i))}>✕</button></div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section id="step-len" data-step="len" className="sb-sec">
                <header className="sb-sec-h"><span className="sb-sec-n">3</span><div><b>ความยาว & แพลตฟอร์ม</b><small>กำหนดความยาวคลิปก่อน — บทในสตูดิโอจะยึดเป้านี้</small></div></header>
                <div className="row">
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
                <div className="sb-len">⏱ ความยาวรวม ≈ <b>{totalSec} วิ</b> <span>({PLATFORM_SEC[platform]} วิ × {sceneCount} ฉาก) — ใช้เป็นเป้าความยาวบทในสตูดิโอ</span></div>
              </section>

              <section id="step-tone" data-step="tone" className="sb-sec">
                <header className="sb-sec-h"><span className="sb-sec-n">4</span><div><b>โทน & สไตล์</b><small>ไม่บังคับ — ว่างไว้ = AI เลือกให้อัตโนมัติ</small></div></header>
                <div className="field">
                  <label>โหมด</label>
                  <div className="sb-seg">
                    <button className={mode === "review" ? "on" : ""} onClick={() => setMode("review")}>📦 รีวิวสินค้า (UGC)</button>
                    <button className={mode === "storytelling" ? "on" : ""} onClick={() => setMode("storytelling")}>📚 Story Telling</button>
                  </div>
                </div>
                <div className="row" style={{ marginBottom: 18 }}>
                  <div className="ctl"><label>Mood &amp; Tone</label><Dropdown options={moodOpts} value={moodId} onChange={setMoodId} /></div>
                  <div className="ctl"><label>Visual Style</label><Dropdown options={visualOpts} value={visualStyleId} onChange={setVisualStyleId} /></div>
                </div>
                <div className="field">
                  <label>บุคลิก (Style) {styleCount > 0 ? <span className="sb-badge">{styleCount}</span> : <span className="hint" style={{ display: "inline" }}>· ว่าง = Auto</span>}</label>
                  <div className="sb-pills">
                    {narrativeStyles.filter((s) => s.num > 0).map((s) => (
                      <button key={s.num} title={s.desc} className={`sb-pill${styleNums.includes(s.num) ? " on" : ""}`} onClick={() => toggleStyle(s.num)}>
                        {s.icon} {s.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sb-opts">
                  {mode === "review" && (
                    <label className={`sb-opt${glassSkin ? " on" : ""}`}>
                      <div className="sb-opt-txt">
                        <b>✨ ผิวฉ่ำวาว (Glass skin)</b>
                        <small>ผิวนางแบบฉ่ำวาวเงาแบบเกาหลี · ปิด = ผิวธรรมชาติ</small>
                      </div>
                      <input type="checkbox" checked={glassSkin} onChange={(e) => setGlassSkin(e.target.checked)} />
                      <span className="sb-switch" />
                    </label>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* ── right: the result (only once generating/generated) ── */}
        {(busy || result) && (
        <div className="sb-result">
          {busy && !result && <div className="ph"><div className="spinner" />กำลังให้ AI ร่าง storyboard…</div>}
          {result && (
            <>
              {result.storyboardOverview && <pre className="sb-overview">{result.storyboardOverview}</pre>}
              {promptsEditable && <div className="sb-edit-hint">✎ รูปแบบนี้สร้างภาพ <b>ราย scene</b> — กด ✎ ที่แต่ละ scene เพื่อปรับ image/video prompt เองได้ (นี่คือจุดที่คุมรายละเอียดได้มากกว่า Avatar)</div>}
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
                    <button className={copiedKey === `${s.scene_number}-img` ? "copied" : ""} onClick={() => copy(s.image_prompt, `${s.scene_number}-img`)}>
                      {copiedKey === `${s.scene_number}-img` ? "✓ คัดลอกแล้ว" : "📋 Image Prompt"}
                    </button>
                    <button className={copiedKey === `${s.scene_number}-vid` ? "copied" : ""} onClick={() => copy(s.video_prompt, `${s.scene_number}-vid`)}>
                      {copiedKey === `${s.scene_number}-vid` ? "✓ คัดลอกแล้ว" : "📋 Video Prompt"}
                    </button>
                    <button className="sb-prompt-eye" onClick={() => togglePrompt(s.scene_number)} title={promptsEditable ? "แก้ prompt ราย scene" : "ดู prompt เต็ม"}>
                      {openPrompts.has(s.scene_number) ? "▲" : promptsEditable ? "✎" : "▼"}
                    </button>
                  </div>
                  {openPrompts.has(s.scene_number) && (
                    <div className="sb-prompt-body">
                      <div className="sb-prompt-blk">
                        <span>🖼 Image Prompt {promptsEditable && <i>แก้ได้</i>}</span>
                        {promptsEditable
                          ? <textarea className="sb-prompt-edit" value={s.image_prompt} onChange={(e) => editScene(s.scene_number, "image_prompt", e.target.value)} />
                          : <pre>{s.image_prompt}</pre>}
                      </div>
                      <div className="sb-prompt-blk">
                        <span>🎬 Video Prompt {promptsEditable && <i>แก้ได้</i>}</span>
                        {promptsEditable
                          ? <textarea className="sb-prompt-edit" value={s.video_prompt} onChange={(e) => editScene(s.scene_number, "video_prompt", e.target.value)} />
                          : <pre>{s.video_prompt}</pre>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {result.caption && <div className="sb-meta"><b>Caption</b><p>{result.caption}</p></div>}
              {result.hashtags && <div className="sb-meta"><b>Hashtags</b><p>{result.hashtags}</p></div>}
              <button className="gen" onClick={() => onUse(dialoguesToScript(result.scenes), result, totalSec)}>
                ใช้ storyboard นี้ → เข้าสตูดิโอ
              </button>
            </>
          )}
        </div>
        )}
      </div>

      {/* primary action — sticky at the bottom edge so it's where the eye lands after setting up */}
      {!busy && !result && (
        <div className="sb-bar">
          <div className="sb-bar-inner">
            <div className="sb-bar-len">⏱ ความยาวรวม <b>{totalSec} วิ</b></div>
            {err && <div className="field-err sb-bar-err" title={err}>{err}</div>}
            <button className="sb-skip" onClick={() => onSkip(totalSec)}>ข้าม — พิมพ์สคริปต์เอง →</button>
            <button className="gen" disabled={busy} onClick={generate}>💎 สร้าง Storyboard</button>
          </div>
        </div>
      )}
    </div>
  );
}
