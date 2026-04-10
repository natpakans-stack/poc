# Legal AI — Design System

> Design tokens, components, patterns สำหรับระบบค้นคว้ากฎหมายอัจฉริยะ
> Single source of truth: `legal-ai-components.html` (Pure CSS component library)

---

## 1. Foundations

### 1.1 Color — Brand

| Token | Hex | Tailwind | ใช้เมื่อ |
|-------|-----|----------|---------|
| brand-50 | `#eef7f0` | `bg-brand-50` | Highlight bg, badge bg, active sidebar, summary box |
| brand-100 | `#d5ecd9` | `bg-brand-100` | User avatar bg, Latest badge |
| brand-200 | `#aedab7` | `ring-brand-200` | Ring/border บน badges, tags, active tabs |
| brand-300 | `#7cc28e` | `ring-brand-300` | Hover ring บน cards |
| brand-400 | `#4fa868` | `bg-brand-400` | Typing dots |
| brand-500 | `#2d8a4e` | `bg-brand-500` | Status dots, active border-left, glow |
| brand-600 | `#1f6e3c` | `bg-brand-600` | **Primary** — CTA buttons, AI avatar, nav logo, send button |
| brand-700 | `#1a5832` | `bg-brand-700` | Button hover, text on brand bg |
| brand-800 | `#174628` | `bg-brand-800` | Login gradient end |

### 1.2 Color — Neutrals (Tailwind Gray)

| Role | Class | Hex | ใช้เมื่อ |
|------|-------|-----|---------|
| Text primary | `text-gray-900` | `#111827` | Headings, titles |
| Text body | `text-gray-700` | `#374151` | Default body, law content |
| Text secondary | `text-gray-600` | `#4b5563` | Card descriptions |
| Text tertiary | `text-gray-500` | `#6b7280` | Nav links, captions |
| Text placeholder | `text-gray-400` | `#9ca3af` | Placeholder, timestamps |
| Border | `ring-gray-200` | `#e5e7eb` | Card borders, dividers |
| BG page | `bg-white` | `#ffffff` | Page bg |
| BG subtle | `bg-gray-50` | `#f9fafb` | Sidebar, chat area, hover |
| BG card | `bg-gray-100` | `#f3f4f6` | Inactive tabs, pill tags |

### 1.3 Color — Semantic

| Role | BG | Text | Border |
|------|-----|------|--------|
| Added tag | `#eef7f0` | `#1a5832` | `#aedab7` |
| Improved tag | `#ede9fe` | `#5b21b6` | `#c4b5fd` |
| Fixed tag | `#fff7ed` | `#9a3412` | `#fed7aa` |
| Error | `bg-red-50` | `text-red-800` | `ring-red-200` |
| Warning | `bg-amber-50` | `text-amber-700` | `ring-amber-200` |
| Info | `bg-blue-50` | `text-blue-800` | `ring-blue-200` |
| Purple (ฎีกา) | `bg-purple-50` | `text-purple-700` | `ring-purple-200` |

---

## 2. Typography

### 2.1 Font Pairing

| Role | Font | Weights | Tailwind | ใช้เมื่อ |
|------|------|---------|----------|---------|
| Heading | IBM Plex Sans Thai (ไม่มีหัว) | 500, 600, 700 | `font-heading` | Headings, titles, stat numbers, logo, badges |
| Body | IBM Plex Sans Thai Looped (มีหัว) | 400, 500 | `font-sans` | Body text, descriptions, chat messages — อ่านง่ายสำหรับเนื้อหายาวๆ |
| Mono | IBM Plex Mono | 400, 500 | `font-mono` | เลขที่คำพิพากษา |

**Google Fonts URL:**
```
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@500;600;700&family=IBM+Plex+Sans+Thai+Looped:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap
```

### 2.2 Type Scale

| Level | Tailwind | Size | ใช้เมื่อ |
|-------|----------|------|---------|
| Hero | `text-3xl sm:text-5xl font-bold` | 30/48px | Landing hero |
| Section | `text-xl font-semibold` | 20px | Section titles |
| Page | `text-2xl sm:text-3xl font-bold` | 24/30px | Release notes heading |
| Card title | `text-sm font-semibold` | 14px | Card titles, chat heading, law names |
| Body | `text-sm` | 14px | Chat messages, descriptions |
| Small | `text-xs` | 12px | **Minimum size** — badges, subtitles, timestamps |
| Stat | `text-3xl font-bold` | 30px | Stats cards |

### 2.3 Rules
- **Minimum size**: `text-xs` (12px) — ห้ามเล็กกว่านี้เด็ดขาด
- **Heading**: ใช้ `font-heading` class เสมอ
- **Body content ยาวๆ**: ใช้ default `font-sans` (Looped — มีหัว อ่านง่าย)

---

## 3. Spacing & Layout

### 3.1 Page Layout

