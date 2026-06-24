import { useState } from "react";
import { draftScript } from "../lib/api";

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
    </>
  );
}
