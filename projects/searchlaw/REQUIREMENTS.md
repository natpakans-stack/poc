# Legal AI — Project Requirements Document

> ระบบค้นคว้ากฎหมายอัจฉริยะด้วย AI สำหรับทีมกฎหมาย
> สถานะ: **POC (Proof of Concept)** | เวอร์ชัน: Beta

---

## 1. Product Overview

### 1.1 ชื่อโปรเจกต์
**Legal AI** — ระบบค้นคว้ากฎหมายอัจฉริยะ

### 1.2 ปัญหาที่แก้ (Problem Statement)
ทีมกฎหมายต้องใช้เวลานานในการค้นหากฎหมาย มาตรา และคำพิพากษาศาลฎีกาที่เกี่ยวข้องกับประเด็นทางกฎหมาย ปัจจุบันต้องค้นจากหลายแหล่งแยกกัน (ocs.go.th, ศาลฎีกา, ราชกิจจานุเบกษา) และต้องอ่านตีความเอง

### 1.3 Solution
ระบบ AI Chat ที่ผู้ใช้สามารถถามคำถามเป็นภาษาธรรมชาติ (ภาษาไทย) แล้วระบบจะ:
1. ค้นหากฎหมายที่เกี่ยวข้องอัตโนมัติ
2. อ้างอิงมาตราที่เกี่ยวข้องพร้อมลิงก์
3. แสดงคำพิพากษาศาลฎีกาที่เกี่ยวข้อง
4. สรุปคำตอบให้เข้าใจง่าย

### 1.4 Target Users
- **ทีมกฎหมาย** (Internal Use Only)
- ขนาดทีม: ~5 สมาชิก
- ใช้งานภาษาไทยเป็นหลัก

### 1.5 Use Cases ตัวอย่าง
- "จะเปิดซาวน่าในโรงแรม ต้องขอใบอนุญาตอะไรบ้าง?"
- "ใบอนุญาตขายแอลกอฮอล์ในโรงแรม"
- "กฎหมายคุ้มครองผู้บริโภค e-commerce"
- "ภาษีที่ดินและสิ่งปลูกสร้าง สำหรับคอนโด"
- "สัญญาเช่าที่ดิน 30 ปี ทำยังไง?"
- "เลิกจ้างพนักงาน ต้องจ่ายชดเชยเท่าไร?"

---

## 2. Data Sources (แหล่งข้อมูล)

### 2.1 Active (พร้อมใช้งาน)

| # | แหล่งข้อมูล | URL | ประเภทข้อมูล | ปริมาณ |
|---|-------------|-----|-------------|--------|
| 1 | สำนักงานคณะกรรมการกฤษฎีกา | ocs.go.th | พ.ร.บ. / พ.ร.ก. / กฎกระทรวง / รัฐธรรมนูญ / ประมวลกฎหมาย | 180 พ.ร.บ., 25 พ.ร.ก., 40 กฎกระทรวง |
| 2 | ศาลฎีกา | deka.supremecourt.or.th | คำพิพากษาศาลฎีกา ทุกแผนก | 1,400 แพ่ง, 980 อาญา, 520 แรงงาน |
| 3 | ราชกิจจานุเบกษา | ratchakitcha.soc.go.th | ประกาศ คำสั่ง ระเบียบ | 300 ฉบับ |

### 2.2 Planned (รอเพิ่มในอนาคต)

| # | แหล่งข้อมูล | ประเภทข้อมูล |
|---|-------------|-------------|
| 4 | คณะกรรมการกฤษฎีกา (ความเห็น) | บันทึกตีความกฎหมาย |
| 5 | วิทยานิพนธ์ / บทความวิชาการ | บทความวิชาการด้านกฎหมายจากมหาวิทยาลัยชั้นนำ |

### 2.3 Stats รวม (ณ v1.3)
- **245** ฉบับกฎหมาย
- **12,400** มาตรา
- **3,200** คำพิพากษาศาลฎีกา
- **5** แหล่งข้อมูล (3 active, 2 planned)

---

## 3. Feature Requirements

### 3.1 Landing Page (`legal-ai-landing.html`)

