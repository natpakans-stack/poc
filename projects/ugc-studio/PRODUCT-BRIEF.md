# Product Brief — UGC Studio (เครื่องมือผลิตวิดีโอ UGC)

> **สถานะ:** draft v0.2 · อัปเดตตาม brief จากคุณ (รอบ 2)
> ⚠️ = จุดที่ยังไม่ชัด รอคุณยืนยัน

---

## 1. ภาพรวม

เครื่องมือ **ผลิตวิดีโอ UGC ขายของ** จากรูปสินค้า — รันเป็น **view/หน้าเดียวบน localhost ใช้ในทีมก่อน**
หน้าตาแบบ **NotebookLM 3 คอลัมน์** แต่ flow เป็น **setup → generate** (ไม่ใช่แชทเป็นหลัก)

**แก่น = ผลิตวิดีโอ** (ข้อ ก เดิม) — ไม่ทำ live-assist / Takra Insight ในรอบนี้

**Flow รวม:**
```
อัปรูปสินค้า + วิดีโอ reference (ซ้าย)
  → Higgsfield แตกรูป → ภาพมุมต่างๆ 4-5 ภาพ (กลาง)
  → gen สคริปต์ขายของ ตาม bullet/keyword ที่ user คุม (กลาง)
  → ตั้งค่า output (ขนาด/ความยาว/ชื่อ) → กด Generate (ขวา)
  → วิดีโอ UGC .mp4
```

---

## 2. ปัญหา & ผู้ใช้

- **ผู้ใช้:** ทีม Real Factory (ใช้ภายในก่อน)
- **ปัญหา:** ผลิตวิดีโอขายของช้า/แพง ต้องจ้างถ่าย-ตัดต่อ
- **คุณค่า:** อัปรูปสินค้า → ได้วิดีโอ UGC พร้อมใช้ในไม่กี่นาที

---

## 3. เลย์เอาต์ 3 คอลัมน์

### คอลัมน์ซ้าย — Source (ตั้งต้น)
แยกเป็น 2 section ชัดเจน:
1. **รูปสินค้า** — อัปได้หลายรูป (ใช้เป็นวัตถุดิบ gen)
2. **วิดีโอ reference** — อัปคลิปตัวอย่างไว้เป็นแนวทางการตัดต่อ/สไตล์

### คอลัมน์กลาง — Workspace (ไม่ใช่ chat — เป็น Script Editor)
2 ส่วน:
1. **ภาพมุมต่างๆ (Higgsfield)** — เลือกรูปสินค้า 1-2 รูป → gen ภาพหลายมุม ~4-5 ภาพ เตรียมไว้ประกอบวิดีโอ
2. **Script Editor** — AI gen สคริปต์ขายของจากรูปที่อัป แล้ว user แก้/คุมได้ในช่อง input:
   - **3 bullets** — แต่ละคลิปพูดถึงประเด็นอะไรบ้าง
   - **keyword** — คำที่อยากให้ปรากฏ
   - **มาร์กคำที่อยากเน้น** บนสคริปต์จริง — คำที่มาร์กนี้ส่งต่อให้ ElevenLabs ผลิตเสียงเน้นถูกจุด
     ⚠️ หลังบ้านยังไม่ฟิกซ์ — ElevenLabs ทำ word-level emphasis ได้ผ่าน SSML/พารามิเตอร์ตัวไหน ต้องเช็คตอน build

**Output ของคอลัมน์นี้:** สคริปต์ + คำเน้น → ElevenLabs (เสียง) → เอาไป match กับวิดีโอ Higgsfield (lip-sync)

### คอลัมน์ขวา — Output Settings + Generate
- ขนาดวิดีโอ (เช่น 9:16 / 1:1 / 16:9)
- ความยาววิดีโอ — **ทั้งคลิป ~15-30 วินาที** (เอาช็อต Higgsfield หลายช็อตมาต่อกันให้ได้ความยาวนี้)
- ชื่อ Final Product
- **ปุ่ม "Generate Final Product"** → render วิดีโอออกมา

---

## 4. AI Pipeline (ของเดิม + ปรับตาม flow ใหม่)

