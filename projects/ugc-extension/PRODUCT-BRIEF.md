# Product Brief — UGC Studio: Chrome Extension (Side Panel)

> **Codename:** Prompt Creator Studio (PCS)
> **เวอร์ชันในภาพ:** UGC 9:16 · v2.1.1
> **สถานะ:** Pivot จาก UGC Studio (web app) → Chrome Extension
> **วันที่ร่าง:** 2026-06-29 · **ปรับ scope:** 2026-06-29 (descope: ไม่ดึงคลิป / ไม่ตัดต่อ)

---

## 1. TL;DR (อ่านบรรทัดเดียวจบ)

ย้าย UGC Studio จาก **web app ที่เรียก engine Higgsfield ตรงๆ** มาเป็น **Chrome Extension ที่รันใน Side Panel ข้าง Google Flow** — extension ทำ 3 อย่าง: **(1) scrape สินค้า → (2) gen storyboard/prompt → (3) auto-feed prompt เข้า Flow + กด generate** ส่วน **โหลดคลิป + ตัดต่อ = user ทำเอง** (Flow มีปุ่มโหลดอยู่แล้ว) เหตุผล: Flow ให้คุณภาพวิดีโอ content creator ไทยดีที่สุด แต่ **ไม่มี API** — เลยใช้ browser เป็นสะพานแทน

> **Scope ใหม่ (2026-06-29):** ❌ ไม่ดึงคลิปออกจาก Flow (user โหลดเอง) · ❌ ไม่ตัดต่อ/post-process (user ทำเอง) → extension จบที่ **"ป้อน prompt + สั่ง generate"** เท่านั้น เบาลงมาก ตัดความเสี่ยงหนักทิ้ง 2 ข้อ

---

## ★ Key Features (2 เสาหลัก)

### 🅰 Product Scraper → สารตั้งต้นวิดีโอ
ดึง **ข้อมูล + รูปสินค้าจริง** จาก Shopee/Lazada/เว็บใดก็ได้ มาเป็นวัตถุดิบ gen วิดีโอ
- วาง URL / เปิดหน้าสินค้าค้าง → ได้ ชื่อ, รูปจริง, ราคา, สเปก
- รูปจริง = reference ให้ avatar ถือ/โชว์ → วิดีโอตรงสินค้า ไม่ใช่ของมั่ว
- จบที่ **"วางลิงก์ → ได้วิดีโอรีวิว"** ผู้ใช้ไม่ต้องพิมพ์ข้อมูลสินค้าเอง
- *(รายละเอียด §7.2)*

### 🅱 Content Variety → regroup "One Click One Story"
เพิ่มความหลากหลายของ content ที่ทำได้ โดยต่อยอด engine **One Click One Story** ที่มีอยู่แล้ว
- engine เดิมตอบโจทย์ได้ระดับหนึ่ง → **เอามาจัด grouping ใหม่ให้ UX ใช้ง่ายขึ้น**
- ให้ผู้ใช้เลือก "ประเภท content / มุมเล่าเรื่อง" ได้หลากหลายในที่เดียว ไม่ตันอยู่ทรงเดียว
- *(ต้องเก็บ requirement: One Click One Story มี story type/มุมอะไรบ้าง → จัดกลุ่มยังไงให้เข้าใจง่าย — ดู §7.5)*

> เสา 🅰 = "วัตถุดิบดี" · เสา 🅱 = "เล่าได้หลายทรง" — สองอันนี้คือสิ่งที่ทำให้ extension เหนือกว่าแค่ automate Flow เฉยๆ

---

## 2. ทำไมต้อง pivot (Background)

| | เดิม | ใหม่ |
|---|---|---|
| **รูปทรง** | Web app (Bun + React) | Chrome Extension (Side Panel) |
| **Engine** | Higgsfield (`nano_banana → seedance → Remotion`) | Google Flow (ผ่าน browser automation) |
| **เชื่อมต่อ** | เรียก API ตรง | DOM automation (Flow ไม่มี API) |
| **โหลดคลิป** | auto จาก API | **user โหลดเองจาก Flow** (ไม่ดึง) |
| **ตัดต่อ** | Remotion ฝั่ง server | **user ทำเอง** (ตัด scope ออก) |

**ปมที่ทำให้เปลี่ยน:**
1. **Higgsfield ไม่เหมาะกับ content creator ไทย** — โทน/หน้า/การเคลื่อนไหวไม่เป็นธรรมชาติพอสำหรับตลาดไทย (จาก POC วันนี้)
2. **Google Flow ตอบโจทย์สุด** — คุณภาพวิดีโอดีกว่าชัดเจน
3. **แต่ Flow ไม่มี API** — เชื่อมเข้าระบบเราตรงๆ ไม่ได้ → ทางออกเดียวคือ "นั่งข้าง Flow แล้วคุมมันผ่านหน้าเว็บ"
4. **Side Panel** = ที่ที่ extension ปักหมุดค้างข้างจอได้ (Chrome 114+) ไม่ใช่ popup กดแล้วหาย → เหมาะกับ workflow ที่ต้องเปิดค้างคุม Flow ทั้ง session