#### Navigation
- Sticky navbar, backdrop-blur, `max-w-7xl`
- **Desktop (>=640px)**: Logo + "Legal AI" + badge "Beta" | ลิงก์ "แหล่งข้อมูล", "Release Notes" | ปุ่ม "เริ่มค้นคว้า" พร้อม arrow icon
- **Mobile (<640px)**: Logo + "Legal AI" | ปุ่ม "เริ่มค้นคว้า" (compact) + hamburger → dropdown menu
- Nav height: `h-14` mobile, `h-16` desktop

#### Hero Section
- Badge อัพเดท: pulse dot + วันที่ล่าสุด
- Heading 2 บรรทัด: "ค้นคว้ากฎหมาย" + "ด้วย AI อัจฉริยะ" (brand-600)
  - Font: `font-heading` (IBM Plex Sans Thai), `text-3xl sm:text-5xl`
- Subtitle กระชับ 1 บรรทัด, `max-w-xl`
- **Search Preview**: ทั้งก้อนเป็น `<a>` ลิงก์ไปหน้า chat (ไม่ใช่ input)
  - **Typewriter effect**: ข้อความพิมพ์ทีละตัว 50ms, ลบ 25ms, วนลูป 6 คำถามตัวอย่าง
  - Hover: ring-brand-300, shadow-xl, bg เปลี่ยน
  - Reduced motion: สลับข้อความทุก 3 วินาทีแทน

#### Stats Section
- 4 cards ใน grid (`grid-cols-2 sm:grid-cols-4`)
- แต่ละ card: ตัวเลข (`font-heading text-3xl font-bold`) + label + trend
- Hover: `translateY(-2px)` + shadow expand (200ms ease-out)

#### Data Sources Section
- 5 cards ใน grid (`sm:grid-cols-2 lg:grid-cols-3`)
- แต่ละ card: icon (สีต่างกัน), ชื่อ, URL, สถานะ (Active/Planned), จำนวนข้อมูล
- Hover: `ring-brand-300`

#### Release Notes Section (Compact Design)
- Header: "อัพเดทล่าสุด" + badge v1.3 + วันที่
- **Latest release เท่านั้น**: แสดงรายละเอียดเต็ม (Added/Improved/Fixed tags) + summary stats
- **Previous versions**: compact list (1 บรรทัดต่อเวอร์ชัน) — version badge + สรุปสั้น + วันที่
- **"ดู Release Notes ทั้งหมด"** → ลิงก์ไปหน้า `legal-ai-releases.html`

#### Footer
- "Legal AI — Internal Use Only"
- แหล่งข้อมูลอ้างอิง
- Responsive: flex-col mobile → flex-row desktop

---

### 3.2 Chat Page (`legal-ai-chat.html`)

#### Layout (3-Panel)
```
┌──────────┬─────────────────────┬────────────────┐
│ Sidebar  │ Chat Panel          │ Law Viewer     │
│ 240px    │ Flexible            │ 280–700px      │
│ collapse │                     │ resizable      │
└──────────┴─────────────────────┴────────────────┘
```
- Full viewport height (`100dvh`)
- Sidebar: collapsible ด้วย smooth animation (`margin-left` transition 300ms)
- Viewer: resizable ด้วยลาก handle ขอบซ้าย (min 280px, max 700px)

#### Chat Header (แบบ ChatGPT)
- **ซ้าย**: ปุ่ม sidebar toggle (panel icon) + ปุ่ม new chat (pencil icon)
- **กลาง**: ชื่อแชท (centered, truncated)
- **ขวา**: ปุ่ม home (house icon → landing page)

#### Left Sidebar — Chat History (240px)
- **Header**: Logo "Legal AI" + ปุ่ม "แชทใหม่" (full width, brand-600)
- **Search**: input จริง พร้อม search icon + focus ring
- **Chat List**: จัดกลุ่มตามเวลา (วันนี้, เมื่อวาน, 7 วันก่อน)
  - Active: bg brand-50, border-left 2px brand-500, `aria-current="true"`
  - Hover: bg gray-50
- **User Section**: avatar "ทน" + "ทีมกฎหมาย" + "5 สมาชิก"
- **Responsive**:
  - Desktop: visible, toggleable (slide ด้วย margin-left)
  - Mobile (<768px): hidden, slide in from left + overlay backdrop