```
รูปสินค้า
  → Higgsfield     แตกภาพมุมต่างๆ 4-5 ภาพ (ใหม่: ขั้นนี้มาก่อน)
  → OpenAI         เขียนสคริปต์ขายของไทย (คุมด้วย bullet/keyword/คำเน้น)
  → ElevenLabs     สคริปต์ → เสียงพากย์ไทย + timestamp ทุกคำ
  → Higgsfield     วิดีโอพรีเซนเตอร์ ปากขยับตรงเสียง (lip-sync)
  → Remotion       ประกอบ ภาพ+วิดีโอ+เสียง+แคปชั่น → .mp4 (ตามขนาด/ความยาวที่ตั้ง)
```

**ข้อจำกัดเทคนิค:** browser อย่างเดียวไม่พอ —
- OpenAI / ElevenLabs → เรียกจาก browser ได้ (แต่ key โผล่)
- Higgsfield (CLI) + Remotion render → **ต้องมี server** ในเครื่อง
- ดังนั้นมี **Bun server ตัวเล็กหลังบ้าน** ซ่อน key (.env) + รัน Higgsfield/Remotion

---

## 5. Tech Stack

อยากได้แบบ **component-based** (เหมือน Vue/React) — ใช้ **React** แต่ **ไม่ลง Vite/Vue** เพราะ Bun bundle ให้ในตัว
ได้ component แยกไฟล์ + HMR + CSS bundling ครบ โดยไม่เพิ่ม dependency

```
index.html  → import frontend.tsx (React root)
                ├─ <SourcePanel/>      คอลัมน์ซ้าย
                ├─ <Workspace/>        คอลัมน์กลาง (ภาพมุม + Script Editor)
                └─ <OutputSettings/>   คอลัมน์ขวา
server.ts   → Bun.serve() เสิร์ฟ index.html + API
                (Higgsfield CLI · Remotion render · ซ่อน API key ใน .env)
```

- รันทั้ง frontend + backend ด้วย `bun --hot ./server.ts` คำสั่งเดียว (DX แบบ Vite ไม่มี dep เพิ่ม)
- ไม่ scaffold Next ทั้งโปรเจกต์

---

## 6. ของที่มีอยู่แล้ว (reuse ได้)

| ของ | สถานะ |
|---|---|
| `ugc-studio/` UI + `server.ts` (เรียก Higgsfield) | ใช้งานได้ |
| `pipeline.ts` (OpenAI → ElevenLabs → captions) | เซ็ตอัปไว้ ยังไม่รัน gen |
| `remotion/` compositor (caption/hook → mp4) | render เดโมผ่านแล้ว |
| วิดีโอเดโม AURA serum | ใช้เป็น test input |

---

## 7. Technical findings (เช็คจากโค้ด + CLI แล้ว)

- **Higgsfield แตกรูปมุมต่างๆ** ✅ ทำได้ — โมเดล `nano_banana_2` (Nano Banana Pro): `input_images` + prompt → รูปสินค้ามุมใหม่ (CLI พร้อมใช้ใน `server.ts`)
- **ElevenLabs เน้นรายคำ** ⚠️ ได้บางส่วน — `eleven_multilingual_v2` ไม่รองรับเน้นรายคำผ่าน SSML (มีแค่ `<break>`)
  → "มาร์กคำเน้น" เหมาะกับ **ไฮไลต์บนแคปชั่น** เป็นหลัก · ถ้าต้องเน้นเสียงจริงต้องใช้พิมพ์ใหญ่/วรรคตอน หรือย้ายไป `eleven_v3`

---

## 8. หน้าที่ของแต่ละเครื่องมือ (Higgsfield ≠ Remotion — คนละงาน ทำต่อกัน)

| เครื่องมือ | หน้าที่ |
|---|---|
| **Higgsfield** | *สร้าง* ฟุตเทจดิบ AI — คลิปพรีเซนเตอร์พูด + ภาพสินค้ามุมต่างๆ (nano_banana) |
| **ElevenLabs** | เสียงพากย์ไทย + **timestamp ทุกคำ** (กุญแจของ keyword sync) |
| **Remotion** | *ตัดต่อ* — ตัดสลับช็อต, keyword เด้งตรงคำพูด, ซูม/effect → final .mp4 |