---

## 3. Problem Statement

> Content creator ไทย (และทีมผลิต UGC) อยากได้วิดีโอ avatar/รีวิวสินค้าคุณภาพสูงในภาษา/หน้าตาแบบไทย แต่:
> - Engine ที่เชื่อม API ได้ (Higgsfield) คุณภาพไม่ถึง
> - Engine ที่คุณภาพถึง (Google Flow) เชื่อมระบบไม่ได้ ต้องนั่งพิมพ์ prompt ทีละอัน กด generate ทีละคลิป โหลดทีละไฟล์ แล้วเอาไปตัดต่อเองอีกที — ช้า น่าเบื่อ ทำซ้ำเยอะ ทำชุดยาว/หลายตอนแทบไม่ไหว

**สิ่งที่ extension เข้ามาแก้:** เป็นชั้น orchestration ที่ครอบ Flow ไว้ — ผู้ใช้กรอกข้อมูล (ตัวตน/สินค้า/ซีรีย์) ครั้งเดียว extension จัดการ scrape + gen prompt + ป้อน Flow + สั่ง generate รัวๆ ทีละตอน (โหลด+ตัดต่อ user ทำเอง)

---

## 4. กลุ่มผู้ใช้ (Target Users)

- **หลัก:** ทีมผลิต content / agency ที่ปั้น UGC ปริมาณมาก (กลุ่มเดิมของ UGC Studio)
- **รอง:** content creator เดี่ยว / personal branding ที่อยากได้วิดีโอ avatar พูดไทยเป็นชุดยาว
- **บริบทการใช้:** เปิด Chrome ค้าง → ปัก Side Panel ข้าง Flow → ทำงานเป็น session (สร้างทีละชุด/ซีรีย์)

---

## 5. Goals & Non-Goals

**Goals**
- ลดเวลาจาก "ไอเดีย → สั่ง generate ครบทุกตอน" ให้เหลือ "กรอกครั้งเดียว แล้วปล่อยให้ป้อน Flow รัวๆ"
- ใช้คุณภาพของ Google Flow โดยผู้ใช้ไม่ต้องนั่งพิมพ์ prompt เอง
- ทำงานเป็น **ชุด/ซีรีย์** ได้ (batch) ไม่ใช่ทีละคลิป

**Non-Goals (ตอนนี้)**
- ❌ **ไม่ดึงคลิปออกจาก Flow** — user กดโหลดเองจาก Flow (Flow มีปุ่มอยู่แล้ว)
- ❌ **ไม่ตัดต่อ/รวมคลิป/ใส่เพลง-ซับ** — user ทำเองนอก extension
- ไม่ทำ engine generate วิดีโอเอง (พึ่ง Flow)
- ไม่รองรับทุก platform เบราว์เซอร์ — เอา Chrome ก่อน
- ไม่ทำ collaboration/multi-user/cloud sync ใน MVP
- ไม่รับประกันความเสถียรถ้า Google เปลี่ยนหน้า Flow (ดู §10 ความเสี่ยง)

---

## 6. โครงสร้างภาพรวม (Architecture)

```
┌─────────────────────── Chrome ───────────────────────┐
│                                                        │
│   ┌── Tab: Google Flow ──┐   ┌─ Side Panel (PCS) ──┐  │
│   │                      │   │  ตัวตน │ สินค้า │ ... │  │
│   │   (หน้าเว็บ Flow)     │◄──┤  - กรอก brief        │  │
│   │                      │   │  - scrape สินค้า      │  │
│   │   content script ───►│   │  - gen prompt        │  │
│   │   พิมพ์ prompt        │◄──┤  - คุมคิว ป้อนทีละตอน  │  │
│   │   กด generate        │   │  - ติดตามสถานะ        │  │
│   └──────────┬───────────┘   └─────────────────────┘  │
│              │ user กดโหลดคลิปเอง + ตัดต่อเอง (นอก ext) │
└──────────────┴─────────────────────────────────────────┘
```

**ความสามารถแกนเดียว ใช้ 2 ทาง:** extension อยู่บน Chrome → core คือ **"อ่าน/เขียน DOM ของเว็บอื่น"**
- **ขาเข้า (scrape):** ดึงข้อมูลสินค้าจาก Shopee / Lazada / เว็บใดก็ได้ → ชื่อ, รูป, ราคา, รายละเอียด
- **ขาออก (automate):** ป้อน prompt + กด generate บน Google Flow (ไม่อ่านผลกลับ)

