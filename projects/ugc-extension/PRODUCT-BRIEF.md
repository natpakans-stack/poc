# Product Brief — PCS Chrome Extension (Prompt Creator Studio)

> **Codename:** PCS · **รูปทรง:** Chrome Extension (Side Panel) · **branch:** `feat/ugc-extension`
> **ร่างแผน:** 2026-06-29 · **อัปเดตสถานะจริง:** 2026-06-30
> เอกสารนี้สะท้อน **สิ่งที่สร้างจริงแล้ว** (spike ทำงาน end-to-end) ไม่ใช่แค่แผน

---

## 1. TL;DR

Chrome Extension ที่รันใน **Side Panel ข้าง Google Flow** ทำ 3 หน้าที่ต่อกันเป็นสายเดียว:
1. **Scrape** ข้อมูล+รูปสินค้าจากเว็บไหนก็ได้ (passive, หน้าที่ user เปิดเอง)
2. **Gen prompt** ด้วย LLM (DeepSeek/OpenAI) — 5 โหมด (ตัวตน/สินค้า/ซีรีย์/ไวรัล)
3. **Flow executor** — พิมพ์ prompt + ยัดรูป reference + กด generate เข้า Google Flow อัตโนมัติ (CDP)

**ทำไม:** Flow (Veo) ให้คุณภาพวิดีโอ creator ไทยดีสุด แต่ **ไม่มี API** → ใช้ browser automation เป็นสะพาน
**Descope:** ❌ ไม่ดึงคลิป (user โหลดเอง) · ❌ ไม่ตัดต่อ (user ทำเอง) → extension จบที่ "สั่ง generate"

---

## 2. สถาปัตยกรรม (3 ชิ้น)

```
┌─ Side Panel (PCS UI) ─┐   core = อ่าน/เขียน DOM เว็บอื่น
│ 5 แท็บ + cards + Flow  │   ── ขาเข้า: scrape สินค้า (content script, passive)
└───────────┬────────────┘   ── สมอง: LLM gen prompt (background → DeepSeek/OpenAI)
            │                 ── ขาออก: Flow executor (background CDP)
   ┌────────┴─────────┐
   │ background worker │  scraper fetch (CORS-safe) · genLLM · CDP type/click/inject
   └────────┬─────────┘
            ▼
   หน้า Google Flow (CDP: พิมพ์ prompt / ยัดรูป / กด generate / กด + เพิ่มซีน)
            │ → user โหลดคลิป + ตัดต่อเอง (นอก extension)
```

**ไฟล์:** `extension/` — `manifest.json` (MV3) · `sidepanel.html/js` (UI + injected scraper/probe) · `background.js` (fetch/CDP/LLM) · `fonts/` (Anuphan vendored) · `extract.test.ts`

---

## 3. 5 โหมด (UI ตาม PCS จริง — ref `REF-PCS-real.md`)

| แท็บ | ทำอะไร | input หลัก |
|---|---|---|
| **ตัวตน** | gen prompt ครีเอเตอร์ไทย (ตัวตนเดียวหลายชุด) | ชื่อ · เพศ · โทนผิว · ธีม 17 · รายละเอียด · จำนวนชุด |
| **สินค้า** | scrape สินค้า → gen prompt รีวิว | [scraper] + มุมขาย 5 · จำนวนชุด |
| **ซีรีย์** | ซีรีย์ตัวเอกเดิมต่อเนื่องหลายฉาก | แนว 10 · จำนวนฉาก · ตัวละคร · เนื้อเรื่อง |
| **ไวรัล** 🆕 | ใส่เอฟเฟกต์ไวรัล (แนว Higgsfield) | หัวข้อ + เอฟเฟกต์ 21 แบบ (Earth Zoom/Free Fall/Night Vision…) |
| **ตั้งค่า** | LLM provider/key/model + ภาษาพากย์ | OpenAI / DeepSeek (v4-flash) |

**gen → cards:** ทุกโหมดออกเป็น cards (label + video_prompt อังกฤษ แก้ได้ + บทไทย) → ป้อน Flow
**shared ใต้ทุกโหมด (ยกเว้นตั้งค่า):** cards · ปุ่ม Auto · Flow executor

---

## 4. สิ่งที่พิสูจน์แล้ว (spike ทำงานจริง)