| Context | Max Width | Padding |
|---------|-----------|---------|
| Landing sections | `max-w-7xl` (1280px) | `px-4 sm:px-6 lg:px-8` |
| Chat messages | `max-w-3xl` (768px) | `px-4 md:px-6` |
| Release notes content | `max-w-3xl` (768px) | `px-4 sm:px-6` |
| Chat sidebar | `w-60` (240px) | — |
| Law viewer | `280–700px` (resizable) | — |

### 3.2 Nav Height
- Mobile: `h-14` (56px)
- Desktop: `h-16` (64px)

---

## 4. Border Radius

| Token | Value | Tailwind | ใช้เมื่อ |
|-------|-------|----------|---------|
| Pill | 9999px | `rounded-full` | Pills, avatar, status dots |
| 2xl | 16px | `rounded-2xl` | Cards (source, stat, release) |
| xl | 12px | `rounded-xl` | Citation cards, input wrapper |
| lg | 8px | `rounded-lg` | Buttons, inputs, logo, history items |
| md | 6px | `rounded-md` | Tabs, small tags, citation buttons |

---

## 5. Shadows

| Token | Value | ใช้เมื่อ |
|-------|-------|---------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Buttons, cards |
| `shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Hero search box |
| Stat hover | `0 8px 24px rgba(0,0,0,0.08)` | Stat card hover |
| Glow | `0 0 60px rgba(45,138,78,0.08)` | Hero search box ambient |

---

## 6. Key Components

> ดู component จริงทั้งหมดได้ที่ `legal-ai-components.html`

### 6.1 Button — Primary
```html
<button class="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition shadow-sm">Label</button>
```
Variants: sm, full-width, icon+text

### 6.2 Button — Icon Only
```html
<button class="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" aria-label="Description">
  <svg aria-hidden="true">...</svg>
</button>
```

### 6.3 Chat Bubble — User
```html
<div class="chat-msg flex justify-end">
  <div class="max-w-lg rounded-2xl rounded-tr-md bg-brand-600 px-5 py-3 shadow-sm">
    <p class="text-sm text-white">Message</p>
  </div>
</div>
```

### 6.4 Citation Card
- Number badge สีต่างกัน: #1 brand, #2 purple, #3 blue
- Hover: border + bg เปลี่ยน
- ปุ่มลิงก์มาตรา + "ดูฉบับเต็ม"

### 6.5 Summary Box
- bg brand-50, ring brand-200, ordered list

### 6.6 Error/Warning/Info Boxes
- Red (network error), Amber (no results), Blue (rate limit)
- ทุกกล่องบอก: (1) เกิดอะไรขึ้น (2) ทำยังไงต่อ

### 6.7 Loading
- **Typing dots**: 3 จุด pulse staggered
- **Skeleton**: shimmer gradient sweep

---

## 7. Animations

| Animation | Duration | Easing | ใช้เมื่อ |
|-----------|----------|--------|---------|
| Sidebar slide | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Toggle sidebar |
| Viewer slide (mobile) | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Open/close viewer |
| Chat message appear | 300ms | ease-out | `fadeSlideUp` (translateY 8px → 0) |
| Card hover | 200ms | ease-out | `translateY(-2px)` + shadow |
| Typing dots | 1400ms loop | ease-in-out | 3 dots pulse staggered |
| Skeleton shimmer | 1500ms loop | linear | Gradient sweep |
| Typewriter | 50ms/char type, 25ms/char delete | linear | Landing hero |
| Button hover | 150ms | ease-out | bg color change |

**`prefers-reduced-motion`**: ทุก animation ถูก disable เป็น 0.01ms

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Tailwind | Key Changes |
|-----------|-------|----------|-------------|
| Mobile | < 640px | default | Nav: hamburger. Sidebar: overlay. Viewer: hidden |
| Tablet | >= 640px | `sm:` | Nav: full links + CTA |
| Tablet+ | >= 768px | `md:` | Sidebar visible (collapsible) |
| Desktop | >= 1024px | `lg:` | Viewer visible (resizable) |

---

## 9. Accessibility Checklist

- [x] `aria-hidden="true"` บน decorative SVGs
- [x] `aria-label` บน icon-only buttons
- [x] `<label>` บนทุก input
- [x] ARIA tab pattern บน law tabs
- [x] `aria-expanded` บน TOC
- [x] `aria-current` บน active items
- [x] Keyboard-accessible clickable elements
- [x] `rel="noopener noreferrer"` บน external links
- [x] Skip-to-content link
- [x] Semantic landmarks (`<main>`, `<nav>`, `<aside>`)
- [x] `prefers-reduced-motion` ทุกหน้า
- [x] Min text size: 12px

---

## 10. File Reference

| ไฟล์ | Purpose |
|------|---------|
| `legal-ai-components.html` | **Component Library** — single source of truth |
| `legal-ai-landing.html` | Landing page |
| `legal-ai-chat.html` | Chat page (3-panel) |
| `legal-ai-releases.html` | Full release notes |
| `legal-ai-states.html` | UI states reference |
| `REQUIREMENTS.md` | Product requirements |
| `DESIGN-SYSTEM.md` | This file |
| `INTERACTION-SPEC.md` | Animation specs |