**3 ชิ้นส่วนหลัก** *(เหลือ 3 หลัง descope — ตัด post-processor ทิ้ง)*
1. **Side Panel UI** — หน้าจอหลักที่ผู้ใช้เห็น (ตามภาพ) จัดการ input + คิว + สถานะ
2. **Scraper Engine** (content script ฝั่งเว็บค้าขาย) — ดึง ชื่อ/รูป/ราคา/สเปก จากหน้าสินค้า → เป็น resource ป้อน prompt
3. **Flow Automator** (content script ฝั่ง Flow) — ตัว "มือ" ที่พิมพ์ prompt + กด generate + ติดตามว่าตอนนี้เสร็จยัง (เพื่อป้อนตอนถัดไป) — **ไม่ดึงไฟล์วิดีโอ**
> ~~Post-processor~~ ตัดทิ้ง — user โหลด+ตัดต่อเอง

---

## 6.5 โหมด Generate (ฐานคิดของทุกแท็บ)

> field ในแต่ละแท็บ = ผลพลอยได้ของ "เครื่องทำอะไรได้บ้าง" → แตกเป็น 4 แกนอิสระ การ์ดเดียวจบ 1 วิดีโอ = เลือกครบ 4 แกน

| แกน | คำถาม | ตัวเลือก (มาจาก engine จริง) | อยู่แท็บ |
|---|---|---|---|
| **WHO** ใครเล่า | นำเสนอด้วยอะไร | ① Human Avatar (คนพูด lip-sync) · ② Object-as-Character (ของพูดได้ 3D — engine auto-detect จากหัวข้อ) · ③ No person (เห็นแต่สินค้า/มือ) | **ตัวตน** |
| **WHAT** เรื่องอะไร | พูดถึงอะไร | ① สินค้าจริง (scrape มา) · ② หัวข้อ/คอนเซ็ปต์ (พิมพ์เอง สำหรับ storytelling) · ③ คู่ตัวละคร (hero/villain) | **สินค้า** |
| **HOW** เล่ายังไง | ทรง content | promptMode (review/storytelling) × narrative style(s) × mood × visual style × scene arc → = **"สูตร content" เสา 🅱** | **ซีรีย์** |
| **HOW MUCH** เท่าไหร่ | กี่คลิป/กี่ฉาก | 1 คลิป · multi-angle (หลายมุมจากของชิ้นเดียว) · เรื่องยาวหลายตอน × ฉาก 1–40 | **ซีรีย์** |

**Template (avatar/full/no_person) = ผลของ WHO:** avatar→คนพูด · full→คน+b-roll+SFX · no_person→โชว์สินค้า
**Engine ปลายทาง = Flow เสมอ** (ยุบ grok/supergrok ทิ้ง) → ความยาว/ฉากปรับตาม Flow 8s

## 7. Feature Scope (ตาม Tab ในภาพ)

Side Panel มี 4 แท็บหลัก (ตามภาพ): **ตัวตน · สินค้า · ซีรีย์ · ตั้งค่า**

### 7.1 แท็บ "ตัวตน" (Identity / Avatar) — *โหมดสร้างตัวตน*
สร้างคาแรกเตอร์ครีเอเตอร์ไทยสำหรับเล่าเรื่อง/personal branding
- **ชื่อ / คาแรกเตอร์** — เช่น ครูพิม, นักธุรกิจสาว, เซฟหนุ่ม
- **จำนวนชุด** — (ภาพ: 10)
- **เพศ / ตัวแบบ** — เช่น ผู้หญิงไทย
- **สุ่มภาพจากคลังพร้อมของฉัน** — toggle ใช้ภาพ reference จริง (ไม่ใช้ AI), เร็วกว่า / หน้าไม่ซ้ำ / เพศตามที่เลือก
- **โทนสีผิว** — เช่น ผิวขาวออร่า (เน็ตไอดอล)
- **เสียง (การพากย์+ลาก)** — สุ่ม/ตามที่กรอกเอง
- **รายละเอียดเพิ่มเติม** (ระบบจำช่องนี้ก่อนเสมอ) — เช่น อายุ 30 ยุคลิปอบอุ่น เฉดสีน้ำตาล ขอบสุดเรื่อง

> 🔑 **Carry-over จากของเดิม:** PRESENTER_LOCK (ล็อกเพศ/หน้าให้ตรง avatar ที่เลือก) + voice mapping ตามเพศ — ต้องส่งต่อมา shape เป็น prompt ที่ป้อน Flow

### 7.2 แท็บ "สินค้า" (Product) — *ขับด้วย Scraper Engine*
ข้อมูลสินค้าที่จะให้ avatar รีวิว/พูดถึง โดย **ไม่ต้องกรอกเอง** — วาง URL สินค้า (Shopee/Lazada/ฯลฯ) แล้ว extension scrape ให้
- **Input:** วาง URL หน้าสินค้า หรือเปิดหน้าสินค้าค้างไว้แล้วกด "ดึงข้อมูล"
- **Scrape ออกมา:** ชื่อสินค้า, รูป (หลายรูป), ราคา, รายละเอียด/สเปก, รีวิว (ถ้ามี)
- **กลายเป็น resource:** ป้อนเข้าระบบสร้าง prompt → ภาพ → วิดีโอ ได้ทันที (รูปสินค้า = reference จริงให้ avatar ถือ/โชว์)
- **ขาออก:** prompt ที่ระบบ gen → วางลง Google Flow ของผู้ใช้เองอัตโนมัติ

