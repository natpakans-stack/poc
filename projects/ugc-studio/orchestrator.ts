// AI Director — OpenAI วาง "shot plan" สำหรับวิดีโอ UGC จากข้อมูลสินค้า + สคริปต์
//
// v1: วางแผนจาก {ชื่อสินค้า, จุดขาย, สคริปต์, จำนวนช็อต} — ยังไม่วิเคราะห์ reference ลึก (v2)
// plan นี้ป้อนต่อให้ Higgsfield (รูปมุม) + ElevenLabs (เสียง) + Remotion (ประกอบ + keyword)
//
// Run standalone: bun --env-file=../.env orchestrator.ts "<product brief>"
//   (.env อยู่ที่ poc/projects/.env — บนขึ้นไปหนึ่งชั้น)

export type ShotType = "product_closeup" | "product_angle" | "presenter_talk";

export type Shot = {
  type: ShotType;
  durationS: number; // ความยาวช็อตนี้ (วินาที)
  line: string; // ประโยคที่พากย์ตอนช็อตนี้ (รวมกันทุกช็อต = สคริปต์เสียง)
  keyword: string; // คำเด้งบนจอตอนช็อตนี้ (สั้น ≤ 4 คำ)
};

export type ShotPlan = {
  hook: string; // ข้อความ hook ขึ้นต้นคลิป
  totalDurationS: number;
  shots: Shot[];
};

const SHOT_TYPES: ShotType[] = ["product_closeup", "product_angle", "presenter_talk"];

function key(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} missing — run with: bun --env-file=../.env`);
  return v;
}

// validate ว่า plan ที่ได้กลับมาใช้งานได้จริง — โยน error ถ้าผิด schema/ช่วงค่า
export function validatePlan(p: any): asserts p is ShotPlan {
  if (!p || typeof p !== "object") throw new Error("plan ไม่ใช่ object");
  if (typeof p.hook !== "string" || !p.hook.trim()) throw new Error("plan.hook ว่าง");
  if (!Array.isArray(p.shots) || p.shots.length === 0) throw new Error("plan.shots ว่าง");
  let sum = 0;
  for (const [i, s] of p.shots.entries()) {
    if (!SHOT_TYPES.includes(s?.type)) throw new Error(`shot[${i}].type ไม่ถูกต้อง: ${s?.type}`);
    if (typeof s.durationS !== "number" || s.durationS <= 0) throw new Error(`shot[${i}].durationS ไม่ถูกต้อง`);
    if (typeof s.line !== "string" || !s.line.trim()) throw new Error(`shot[${i}].line ว่าง`);
    if (typeof s.keyword !== "string" || !s.keyword.trim()) throw new Error(`shot[${i}].keyword ว่าง`);
    sum += s.durationS;
  }
  // totalDurationS ควรตรงกับผลรวมช็อต (เผื่อ AI ใส่มาเพี้ยน — sync ให้)
  if (Math.abs(sum - p.totalDurationS) > 0.5) p.totalDurationS = Math.round(sum);
}

const SYSTEM = `คุณเป็นผู้กำกับวิดีโอ UGC live-selling ภาษาไทยที่เก่งมาก
หน้าที่: วาง "shot plan" สำหรับวิดีโอแนวตั้งสั้น โดยตัดสลับช็อตให้สนุก น่าดู และขายของได้

กฎ:
- ความยาวรวม 15-30 วินาที (อิงตามที่ผู้ใช้กำหนด ถ้าไม่กำหนดใช้ ~20 วิ)
- 5-8 ช็อต แต่ละช็อต 2-5 วินาที สลับ type ให้หลากหลาย
- type ที่ใช้ได้: "product_closeup" (โคลสอัปสินค้า), "product_angle" (สินค้ามุมอื่น), "presenter_talk" (พรีเซนเตอร์พูด)
- เปิดด้วย hook สะดุด ปิดด้วย CTA เร่งให้ซื้อ
- "line" = ประโยคพากย์ตอนช็อตนั้น ภาษาพูดเป็นกันเอง สั้น (≤ 12 คำ) · ทุก line ต่อกันต้องลื่นเป็นสคริปต์เดียว
- "keyword" = คำเด้งบนจอ สั้นมาก (≤ 4 คำ) ดึงมาจากใจความเด่นของ line นั้น
- presenter_talk ควรอยู่ช่วงต้น/กลาง, ปิดท้ายด้วยช็อตสินค้า + CTA

ตอบเป็น JSON เท่านั้น:
{"hook":"...", "totalDurationS":20, "shots":[{"type":"...","durationS":3,"line":"...","keyword":"..."}]}`;

export async function planShots(
  brief: string,
  opts: { totalDurationS?: number; model?: string; noPerson?: boolean } = {},
): Promise<ShotPlan> {
  const target = opts.totalDurationS ?? 20;
  const noPersonNote = opts.noPerson
    ? `\n\nสำคัญ: คลิปนี้ "ห้ามมีคน/พรีเซนเตอร์ในเฟรม" — ใช้เฉพาะ type "product_closeup" และ "product_angle" เท่านั้น (ห้าม "presenter_talk"). line ยังเป็นเสียงพากย์ปกติ.`
    : "";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `ความยาวเป้าหมาย ~${target} วินาที\n\nข้อมูลสินค้า/สคริปต์:\n${brief}${noPersonNote}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const plan = JSON.parse(data.choices[0].message.content);
  validatePlan(plan);
  return plan;
}

// ── self-check: ทดสอบ validatePlan ล้วนๆ ไม่ยิง API (ไม่เปลือง token) ──
if (import.meta.main) {
  const arg = process.argv[2];
  if (arg === "--test" || !arg) {
    const ok: ShotPlan = {
      hook: "หน้าใสใน 7 วัน",
      totalDurationS: 8,
      shots: [
        { type: "product_closeup", durationS: 3, line: "เซรั่มตัวนี้ทาแล้วหน้าใส", keyword: "หน้าใส" },
        { type: "presenter_talk", durationS: 5, line: "ซึมไว ไม่เหนียว กดสั่งเลย", keyword: "กดสั่งเลย" },
      ],
    };
    validatePlan(ok); // ต้องผ่าน
    let threw = false;
    try { validatePlan({ hook: "x", shots: [{ type: "bad", durationS: 1, line: "a", keyword: "b" }] }); }
    catch { threw = true; }
    if (!threw) throw new Error("FAIL: validatePlan ควร reject type ที่ผิด");
    // totalDurationS เพี้ยน → ต้องถูก sync เป็นผลรวม (3+5=8)
    const fix: any = { ...ok, totalDurationS: 99 };
    validatePlan(fix);
    if (fix.totalDurationS !== 8) throw new Error("FAIL: ควร sync totalDurationS เป็น 8");
    console.log("✅ validatePlan self-check ผ่าน");
    if (!arg) console.log('(ยิง API จริง: bun --env-file=../.env orchestrator.ts "ข้อมูลสินค้า...")');
    process.exit(0);
  }
  // ยิง API จริงเมื่อส่ง brief มา
  const plan = await planShots(arg);
  console.log(JSON.stringify(plan, null, 2));
}