| ส่วน | สถานะ |
|---|---|
| **Scrape ทุกเว็บ** | ✅ Shopee(API) · matchazuki/ihavecpu/bnn/Lazada/LnwShop/bewell/homepro/ofm/ergotrend/mercular (JSON-LD) · SPA/Next (__NEXT_DATA__/dom-scan) · ที่เหลือกรอกเอง (editable) |
| **ดึงรูปทั้งหน้า + เลือกรูป** | ✅ gatherAllImages + image picker |
| **ดึงรีวิว** | ✅ Shopee get_ratings |
| **Flow: พิมพ์ prompt** | ✅ CDP trusted keystroke (Lexical รับ → ปุ่ม Create เปิด) |
| **Flow: ยัดรูป reference** | ✅ bg fetch → DataTransfer → file input (หลายรูป) |
| **Flow: กด generate** | ✅ CDP click ปุ่ม arrow_forward (ตัดปุ่ม + ทิ้ง) |
| **Auto scene-queue** | ⚠️ สร้างแล้ว — done-detection ยัง blind ต้องเทสสด/จูน |

**กลไกสำคัญ:** passive content script บนหน้าที่ user เปิดเอง → ผ่าน anti-bot (Shopee/Lazada/Kinokuniya WAF) ที่ block automated navigation

---

## 5. เทคนิค/ความเสี่ยงที่เหลือ

- **Flow DOM เปราะ** — locate by-text/by-role (ทน sc-* classes เปลี่ยน) แต่ Google เปลี่ยนหน้าใหญ่ = ต้องอัปเดต
- **CDP โชว์แถบ debugging** — trade-off ที่ต้องยอม (Lexical รับเฉพาะ trusted input)
- **ToS Google** — automate Flow อาจผิดเงื่อนไข ต้องเช็คก่อน scale
- **done-detection** auto-queue ยังไม่จูนกับ DOM จริงตอน generate→เสร็จ
- **prompt quality** — system prompt 5 โหมดเขียนเอง (ไม่มี PCS source) ต้องจูนหลังเทส

---

## 6. ต่างจาก PCS จริง (ยังไม่ align — รอบหน้า)

| | PCS จริง (afforrai v2.1.1) | spike เรา |
|---|---|---|
| theme | **dark** | light (ค้าง: reskin dark) |
| LLM | DeepSeek v4-flash | ✅ รองรับแล้ว (OpenAI/DeepSeek) |
| โหมด | ตัวตน/สินค้า/ซีรีย์ | ✅ + **ไวรัล** (เพิ่มใหม่) |
| executor (พิมพ์/ยัดรูป/generate เข้า Flow) | ❌ ไม่มี (คนทำเอง) | ✅ **จุดที่เราเติมให้** |
| scraper | ❌ กรอกมือ | ✅ auto ทุกเว็บ |
| license (Machine ID) | มี | ค้าง |

> **คุณค่าที่ spike เพิ่ม:** PCS เดิม gen prompt แล้วคนไปวาง Flow เอง — เราทำ **scraper + executor** ที่ PCS ไม่มี

---

## 7. UI/Design ที่ทำแล้ว

- 5 แท็บ Side Panel (~360px) · light theme · accent ส้ม
- **ไม่ใช้ emoji เลย (กฏเหล็ก)** → Lucide SVG line icons ทั้งหมด (vendored, ไม่ต้อง build)
- **Custom dropdown** เอง (ไม่ใช้ native select ของ system)
- ฟอนต์ **Anuphan** (vendored woff2, latin+thai) — *กำลัง apply*
- ช่องสินค้า ชื่อ/ราคา/desc แก้ไขได้ (ไม่ตันแม้ scrape ไม่ครบ)

---

## 8. ค้าง / รอบหน้า
1. reskin **dark theme** ให้ตรง PCS จริง
2. apply ฟอนต์ Anuphan (ไฟล์โหลดแล้ว รอ inline @font-face)
3. จูน **auto-queue done-detection** กับ DOM Flow จริง
4. จูน **system prompt 5 โหมด** หลังเทสผลจริง
5. License system (ถ้าจะ ship)

---

## Carry-over / อ้างอิง
- `REF-PCS-real.md` — spec PCS จริง 4 แท็บ (จาก screenshots)
- หลักตัดต่อเดิม (UGC Studio): balance · transition อย่าบ่อย · ประมาณวิพูด ~8s/Veo
- engine 40-narrative "One Click One Story" = **อยู่บนเว็บ 1click1story.com เท่านั้น** (ไม่มี source ในมือ — rebuild เอง)