> ทำให้ flow เป็น **"วางลิงก์สินค้า → ได้วิดีโอรีวิว"** — ผู้ใช้ไม่ต้องพิมพ์รายละเอียดสินค้าเอง
> ⚠️ แต่ละ marketplace โครงหน้าต่างกัน → ต้องมี adapter ต่อเว็บ (ดู §10)

**3 โหมด WHAT (ไม่ใช่แค่ scrape):**
- **สินค้าจริง (scrape)** — เคสหลัก ตามบน
- **พิมพ์เอง** — หัวข้อ/คอนเซ็ปต์ สำหรับสาย storytelling ที่ไม่มีสินค้า
- **คู่ตัวละคร (hero/villain)** — ป้อนคู่ตัวละคร สำหรับ narrative สายดราม่า/แฟนตาซี
> engine **auto-detect** เอง: ถ้า subject เป็นอาหาร/ของ/อวัยวะ → สลับเป็น Object-as-Character (3D ของพูดได้) อัตโนมัติ

### 7.3 แท็บ "ซีรีย์" (Series) — *= HOW + HOW MUCH = ที่อยู่ของเสา 🅱*

**ตีความ "Series" (เดิมไม่ชัด):** คือ "**ผลิตหลายคลิปจาก setup เดียว**" (ตัวตน+สินค้าเดิม) — หัวใจที่ทำให้ extension คุ้มกว่ายิงทีละคลิป มี 3 โหมด:

| โหมด | คือ | ใช้ engine ส่วนไหน |
|---|---|---|
| **Single** | 1 คลิป 1 สูตร | เลือก narrative 1 ตัว |
| **Multi-angle** ⭐ | สินค้าเดียว → หลายมุมเล่า (เช่น 5 คลิป: Hard Sell / Skeptic / ASMR / Unboxer / FOMO) ลง A/B test / ยิงรัวแคมเปญ | `styleNums[]` multi-select |
| **Episodic** | เรื่องยาวต่อเนื่องหลายตอน | long-form batch (gen 10 ฉาก → พิมพ์ต่อ) |

**Field ในแท็บ:**
- **เลือกสูตร content (เสา 🅱):** เลือกจาก **เป้าหมาย/หมวด** ก่อน (รีวิวขายของ / เล่าเรื่องแบรนด์ / สายมู / ดราม่า / กูรู…) → preset narrative+mood+visual ให้ — ไม่ใช่จิ้ม dropdown 40×50×49 เอง
- **โหมดซีรีย์:** Single / Multi-angle / Episodic (+ จำนวนคลิป)
- **ฉากต่อคลิป:** 1–40 (default ตามความยาว Flow)
- **Advanced (พับไว้):** เลือก narrative หลายตัวเอง · override mood · override visual style · dialect (อีสาน/เหนือ/ใต้) · ASMR mode · text overlay

### 7.4 แท็บ "ตั้งค่า" (Settings) — *global config, ตั้งครั้งเดียวใช้ทุกงาน*
- **เชื่อม Flow:** สถานะการต่อ Google Flow (tab ไหน / login แล้วยัง) — make-or-break
- **Output:** อัตราส่วน 9:16, mapping ความยาว→จำนวนฉาก, เพลง/ซับ default
- **Compliance:** เปิด/ปิด ตัวกรองคำต้องห้าม อย. (FDA word filter) + violence filter
- **API/บัญชี:** LLM key (Gemini/อื่น) สำหรับ gen prompt, บัญชีผู้ใช้
- **Default สไตล์:** mood / visual style / glass-skin ตั้งต้น (override รายงานได้ในแท็บซีรีย์)

### 7.5 Content Variety (ต่อยอด One Click One Story) — *เสาหลัก 🅱*
เพิ่มความหลากหลายของ content โดยนำ engine **One Click One Story** ที่มีอยู่มา **regroup ใหม่**
- engine เดิม gen story/content ได้หลายแบบอยู่แล้ว แต่ UX ยังเข้าถึงยาก
- **งานหลัก = จัดกลุ่ม + ออกแบบ UX การเลือก** ให้ผู้ใช้เห็นว่าทำ content ทรงไหนได้บ้าง แล้วเลือกง่าย
- น่าจะอยู่เป็น layer เลือก "ประเภท/มุมเล่าเรื่อง" ก่อนเข้า pipeline (คาบเกี่ยวกับแท็บ ซีรีย์)
- **ต้องเก็บก่อน design:** One Click One Story รองรับ story type / มุม / รูปแบบอะไรบ้าง → จัดเป็นกี่กลุ่ม ตั้งชื่อยังไงให้คนเข้าใจ

