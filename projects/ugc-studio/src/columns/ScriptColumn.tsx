import { useState } from "react";
import { draftScript } from "../lib/api";

export function ScriptColumn({ script, setScript, targetSec }: {
  script: string;
  setScript: (s: string) => void;
  targetSec: number;
}) {
  const [brief, setBrief] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState("");

  const estSec = Math.round(script.length / 8); // ไทยพูด ~8 ตัวอักษร/วินาที
  const over = estSec > targetSec;

  async function draft() {
    if (!brief.trim()) { setErr("ใส่ brief สั้นๆ ก่อน เช่น ชื่อสินค้า + จุดขาย + โปร"); return; }
    setErr("");
    setDrafting(true);
    try {
      setScript(await draftScript(brief.trim()));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>สคริปต์ที่ให้ Avatar พูด</label>
        <div className="hint">เขียนเอง หรือให้ AI ร่างจาก brief สั้นๆ</div>
      </div>

      <div className="brief">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="brief: สินค้าอะไร · จุดขาย · โปรโมชัน — เช่น 'เซรั่มวิตซี AURA ลดจุดด่างดำ ซึมไว ลดเฉพาะไลฟ์'"
        />
        <button className="ai-btn" disabled={drafting} onClick={draft}>
          {drafting ? "กำลังร่าง…" : "✦ ให้ AI ร่างสคริปต์"}
        </button>
      </div>
      {err && <div className="hint" style={{ color: "#ff6b6b", marginTop: -8 }}>{err}</div>}

      <div className="script-wrap">
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="สวัสดีค่าทุกคน วันนี้มารีวิว..."
        />
        <div className="count">
          {script.length} ตัวอักษร · <span className={over ? "over" : ""}>~{estSec} วิ{over ? ` ⚠️ เกิน ${targetSec}` : ""}</span>
        </div>
      </div>
    </>
  );
}
