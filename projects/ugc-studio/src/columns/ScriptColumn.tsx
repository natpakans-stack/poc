import { useState } from "react";
import { draftScript } from "../lib/api";

const fmt = (s: number) => `0:${String(Math.round(s)).padStart(2, "0")}`;

// split the transcript into ~3s spoken segments, distributing the estimated duration by character count.
// ponytail: estimate only (real timing comes from ElevenLabs char-timestamps at gen) — good enough to verify "what's said when".
type Seg = { start: number; end: number; text: string };
function buildTimeline(text: string, totalSec: number): Seg[] {
  const phrases = text.trim().split(/\s+/).filter(Boolean);
  if (!phrases.length || totalSec <= 0) return [];
  const totalChars = phrases.reduce((a, p) => a + p.length, 0) || 1;
  const secPerChar = totalSec / totalChars;
  const segs: Seg[] = [];
  let cur: string[] = [], curChars = 0, start = 0;
  for (const p of phrases) {
    cur.push(p);
    curChars += p.length;
    if (curChars * secPerChar >= 3) {
      const end = start + curChars * secPerChar;
      segs.push({ start, end, text: cur.join(" ") });
      start = end; cur = []; curChars = 0;
    }
  }
  if (cur.length) segs.push({ start, end: totalSec, text: cur.join(" ") });
  return segs;
}

export function ScriptColumn({ script, setScript, targetSec }: {
  script: string;
  setScript: (s: string) => void;
  targetSec: number;
}) {
  const [brief, setBrief] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState("");

  const estSec = Math.round(script.length / 8); // ไทยพูด ~8 ตัวอักษร/วินาที
  const over = estSec > targetSec;
  const segments = buildTimeline(script, estSec || targetSec);

  async function draft() {
    if (!brief.trim()) { setErr("ใส่ brief สั้นๆ ก่อน เช่น สินค้า + จุดขาย + โปร"); return; }
    setErr("");
    setDrafting(true);
    try {
      setScript(await draftScript(brief.trim(), targetSec));
      setAiOpen(false); // พับ helper ทันที → เห็น transcript เต็มๆ
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>บทพูดในคลิป (transcript)</label>
        <div className="hint">นี่คือสิ่งที่พรีเซนเตอร์จะพูดในคลิป — พิมพ์เอง หรือให้ AI ช่วยร่าง</div>
      </div>

      {/* AI helper — slim, collapsed by default so the transcript stays the hero */}
      <button className={`ai-toggle${aiOpen ? " open" : ""}`} onClick={() => setAiOpen((o) => !o)}>
        ✦ ให้ AI ช่วยร่างจาก brief สั้นๆ <span className="chev">▾</span>
      </button>
      {aiOpen && (
        <div className="brief">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="brief: สินค้า · จุดขาย · โปร — เช่น 'คอนโดริมน้ำ เดอ ลาพีส จรัญ 81 วิวแม่น้ำ ตกแต่งครบ ใกล้ MRT'"
          />
          <button className="ai-btn" disabled={drafting} onClick={draft}>
            {drafting ? "กำลังร่าง…" : "ร่างสคริปต์"}
          </button>
        </div>
      )}
      {err && <div className="hint" style={{ color: "#ff6b6b", marginTop: -4 }}>{err}</div>}

      {/* transcript — the single hero box */}
      <div className="script-wrap">
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="บทที่พรีเซนเตอร์จะพูดในคลิป…"
        />
        <div className="count">
          {script.length} ตัวอักษร · <span className={over ? "over" : ""}>~{estSec} วิ{over ? ` ⚠️ เกิน ${targetSec}` : ""}</span>
        </div>
      </div>

      {/* second-by-second preview — verify what's spoken when before generating voice */}
      <div className="timeline">
        <div className="tl-head">
          ไทม์ไลน์เสียง (ระดับวินาที) <span>ประมาณ — เวลาจริงมาจาก ElevenLabs ตอน gen</span>
        </div>
        <div className="tl-rows">
          {segments.length ? segments.map((s, i) => (
            <div className="tl-row" key={i}>
              <span className="tl-t">{fmt(s.start)}–{fmt(s.end)}</span>
              <span className="tl-x">{s.text}</span>
            </div>
          )) : <div className="tl-empty">พิมพ์บทด้านบน แล้วจะเห็นว่าแต่ละวินาทีพูดอะไร</div>}
        </div>
      </div>
    </>
  );
}