> *หมายเหตุ: แท็บ ซีรีย์ / ตั้งค่า ในภาพยังไม่เปิดเนื้อหา — เก็บ requirement เพิ่มตอนลงรายละเอียด design*

#### 📋 Requirement capture — One Click One Story (`1click1story.com`)
**สถานะ:** engine ถูก **port มาไว้แล้ว** ที่ `ugc-studio/src/storyboard/` (`data.ts` = คลังตัวเลือก, `prompts.ts` = system prompt 561 บรรทัด, `engine.ts` = input/output types, `parse.ts`, `StoryboardStep.tsx`)
**ทำอะไร:** gen **storyboard + prompt ต่อฉาก** (ขับด้วย LLM) → output = text prompt อย่างเดียว (image prompt + video prompt ต่อฉาก + dialogue ไทย + caption + hashtags) → เอาไปวาง Flow/Grok เอง **ไม่ render media เอง**

**แกนความหลากหลายที่มีจริง (จาก `data.ts`):**

| แกน | จำนวน | โครงสร้าง |
|---|---|---|
| **Narrative Style** (มุมเล่าเรื่อง) | **40 + Auto** | multi-select ได้ (เช่น `1+5+8`), `0`=Auto · 20 ตัวแรกจัดหมวด A/B/C/D แล้ว · 21–40 ยังไม่จัดกลุ่ม |
| **Mood & Tone** (บรรยากาศภาพ) | **50 + none** | 3 กลุ่ม: Core 20 · 🇹🇭 สายไทย 10 · 🌍 Viral/TikTok 10 |
| **Visual / Art Style** | **~49** | มี `category` แล้ว: Mainstream/Craft/Nostalgia/Artistic/Digital/Unique/Thai&Asian/Trendy/Advanced3D |
| **Scene arc** (`sceneTemplates`) | 8 beat | Hook→ปัญหา→เปิดตัว→สาธิต→ผล→Social Proof→**SELL**→**CLOSE** (ฉาก 7–8 ฮาร์ดเป็น sell/close) |
| **Prompt Mode** | 2 | `review` (UGC คนจริง) · `storytelling` |
| **Template** (รูปคลิป) | 3 | `avatar` (คนพูด lip-sync) · `full` (คน+b-roll+SFX) · `no_person` (เห็นแต่สินค้า/มือ) |
| **Platform/Engine** | 3 | flow 8s · grok 6s · supergrok 10s → **ตัวเรายุบเหลือ flow** |
| **จำนวนฉาก** | 1–40 | + long-form batch ("100 ซีน → gen 10 แล้วพิมพ์ต่อ") |
| อื่นๆ | — | dialect ไทย (อีสาน/เหนือ/ใต้), ASMR no-dialogue, text overlay, glass-skin, Avatar picker (PRESENTER_LOCK), แนบรูปสินค้า/hero–villain |

**Narrative Style 40 ตัว (หมวด A–D จัดแล้ว, 21–40 ยังลอย):**
- **A นักขายจอมขยี้:** Hard Sell·Soft Sell·Unboxer·Skeptic·FOMO
- **B ละคร&สตอรี่:** Villain vs Hero·Tough Love·Tsundere·The Nag·Drama Queen
- **C แฟนตาซีหลุดโลก:** Talking Object·Organ War·Pet Translator·Time Traveler·God vs Devil
- **D กูรูผู้รู้จริง:** The Geek·Myth Buster·Q&A Expert·News Anchor·Trends Hunter
- **21–40 (ยังไม่จัดกลุ่ม):** De-influencer·Fortune Teller(มู)·ASMR Seller·Over-Sharer·Main Character·Investigator·Isan Joy·Southern·Northern·Sassy Queen·Gossiper·Self-Made·Prankster Couple·Underdog·Voiceover Troll·Fangirl·Local Guru·Mindset Coach·Satirist·Glutton

**Logic ที่ฝังใน prompt:** auto-detect ตัวเอก (ถ้าหัวข้อเป็นอาหาร/ของ/อวัยวะ → บังคับเป็น **3D object-as-character**) · forbidden-words list (อย.ไทย + แทนคำเลี่ยง) · violence filter เลี่ยง AI censor · carry หลักตัดต่อเดิม (balance / transition อย่าบ่อย / ประมาณวิพูด)

**ปัญหา UX เดิม (= โจทย์เสา 🅱):** 40 narrative × 50 mood × 49 visual เป็น dropdown แบนๆ → คนใหม่งง เลือกมั่ว ผลไม่นิ่ง
**ทิศ regroup:** เลือกจาก **เป้าหมาย/สูตร** ก่อน (เช่น "รีวิวขายของ", "เล่าเรื่องแบรนด์", "สายมู", "ดราม่า") → preset narrative+mood+visual+ฉากให้ แล้วค่อยเปิด advanced จูนเอง · จัดหมวด 21–40 + ทำ "content type layer" ที่เป็นมิตร