#### Chat Messages
- Max width `max-w-3xl` centered, scrollable
- **User bubble**: bg brand-600, text white, `rounded-2xl rounded-tr-md` (tail), ชิดขวา
- **AI response**: avatar + content (ไม่มี bubble bg)
  - Text + Citation cards + Court decisions + Summary box + Disclaimer
- **Fade-slide-up animation**: ทุก message มี `fadeSlideUp` 300ms, staggered

#### AI Response Structure
1. คำอธิบายภาพรวม
2. Citation Cards (1-3 ใบ) — คลิกเปิด Law Viewer
   - Number badge สีต่างกัน (#1 brand, #2 purple, #3 blue)
   - ชื่อกฎหมาย + สถานะ (บังคับใช้/ตรวจสอบ)
   - คำอธิบาย + ปุ่มลิงก์มาตรา + "ดูฉบับเต็ม"
3. คำพิพากษาที่เกี่ยวข้อง (เลขฎีกา mono + สรุป)
4. Summary box (bg brand-50, ordered list)
5. Disclaimer: "AI อาจตีความไม่ถูกต้อง..."

#### Loading State (ใน chat)
- **Typing dots**: 3 จุดเด้ง (pulse 1.4s, staggered 200ms) + text "กำลังค้นหา..."
- **Skeleton cards**: 2 ใบ shimmer animation (1.5s infinite)

#### Chat Input
- Textarea auto-resize (min 24px, max 120px) + `<label>` sr-only
- Send button (brand-600, aria-label) — disabled state: gray-200
- Focus: ring-brand-500 (2px)
- Footer text: แหล่งข้อมูล + version + "กด Enter เพื่อส่ง"

#### Law Viewer (Right Panel)
- **Header**: ชื่อกฎหมาย + ปุ่มปิด (X) เท่านั้น
- **Tabs**: `role="tablist"` สลับกฎหมาย 3 ฉบับ (`aria-selected`)
- **TOC**: collapsible (`aria-expanded`), ลิงก์ไปแต่ละหมวด
- **Content**: มาตราปกติ + highlighted (อ้างถึงในแชท) ด้วย border-left + badge
- **Footer**: ปุ่ม PDF + ลิงก์ ocs.go.th
- **Resize**: drag handle ขอบซ้าย (desktop only), min 280px – max 700px
- **Responsive**:
  - Desktop (>=1024px): visible, resizable
  - Mobile/Tablet: hidden, slide in full-screen from right

---

### 3.3 Login Overlay (ใน `legal-ai-landing.html`)

- **Trigger**: คลิก "เริ่มค้นคว้า" หรือ search preview box
- **Overlay**: backdrop blur + dark overlay, modal centered
- **Modal content**: Logo + "เข้าสู่ระบบ" + form (อีเมล, รหัสผ่าน, "ลืมรหัสผ่าน?") + ปุ่ม submit
- **ปิดได้**: คลิก backdrop, ปุ่ม X, กด Escape
- **Animation**: fadeSlideUp 300ms
- **Submit** → ไปหน้า chat
- **Footer**: "Internal Use Only — ติดต่อ IT เพื่อขอบัญชี"
- **หน้า Login แยก** (`legal-ai-login.html`) ยังมีอยู่สำหรับ direct access / deep link

### 3.4 Release Notes Page (`legal-ai-releases.html`)

- **Nav**: "กลับหน้าหลัก" (arrow left) + logo ขวา, `max-w-7xl`
- **Content**: `max-w-3xl` centered
- **Releases**: ทุกเวอร์ชันแสดงเต็ม (v1.3 → v1.0) เรียงจากใหม่ไปเก่า
- แต่ละ release: version badge + date + tags (Added/Improved/Fixed) + summary stats

---

### 3.4 UI States Page (`legal-ai-states.html`)

Reference page สำหรับดู states ทั้งหมด:
1. **Empty State** — แชทใหม่ + 4 suggestion cards
2. **Loading State** — typing dots + skeleton cards
3. **Error: Network** — red card + "ลองอีกครั้ง"
4. **Error: No Results** — amber card + คำถามแนะนำ
5. **Error: Rate Limit** — blue card + countdown progress
6. **Login Page** — split layout (branding + form)
7. **Empty Sidebar** — ไม่มีประวัติแชท

---

### 3.5 Component Library (`legal-ai-components.html`)

Single source of truth สำหรับ components ทั้งหมด (Pure CSS, ไม่ใช่ Tailwind):
1. Buttons (Primary, Icon, Ghost, Citation, Send, Retry)
2. Badges & Tags (Beta, Version, Status, Law status, Release tags, Source)
3. Chat Bubbles & States (User, AI text, Typing, Skeleton, Disclaimer)
4. Citation Cards & Summary (Card #1-3, Court decision, Summary box)
5. Error & Feedback (Network, No results, Rate limit)
6. Inputs (Chat, Search, Login)
7. Sidebar (History items, Avatar, Tabs)
8. Law Viewer (Normal section, Highlighted section)
9. Empty States & Suggestions
10. Stat Cards

---

## 4. Design Specifications

### 4.1 Font Pairing
| Role | Font | Weights | ใช้เมื่อ |
|------|------|---------|---------|
| Heading | IBM Plex Sans Thai (ไม่มีหัว) | 500, 600, 700 | Headings, titles, stat numbers, logo |
| Body | IBM Plex Sans Thai Looped (มีหัว) | 400, 500 | Body text, descriptions, chat messages |
| Mono | IBM Plex Mono | 400, 500 | เลขที่คำพิพากษา |

### 4.2 Typography Rules
- **Minimum size**: `text-xs` (12px) — ห้ามเล็กกว่านี้เด็ดขาด
- Heading: `font-heading` class (IBM Plex Sans Thai)
- Body: default `font-sans` (IBM Plex Sans Thai Looped)
- Stat numbers: `font-heading text-3xl font-bold`

### 4.3 Color — Brand Green
| Token | Hex | Primary Use |
|-------|-----|------------|
| brand-50 | `#eef7f0` | Highlights, active bg, summary box |
| brand-100 | `#d5ecd9` | Avatar bg, Latest badge |
| brand-200 | `#aedab7` | Ring/border on badges |
| brand-500 | `#2d8a4e` | Status dots, active borders |
| brand-600 | `#1f6e3c` | **Primary CTA**, buttons, AI avatar |
| brand-700 | `#1a5832` | Hover state, text on brand bg |

### 4.4 Animations
- **Sidebar**: `margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)` (slide)
- **Chat messages**: `fadeSlideUp 0.3s ease-out` (staggered)
- **Typing dots**: `pulse-dot 1.4s infinite` (staggered 200ms)
- **Skeleton**: `shimmer 1.5s infinite` (gradient sweep)
- **Typewriter**: 50ms type / 25ms delete / 2s pause
- **Cards hover**: `translateY(-2px)` 200ms + shadow
- **`prefers-reduced-motion`**: ทุก animation ถูก disable

---

## 5. Page Inventory

| ไฟล์ | หน้า | สถานะ |
|------|------|-------|
| `legal-ai-landing.html` | Landing Page + Login Overlay | UI เสร็จ (Static) |
| `legal-ai-chat.html` | Chat Page — 3-panel | UI เสร็จ (Static) + Loading skeleton |
| `legal-ai-releases.html` | Release Notes (Full) | UI เสร็จ (Static) |
| `legal-ai-states.html` | UI States Reference | Reference document |
| `legal-ai-components.html` | Component Library | Reference document (Pure CSS) |
| `REQUIREMENTS.md` | This file | Documentation |
| `DESIGN-SYSTEM.md` | Design tokens & components | Documentation |
| `INTERACTION-SPEC.md` | Animation & interaction specs | Documentation |

---

## 6. Accessibility

ทุกหน้าผ่าน:
- `aria-hidden="true"` บน decorative SVGs ทั้งหมด
- `aria-label` บน icon-only buttons ทุกตัว
- `<label>` (visible or sr-only) บนทุก input
- `role="tablist"` + `aria-selected` บน law tabs
- `aria-expanded` บน TOC toggle
- `aria-current` บน active items
- `role="button"` + `tabindex` + keyboard handler บน clickable divs
- `rel="noopener noreferrer"` บน external links
- Skip-to-content link ทุกหน้า
- `<main>`, `<nav aria-label>`, `<aside aria-label>` landmarks
- `prefers-reduced-motion` ทุกหน้า
- Minimum text: 12px (`text-xs`)

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile | < 640px | Nav: hamburger + compact CTA. Sidebar: hidden overlay |
| Tablet | >= 640px | Nav: full links + CTA |
| Tablet+ | >= 768px | Chat sidebar visible (collapsible) |
| Desktop | >= 1024px | Law viewer visible (resizable 280–700px) |

---

## 8. Interaction Flows

### Flow หลัก: ถามคำถามกฎหมาย
```
Landing Page
  └─ คลิก search preview หรือ "เริ่มค้นคว้า"
      └─ Login Overlay (modal)
          └─ กรอก email + password → เข้าสู่ระบบ
              └─ Chat Page (แชทใหม่)
                  └─ พิมพ์คำถาม → Enter
                      └─ Typing dots + skeleton loading
                          └─ AI ตอบพร้อม citation cards
                              └─ คลิก citation card → Viewer เปิด
```

### Flow: Sidebar Toggle
```
Chat Header → คลิก panel icon
  ├─ Desktop: sidebar slide ปิด (margin-left animation)
  │   └─ คลิกอีกครั้ง → slide เปิดกลับ
  └─ Mobile: sidebar slide in + overlay
      └─ คลิก overlay หรือปุ่ม → slide ออก
```

### Flow: Viewer Resize
```
Viewer ขอบซ้าย → hover เห็น handle สีเขียว
  └─ ลากซ้าย → ขยาย (max 700px)
  └─ ลากขวา → ย่อ (min 280px)
```

---

## 9. Release History

| Version | วันที่ | สาระสำคัญ |
|---------|-------|----------|
| v1.0 | 15 ก.พ. 2569 | Initial: รัฐธรรมนูญ, พ.ร.บ. 50 ฉบับ, ประมวลกฎหมาย, ฎีกา 700 |
| v1.1 | 1 มี.ค. 2569 | เพิ่ม พ.ร.บ. โรงแรม/สถานบริการ/อาคาร, ฎีกา 2565, AI สรุปคำพิพากษา |
| v1.2 | 15 มี.ค. 2569 | เพิ่ม ฎีกา 2566 แพ่ง, search by มาตรา, แก้ bug ตาราง |
| v1.3 | 20 มี.ค. 2569 | เพิ่ม พ.ร.บ. สาธารณสุข + กฎกระทรวง, ฎีกา 2566 แรงงาน, ปรับ cross-reference |

---

## 10. Known Limitations & Next Steps

### UI ที่ยังเป็น Static
- [ ] Chat ยังไม่ส่งข้อความได้จริง (ไม่มี backend)
- [ ] Chat history เป็น hardcoded
- [ ] Law Viewer เป็น hardcoded content
- [ ] ปุ่ม Export PDF ยังไม่ทำงาน

### Backend (ยังไม่มี — Recommended)
- **Runtime**: Bun (`Bun.serve()`)
- **AI**: Claude API สำหรับ chat completion
- **Database**: `bun:sqlite` สำหรับ chat history + law data index
- **Search**: Vector search (embeddings) สำหรับ semantic search

### Data Pipeline (ยังไม่มี)
- Web scraping จาก 3 แหล่งข้อมูล active
- Parse กฎหมายเป็น structured data
- สร้าง embeddings สำหรับ semantic search
- อัพเดทข้อมูลเป็นระยะ

### Features ที่ยังไม่มี
- [ ] Authentication / Login (UI มีแล้ว — ยังไม่มี backend auth)
- [ ] Chat streaming (real-time response)
- [ ] Dark mode
- [ ] คำพิพากษา viewer (ปัจจุบันมีแค่ กฎหมาย viewer)
- [ ] ค้นหาภายในกฎหมาย
- [ ] Copy citation ไปใช้ในเอกสาร

---

## 11. Glossary

| คำศัพท์ | ความหมาย |
|---------|---------|
| พ.ร.บ. | พระราชบัญญัติ |
| พ.ร.ก. | พระราชกำหนด |
| ป.พ.พ. | ประมวลกฎหมายแพ่งและพาณิชย์ |
| ป.อ. | ประมวลกฎหมายอาญา |
| ฎ. | คำพิพากษาศาลฎีกา (เช่น ฎ.1234/2565) |
| Citation Card | Card ใน AI response ที่อ้างอิงกฎหมาย |
| Law Viewer | Panel ด้านขวาที่แสดงเนื้อหากฎหมายเต็ม |