**Output เป้าหมาย:** วิดีโอ UGC ตัดสนุก มี keyword เด้งบนจอตรงที่ speaker พูด (ตาม reference)

### ✅ เลือก "ทาง B" — เสียงจาก ElevenLabs
เพราะ keyword sync ต้องใช้ timestamp ทุกคำ ซึ่ง ElevenLabs `with-timestamps` ให้มาฟรี (Higgsfield ต้องเพิ่มขั้น Whisper)

**lip-sync (จุดยากสุด) → v1 เลี่ยง:** ตัดสลับช็อตพรีเซนเตอร์กับช็อตสินค้า — ตอนโชว์สินค้าไม่เห็นปาก lip-sync ไม่สำคัญ
v1 พึ่ง เสียงพากย์ + ภาพสินค้า + keyword เป็นหลัก, พรีเซนเตอร์เป็น accent

```
รูปสินค้า → Higgsfield(nano_banana) แตกภาพมุมต่างๆ
สคริปต์   → ElevenLabs เสียงไทย + timestamp
พรีเซนเตอร์ → Higgsfield คลิปพูด (ใช้เป็น accent)
ทั้งหมด   → Remotion ตัดต่อ + keyword sync → final.mp4
```

---

## 8.5 คอลัมน์กลาง = AI Director / Orchestrator (OpenAI วางแผน)

ไม่ใช่แค่กรอกฟอร์ม — OpenAI ทำหน้าที่ "ผู้กำกับ" วางแผนการผลิตเป็น **shot plan** แล้วสั่งทรัพยากรเอง:

```
อัป product + reference
  → OpenAI วาง shot plan (JSON): ต้องใช้ภาพกี่ช็อต/วิดีโอกี่คลิป แต่ละช็อตยาว+keyword อะไร
  → loop ตาม plan: ยิง Higgsfield (รูป/คลิป) + ElevenLabs (เสียงต่อ line)
  → Remotion ประกอบตาม plan + keyword timing → final.mp4
```

ตัวอย่าง plan:
```json
{ "shots": [
  { "type": "product_closeup", "durationS": 3, "keyword": "หน้าใส" },
  { "type": "presenter_talk",   "durationS": 4, "line": "ทาแล้วซึมไว" },
  { "type": "product_angle",    "durationS": 2, "keyword": "ลดจุดด่างดำ" }
]}
```

🔑 **ข้อจำกัด:** OpenAI ดูวิดีโอ native ไม่ได้ — ต้อง ffmpeg ดึงเฟรม + Whisper transcribe เสียง reference ก่อนป้อนให้ GPT-4o vision

**แบ่ง 2 เฟส (เลี่ยงเดิมพันส่วนยากสุดก่อน):**
- **v1** — orchestrator วาง plan จาก รูปสินค้า + สคริปต์ + จำนวนช็อต (reference ใช้แค่กำหนดสไตล์/อารมณ์) → พิสูจน์ทั้ง chain
- **v2** — เพิ่ม "ดู reference จริง" (เฟรม + Whisper) ให้ plan เลียนจังหวะตัดของ reference

---

## 9. สรุปที่เคลียร์แล้ว

1. ✅ แก่น = ผลิตวิดีโอ UGC (ตัด live-assist)
2. ✅ flow = setup → generate (กลาง = Script Editor ไม่ใช่ chat)
3. ✅ ความยาวคลิป ~15-30 วิ
4. ✅ stack = React (component) + Bun bundler ไม่ใช้ Vite
5. ✅ รอบแรก = ต่อ API จริงเลย
6. ✅ เสียง = ElevenLabs (ทาง B) · ตัดต่อ+keyword = Remotion · lip-sync เลี่ยงใน v1

---

*แก้ตรงไหนได้เลย หรือบอกเป็นข้อๆ เดี๋ยวอัปเดตให้ตรง แล้วค่อยเริ่ม build*