**ยังขาด:** จะจัดเป็นกี่ "สูตร/content type" · ตั้งชื่อหมวดยังไงให้คนเข้าใจ · สูตรไหนคู่กับ template (avatar/full/no_person) อะไร → **ออกแบบใน §7.6**

### 7.6 🅱 Content Grouping — ออกแบบ (ร่าง v1)

**โครง UX = progressive disclosure 3 ชั้น** (เลือกง่าย→ลึกได้)

```
L1  สูตรสำเร็จ (8 สูตร, ตามเป้าหมายธุรกิจ)   ← คนใหม่จิ้มจบ ทุกอย่าง preset
      └─ "ปรับเอง" ▼
L2  เลือกตามเป้าหมาย (6 หมวด narrative) + mood/visual แบบจัดกลุ่ม   ← คนกลาง
      └─ "ทั้งหมด" ▼
L3  Advanced — multi-select เต็ม 40 narrative / 50 mood / 49 visual   ← power user
```

#### L1 — 8 สูตรสำเร็จ (ตามเป้าหมายธุรกิจ)
แต่ละสูตร = preset ครบ (template + promptMode + narrative + mood + visual + โหมดซีรีย์)

| สูตร | เป้าหมายธุรกิจ | WHO/Template | narrative (default) | mood | visual | ซีรีย์ |
|---|---|---|---|---|---|---|
| 🔥 **ขายตรง ปิดการขาย** | ยิงแอด/เร่งซื้อ | no_person / avatar | Hard Sell + FOMO | UGC Raw | Real Cinematic | Multi-angle |
| 🤝 **รีวิวน่าเชื่อถือ** | สร้างความเชื่อใจก่อนขาย | avatar | Skeptic + Myth Buster | Bright & Airy | Real Cinematic | Single |
| 📦 **แกะกล่อง/พรีวิว** | โชว์ของจริง | no_person | The Unboxer | Minimalist Clean | Real Cinematic | Single |
| 🦄 **ของพูดได้ ไวรัล** | จำง่าย แชร์เยอะ | object-as-character | Talking Object / Pet Translator | Pastel Dreamy | Disney/Pixar 3D | Multi-angle |
| 🎭 **ดราม่าสะกดอารมณ์** | เล่าเรื่องแบรนด์/before-after | avatar / full | Villain vs Hero / Drama Queen | Cinematic Standard | Real Cinematic | Episodic |
| 🔮 **สายมูเตลูไทยๆ** | ตลาดไทย สายมู | avatar | Fortune Teller | Mutelu Mystical | Thai Temple Mural | Single |
| 💅 **ครีเอเตอร์ตัวแม่** | personal branding | avatar | Main Character / Sassy Queen | Old Money | Real Cinematic | Episodic |
| 🧓 **ไทยท้องถิ่นเข้าถึงง่าย** | ตลาดต่างจังหวัด | avatar | Isan Joy / Northern Chill | Local Homey | Thai Retro Poster | Single |

#### L2 — 6 หมวด narrative (ยัด 40 ตัวครบ ตาม "เจตนา")
*หมวด A–D เดิมถูกหลอมใหม่ตามเจตนา + เก็บ 21–40 เข้าครบ*

| หมวด | เจตนา | narrative (เลขเดิม) |
|---|---|---|
| 🔥 **สายขาย** (6) | กระตุ้นซื้อ | Hard Sell·Soft Sell·Unboxer·FOMO·Trends Hunter·Self-Made |
| 🤝 **สายน่าเชื่อถือ** (8) | พิสูจน์/ให้ความรู้ | Skeptic·Geek·Myth Buster·Q&A Expert·News Anchor·De-influencer·Investigator·Mindset Coach |
| 🎭 **สายดราม่า** (7) | ดึงอารมณ์ | Villain vs Hero·Tough Love·Tsundere·The Nag·Drama Queen·Prankster Couple·Underdog |
| 🦄 **สายหลุดโลก** (7) | แปลก/ไวรัล | Talking Object·Organ War·Pet Translator·Time Traveler·God vs Devil·Voiceover Troll·Satirist |
| 💅 **สายตัวตน/ไลฟ์สไตล์** (7) | คาแรกเตอร์เด่น | ASMR Seller·Over-Sharer·Main Character·Sassy Queen·Gossiper·Fangirl·Glutton |
| 🇹🇭 **สายไทย/ท้องถิ่น+มู** (5) | กลิ่นไทย เข้าถึง | Fortune Teller·Isan Joy·Southern·Northern·Local Guru |

> รวม 40 ครบ (6+8+7+7+7+5) · แต่ละตัวมีบ้านเดียว (mutually exclusive) ไม่ซ้ำ

