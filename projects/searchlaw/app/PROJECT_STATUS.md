# Legal AI — Project Status (24 มีนาคม 2569, อัปเดตล่าสุด 22:00)

## Overview
ระบบค้นคว้ากฎหมายไทยด้วย AI สำหรับทนายความ — POC สำหรับ Real Factory

**Tech Stack:** React 19 + Vite + Tailwind v4 + Supabase + OpenAI GPT-4o

**Live Dev:** `http://localhost:5173` (run `bun run dev`)

---

## สิ่งที่ทำเสร็จแล้ว

### 1. Landing Page (หน้าแรก)
- Hero section + search preview + stats (ดึงจาก DB)
- แหล่งข้อมูล: แสดงเฉพาะ OCS (สำนักงานคณะกรรมการกฤษฎีกา) — กดลิงก์ไปเว็บจริง
- Release Notes section (ดึงจาก DB)
- Login Modal (Supabase Auth — email/password + Google OAuth)
- Footer

### 2. Chat Page (หน้าแชท)
- **Sidebar ซ้าย:** ประวัติแชท จัดกลุ่มตามวัน, ค้นหาได้, ลบได้ (confirm modal), collapse เป็น icon strip
- **Chat area กลาง:**
  - Empty state พร้อม suggestion chips (กดแล้วส่งคำถามได้)
  - AI ตอบพร้อม structured output:
    - Citation cards (สีเขียว/ม่วง/ฟ้า ตาม role)
    - Court decisions
    - Summary box (ขั้นตอนที่ต้องทำ)
    - Color legend อธิบายสี
  - Markdown rendering (## headings, **bold**, bullets, tables, HR)
  - Auto-generate ชื่อแชท + description หลัง AI ตอบ
  - Auto-scroll ไป AI message เริ่มต้น (ไม่ข้ามเนื้อหา)
- **Panel ขวา (Law Viewer):**
  - แสดงเนื้อกฎหมายจริงจาก DB (84K+ มาตรา)
  - Tabs สีตรงกับ citation card (เขียว/ม่วง/ฟ้า)
  - กด citation card → tab switch + highlight มาตราที่อ้างอิง
  - กดปุ่มมาตรา → highlight เฉพาะตัวที่กด (stopPropagation)
  - กด card body → highlight ทุกมาตราที่อ้างอิง
  - สารบัญ (collapse, max-h, สีตรงตาม tab)
  - Highlight สี 3 แบบ: viewer-highlight (เขียว), viewer-highlight-purple, viewer-highlight-blue
  - Draggable resize handle (280-700px)
  - Footer: PDF + ocs.go.th link
  - Logout confirm modal

### 3. AI Backend (Supabase Edge Function `chat` v12)
- **RAG (Retrieval-Augmented Generation):**
  - Full-text search 84K มาตราจาก DB (hybrid_search function)
  - Title-based search เพิ่มเติม
  - ส่งเนื้อมาตราจริงเป็น context ให้ AI
- **Model:** GPT-4o (fallback GPT-4o-mini)
- **Structured JSON output:** content + citations + courtDecisions + summary
- **OpenAI API Key:** เก็บใน Supabase Secrets

### 4. Database (Supabase)
**Tables:**
| Table | Rows | Description |
|-------|------|-------------|
| laws | 1,811 | กฎหมายจาก OCS ครบ 5 tabs |
| law_sections | 84,376 | เนื้อหารายมาตรา (deduplicated) |
| conversations | dynamic | แชทของ user |
| messages | dynamic | ข้อความในแชท (user + ai + citations) |
| releases | 1 | Release notes |
| data_sources | 1 | แหล่งข้อมูล (OCS) |
| system_stats | 4 | ตัวเลขหน้าแรก |
| example_questions | 6 | คำถามตัวอย่าง |

**Migrations:** `supabase/migrations/001-005`

**RLS:** conversations/messages = user-only, อื่นๆ = public read

**Functions:** `hybrid_search` (full-text + vector ready)

### 5. OCS Scraper
- `scripts/scrape-ocs.ts` — ดึงรายชื่อกฎหมาย (API)
- `scripts/scrape-sections.ts` — ดึงเนื้อหามาตรา (OCS API `getLawDoc`)
- Playwright scripts สำหรับ pagination ที่ API ไม่รองรับ
- ดึงครบ 1,811 ฉบับ, 84,376 มาตรา

---

## Latest Session Changes (24 มี.ค. 22:00)

### Edge Function v13 (latest)
- Prompt สั่งให้ verify มาตราก่อนอ้าง — ONLY cite sections ที่ APPEAR ใน DB context
- ใช้ EXACT law name จาก DB
- User เป็นทนาย — ไม่แนะนำ "ปรึกษาทนาย"
- GPT-4o primary + GPT-4o-mini fallback

### Panel ขวา (Law Viewer) Fixes
- สี tab/highlight/สารบัญ ตรงกับ citation card (เขียว/ม่วง/ฟ้า)
- กด card body → highlight ทุกมาตรา, กดปุ่มมาตรา → highlight เฉพาะตัวเดียว
- ลบ "ดูฉบับเต็ม" button ออก (กด card แทน)
- matchSection ใช้ prefix + number exact match (ไม่ match "ข้อ 4" กับ "มาตรา 4")
- Search law by keyword flexible (3 strategies)

### Content Rendering
- Markdown table rendering (| col1 | col2 |)
- ## headings, **bold**, bullets, numbered lists, HR
- Auto-scroll ไป AI message เริ่มต้น (ไม่ข้ามเนื้อหา)

### Vector Embeddings (IN PROGRESS — started ~22:00)
- `scripts/generate-embeddings.ts` — running in background
- pgvector extension + column `embedding vector(1536)` เพิ่มแล้ว (migration 006)
- Model: `text-embedding-3-small` (1536 dims)
- เมื่อเสร็จ:
  1. สร้าง HNSW index: `create index on law_sections using hnsw(embedding vector_cosine_ops)`
  2. เปิด hybrid search: เปลี่ยน `vec_weight: 0.5` ใน Edge Function
  3. Edge Function ต้อง embed คำถามก่อน search: call OpenAI embedding API แล้วส่ง `query_embedding` ไป hybrid_search

### Comparison Testing
- เทียบ Legal AI vs Gemini Pro ด้วย Playwright (5 คำถาม)
- Legal AI: structured output (citations + summary) ดีกว่า
- Gemini: เนื้อหาละเอียดกว่า, ครบกว่า
- ปัญหาหลัก: RAG search ดึงมาตราไม่ตรง context → vector search จะช่วย

---

## สิ่งที่ยังไม่ได้ทำ / ต้องปรับปรุง

### Priority 1 (ต่อจากนี้)
- [🔄] **Vector Embeddings** — กำลัง generate อยู่ (`scripts/generate-embeddings.ts` running in background)
  - pgvector extension + HNSW index พร้อมแล้ว
  - ใช้ OpenAI text-embedding-3-small (1536 dims)
  - หลัง generate เสร็จ → เปิด hybrid search: `vec_weight: 0.5` ใน Edge Function
- [✅] **Prompt Tuning v13** — ปรับแล้ว:
  - สั่งให้ ONLY cite มาตราที่ APPEAR ใน database context
  - ไม่บอกให้ "ปรึกษาทนาย" (user เป็นทนายเอง)
  - สั่งให้ตอบ 400-600 words, ## headings, ข้อควรระวัง, follow-up question
- [ ] **AI ตอบ JSON ไม่เสถียร** — บางครั้ง return plain text แทน JSON → citations ไม่แสดง
  - ลองเพิ่ม `response_format: { type: "json_object" }` ใน OpenAI call

### Priority 2
- [ ] **Mobile responsive** — Chat page ยังไม่ optimize สำหรับ mobile
- [ ] **ลบ duplicate law_sections** — ยังมี duplicate rows ใน DB (มาตรา 4 ซ้ำ 2 ตัว)
- [ ] **Deploy production** — ตอนนี้ dev only (localhost:5173)
- [ ] **Chat follow-up** — ถามต่อในแชทเดิมได้ แต่ context อาจหลุด

### Nice to have
- [ ] Vector search (semantic)
- [ ] ดึงคำพิพากษาศาลฎีกา (deka.supremecourt.or.th)
- [ ] PDF download สำหรับ Law Viewer
- [ ] Admin panel จัดการ releases, data sources
- [ ] Dark mode

---

## Credentials & Keys

### Supabase
- **Project:** `xqmdyjjatkpmjzlqpffr`
- **URL:** `https://xqmdyjjatkpmjzlqpffr.supabase.co`
- **Anon Key:** ใน `.env` → `VITE_SUPABASE_ANON_KEY`
- **Service Role Key:** ใน Edge Function secrets
- **DB Password:** `YArGuvEjn6KuHvZh`
- **Access Token:** `sbp_f352abc22f930932cb3adc3c0524029ac903e9ce`

### OpenAI
- **API Key:** ใน Supabase Secrets → `OPENAI_API_KEY`
- **Model:** GPT-4o (Edge Function v12)

### Auth
- **Test User:** `natpakan.s@real-factory.co` / `YArGuvEjn6KuHvZh`

---

## Key Files

### Frontend
```
src/
├── App.tsx                    — Routes + ProtectedRoute + LoginModalProvider
├── pages/
│   ├── LandingPage.tsx        — หน้าแรก
│   ├── ChatPage.tsx           — หน้าแชท (state management ทั้งหมด)
│   └── ReleasesPage.tsx       — Release Notes
├── components/
│   ├── auth/LoginModal.tsx    — Login modal
│   ├── chat/
│   │   ├── ChatSidebar.tsx    — Sidebar ซ้าย (conversations)
│   │   ├── ChatMessage.tsx    — Render message (markdown + citations)
│   │   ├── ChatInput.tsx      — Input box
│   │   ├── CitationCard.tsx   — Citation card component
│   │   └── LawViewer.tsx      — Panel ขวา (law viewer)
│   ├── landing/
│   │   ├── HeroSection.tsx    — Hero + stats (from DB)
│   │   ├── DataSourcesSection.tsx
│   │   └── ReleaseNotesSection.tsx
│   └── layout/
│       ├── Navbar.tsx
│       └── Footer.tsx
├── lib/
│   ├── supabase.ts            — Supabase client
│   └── api.ts                 — All CRUD functions
├── hooks/useAuth.ts           — Auth hook
├── contexts/LoginModalContext.tsx
└── index.css                  — Custom CSS (tags, highlights, etc.)
```

### Backend
```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql     — conversations + messages
│   ├── 002_content_tables.sql     — laws, law_sections, releases, etc.
│   ├── 003_add_conversation_description.sql
│   ├── 004_expand_laws_table.sql  — OCS fields
│   └── 005_hybrid_search.sql      — pgvector + FTS + hybrid_search()
└── run-all-migrations.sql         — Combined SQL

Edge Function: chat (v12)
  — RAG search → OpenAI GPT-4o → structured JSON response
```

### Scripts
```
scripts/
├── scrape-ocs.ts              — Scrape law list from OCS API
└── scrape-sections.ts         — Scrape law sections via getLawDoc API
```

---

## วิธี Resume งานวันพรุ่งนี้

1. เปิด terminal ที่ `projects/searchlaw/app`
2. `bun run dev` → เปิด `http://localhost:5173`
3. บอก Claude: **"อ่านไฟล์ PROJECT_STATUS.md แล้วทำต่อจากเมื่อวาน"**
4. Claude จะรู้ทุกอย่างที่ทำไปแล้ว + สิ่งที่ต้องทำต่อ