#### L3 — Advanced
เปิดลิสต์เต็ม 40/50/49 (multi-select narrative `1+5+8`, override mood/visual) + dialect + ASMR + text overlay — ใช้หมวด L2 เป็นหัวข้อ section ในลิสต์

**เหตุผลออกแบบ (designer rationale):**
- **L1 ตามเป้าหมายธุรกิจ ไม่ใช่ตามสไตล์** — คนคิดเป็น "ฉันจะขายของ" ไม่ใช่ "ฉันอยากได้ Tsundere" → ลด cognitive load
- **mutually exclusive** — narrative 1 ตัว 1 บ้าน กันงงตอน scan
- **ชื่อหมวดเป็นภาษาคน** (สายขาย/สายมู) ไม่ใช่ jargon (Salesperson/Mystic)
- 21–40 ที่เคยลอย ตอนนี้มีบ้านครบ

**ยังต้องเคาะ (รอ design/POC):**
- ชื่อ + ไอคอน + ลำดับการ์ด L1 (8 สูตร) บน Side Panel แคบ (~360px) — layout จริง
- mood/visual default ต่อสูตร ยืนยันกับผลเรนเดอร์จริง (ตอนนี้เดาจาก vibe)
- สูตร "ดราม่า/ครีเอเตอร์" = Episodic → ต้องนิยาม flow หลายตอนให้ชัด

---

## 8. Pipeline ใหม่ (หลัง descope — สั้นลงมาก)

```
[scrape] วาง URL สินค้า → ดึง ชื่อ/รูป/ราคา/สเปก จาก Shopee/Lazada/ฯลฯ
   │
กรอก brief (ตัวตน/สินค้า*/ซีรีย์)   *สินค้ามาจาก scrape
   └─► สร้าง prompt ต่อตอน (carry PRESENTER_LOCK + voice rules + ข้อมูลสินค้าจริง)
        └─► [automation] ป้อน Flow → กด generate → รอเสร็จ → ป้อนตอนถัดไป (วน)
─────────────────────── จบหน้าที่ extension ───────────────────────
   ▼ (user ทำเองนอก extension)
user กดโหลดคลิปจาก Flow + ตัดต่อ/ลงโซเชียลเอง
```

> extension จบที่ "สั่ง generate ครบทุกตอน" — ไม่แตะไฟล์วิดีโอเลย

---

## 9. ประเด็นเทคนิคที่ต้องตัดสินใจ (Critical)

> หลัง descope เหลือความเสี่ยงจริง **2 ข้อ** (เดิม 4) — ตัด "ดึงคลิป" + "ตัดต่อ client" ทิ้ง

### 9.1 Browser Automation บน Flow — เปราะ *(ความเสี่ยงหลักที่เหลือ)*
- ป้อน prompt/กดปุ่ม/อ่านสถานะ = ผูกกับ DOM ของ Flow → **Google เปลี่ยนหน้าเมื่อไหร่ พังเมื่อนั้น**
- ต้องออกแบบ selector ให้ทนทาน + มี fail-state ที่ผู้ใช้เข้าใจ ("Flow เปลี่ยนหน้า รอ update")
- **ToS risk:** automate ผลิตภัณฑ์ Google อาจผิดเงื่อนไข/โดนตรวจจับ → ต้องเช็คก่อนลงทุนหนัก
- *เบาลงกว่าเดิม:* แค่ "เขียน" (พิมพ์+กด) + อ่านสถานะเสร็จ/ไม่เสร็จ — ไม่ต้อง "ดึงไฟล์" ออกมา

### 9.2 Scrape Shopee/Lazada — ต้องทำให้ได้ *(spike แล้ว 2026-06-29)*

**🧪 ผล spike (เปิด Shopee จริงผ่าน automation):**
- automated navigation → Shopee **เด้งเข้า anti-bot** ทันที (`/verify/traffic/error?...is_logged_in=false&type=4`) ไม่ถึงหน้าสินค้า
- **logic แกะข้อมูล = ถูก** (แกะ `shop_id/item_id` จาก URL ได้, endpoint `/api/v4/pdp/get_pc?item_id=&shop_id=` ถูก, parse meta/og/JSON-LD พร้อม) → **ปัญหาอยู่ที่ "เข้าถึง" ไม่ใช่ "แกะ"**

**บทสรุป:** กำแพงคือ bot-fingerprint ของ automation context — **ห้าม** ให้ extension auto-navigate เปิดหน้า Shopee เอง

**Design ที่ถูก (บังคับ):**
- content script ทำงาน **passive** บนหน้าที่ **user เปิดเอง** ใน profile จริงที่ login อยู่ → user เลื่อนมาหน้าสินค้าตามปกติ แล้วกดปุ่ม "ดึงข้อมูล" ใน Side Panel
- ❌ ไม่ auto-navigate · ❌ ไม่ fetch headless · ❌ ไม่ solve captcha (ผิด ToS + ข้อห้าม)
- ดึงจาก DOM ที่ render แล้ว / og-meta / `__INITIAL_STATE__` ของหน้า — ไม่ยิง API เองถ้าเสี่ยงโดนจับ
- **fallback กรอกมือ** ต้องมีเสมอ (เผื่อ user ไม่เปิดหน้า / โครงเปลี่ยน)
- แต่ละ marketplace โครงต่างกัน → adapter ต่อเว็บ (เริ่ม 1–2 เจ้า)

**ยังพิสูจน์ไม่จบ:** test harness เองคือ automation เลยโดนจับ — ต้องลองจริงด้วย **content script ใน Chrome ปกติของ user** (โหลด unpacked extension) ว่า passive DOM read บนหน้าที่ user เปิดเอง ผ่าน anti-bot ไหม → **spike รอบ 2 ต้องทำใน extension จริง ไม่ใช่ MCP**

### ~~9.3 ดึงวิดีโอออกจาก Flow~~ — **ตัดทิ้ง** (user โหลดเอง)
### ~~9.4 ตัดต่อ client-side~~ — **ตัดทิ้ง** (user ตัดเอง)

---

## 10. ความเสี่ยง & คำถามเปิด

| ความเสี่ยง | ผลกระทบ | แนวทาง |
|---|---|---|
| Flow เปลี่ยน DOM | automation พังทั้งระบบ | selector ทนทาน + แจ้ง fail ชัด + อัปเดตเร็ว |
| แต่ละ marketplace โครงหน้าต่างกัน + เปลี่ยนบ่อย | scrape ไม่ได้/ได้ผิด | adapter ต่อเว็บ (เริ่ม 1–2 เจ้า) + fallback ให้กรอกมือ |
| Shopee/Lazada กัน scrape (bot/login) | ดึงข้อมูลไม่ได้ | ใช้ content script ในหน้าที่ user เปิด/login เอง (เนียนกว่า fetch ตรง) |
| ผิด ToS Google | โดนแบน/ปิดทาง | เช็คเงื่อนไขก่อน scale |
| Flow มี rate limit/queue เอง | batch ช้า/ติด | คุมจังหวะส่งงาน + retry |
| ~~ตัดต่อ client หนัก~~ · ~~ดึงคลิปไม่ได้~~ | — | **ตัดทิ้งแล้ว** (user ทำเอง) |

**คำถามเปิดที่ยังต้องเคาะ:**
- ผูกกับ Google account ผู้ใช้เอง หรือบัญชีกลาง?
- คิว: extension รู้ได้ไง "ตอนนี้ generate เสร็จแล้ว" จาก DOM Flow → ค่อยป้อนตอนถัดไป (ส่วนหนึ่งของ spike §9.1)

---

## 11. MVP Scope (เสนอ — หลัง descope)

**เข้า MVP**
1. **Spike ก่อน (พิสูจน์ feasibility):** (ก) content script ป้อน prompt + กด generate บน Flow ได้ + รู้ว่าเสร็จเมื่อไหร่ · (ข) scrape ชื่อ/รูป/ราคา จาก Shopee/Lazada จริงได้
2. Side Panel UI แท็บ "ตัวตน" + "สินค้า" (scrape) ครบ
3. gen prompt จาก storyboard engine (มีอยู่แล้ว) → ป้อน Flow ทีละตอน (Single ก่อน)

**ไว้ทีหลัง**
- Batch ซีรีย์ Multi-angle/Episodic เต็ม, §7.6 grouping L1/L2/L3 ครบ, adapter marketplace เพิ่ม, ระบบคิวขั้นสูง

> *Ponytail note:* product เบาลงมากหลังตัด "ดึงคลิป + ตัดต่อ" — เหลือแกน "scrape + gen prompt + ป้อน Flow" ก่อนสร้าง UI สวยทั้ง 4 แท็บ ให้ spike 2 ข้อใน §11.1 ผ่านก่อน (อันที่เหลือเสี่ยงสุด) อย่าเพิ่งลงทุนส่วนอื่น

---

## 12. Success Metrics

- **เวลา:** จาก "กรอกเสร็จ" → "สั่ง generate ครบทุกตอนใน Flow" < X นาที โดยผู้ใช้ไม่ต้องพิมพ์ prompt เอง
- **อัตราสำเร็จ batch:** % ตอนที่ป้อน Flow + กด generate สำเร็จโดยไม่ต้องแก้มือ
- **Scrape:** % หน้าสินค้าที่ดึง ชื่อ/รูป/ราคา ครบถูกต้อง
- **คุณภาพ:** วิดีโอ content creator ไทยดูเป็นธรรมชาติกว่าเดิม (เทียบ Higgsfield)

---

*ร่างจากไอเดีย POC 2026-06-29 — carry-over หลักการ/PRESENTER_LOCK/voice map/หลักตัดต่อ จาก UGC Studio (web app) เดิม*
