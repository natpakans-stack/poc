# Legal AI — Interaction Design Specification

> Animation, transitions, gestures, keyboard, และ feedback patterns ทั้งหมดใน product

---

## 1. Motion Principles

| หลักการ | รายละเอียด |
|---------|-----------|
| **Purposeful** | ทุก animation ต้องมีเหตุผล — guide attention, show connection, give feedback |
| **Fast** | 100–300ms สำหรับ UI, ไม่เกิน 500ms |
| **Easing** | `ease-out` เข้า, `ease-in` ออก, `cubic-bezier(0.4, 0, 0.2, 1)` สำหรับ slide |
| **Respectful** | ต้อง respect `prefers-reduced-motion` — fallback เป็น instant |

### Duration Scale
```
instant   = 0ms        → color/state changes
fast      = 100–150ms  → hover, focus, button press
normal    = 200–300ms  → panel slide, card interactions
loop      = 1400–1500ms → typing dots, skeleton shimmer
```

---

## 2. Sidebar Toggle (ChatGPT-style)

### Desktop (>= 768px)
| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| คลิก panel icon | `margin-left: 0 → -240px` + `opacity: 1 → 0` | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| คลิกอีกครั้ง | `margin-left: -240px → 0` + `opacity: 0 → 1` | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |

- ปุ่ม toggle อยู่ใน **chat header** เสมอ (ไม่อยู่ใน sidebar)
- Chat area ขยายเต็มพื้นที่เมื่อ sidebar ปิด

### Mobile (< 768px)
| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| คลิก panel icon | sidebar `translateX(-100% → 0)` + overlay fade in | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| คลิก overlay | sidebar `translateX(0 → -100%)` + overlay fade out | 300ms | `cubic-bezier(0.4, 0, 0.2, 1)` |

---

## 3. Law Viewer Panel

### Desktop (>= 1024px)
- Always visible, **resizable** ด้วยลาก handle ขอบซ้าย
- Min: 280px, Max: 700px, Default: 420px
- Resize handle: 5px wide, แสดง dot indicator สีเขียวเมื่อ hover

### Mobile/Tablet (< 1024px)
| Trigger | Animation | Duration |
|---------|-----------|----------|
| คลิก citation card | `translateX(100% → 0)` full-screen slide in | 300ms |
| คลิกปุ่มปิด (X) | `translateX(0 → 100%)` slide out | 300ms |

---

## 4. Chat Messages

### Message Appear
```css
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
```
- Duration: 300ms ease-out
- Stagger: 2nd message +100ms delay

### Typing Indicator
```css
@keyframes pulse-dot {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
```
- 3 dots, 8x8px, brand-400
- Duration: 1400ms loop
- Stagger: dot 2 +200ms, dot 3 +400ms
- Text: "กำลังค้นหากฎหมายที่เกี่ยวข้อง..."

### Skeleton Loading
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```
- Gradient: `#f0f0f0 → #e0e0e0 → #f0f0f0`
- Duration: 1500ms loop
- 2 cards skeleton ขณะ AI กำลังค้นหา

### Loading Sequence
```
1. User sends message              → instant
2. Message appears (fadeSlideUp)    → 300ms
3. AI avatar appears                → 100ms
4. Typing dots start                → immediate
5. Status text appears              → 500ms after dots
6. Skeleton cards appear            → 300ms staggered
7. Dots stop, skeleton fade out     → 200ms
8. AI text streams in               → ~20ms/char
9. Citation cards appear            → 300ms staggered
10. Summary box appears             → 300ms
11. Disclaimer appears              → 200ms
```

---

## 5. Landing Page

### Typewriter Effect
- **Type**: 50ms per character
- **Pause**: 2000ms (read time)
- **Delete**: 25ms per character
- **Gap**: 400ms before next line
- **6 ข้อความ** วนลูป
- **Reduced motion**: instant swap ทุก 3 วินาที

### Stat Cards
| Trigger | Animation |
|---------|-----------|
| Hover | `translateY(-2px)` + `shadow: 0 8px 24px rgba(0,0,0,0.08)` |
| Leave | Reset to 0 |
| Duration | 200ms ease-out |

### Source Cards
| Trigger | Animation |
|---------|-----------|
| Hover | `ring: gray-200 → brand-300` |
| Duration | 200ms ease-out |

### Release Cards
| Trigger | Animation |
|---------|-----------|
| Hover | `border-color → rgba(45,138,78,0.3)` |
| Duration | 200ms ease-out |

---

## 6. Input Interactions

### Chat Textarea
- **Auto-resize**: height ขยายตาม content (min 24px, max 120px)
- **Focus**: ring `gray-300 → brand-500` (2px), 150ms

### Send Button States
| State | Appearance |
|-------|------------|
| Active | `brand-600`, hover `brand-700` |
| Disabled | `gray-200`, text `gray-400`, `cursor: not-allowed` |
| Click | scale 0.95 (100ms) |

---

## 7. Keyboard Navigation

### Focus Indicators
```css
focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
```

### Key Bindings
| Key | Context | Action |
|-----|---------|--------|
| `Enter` | Chat input | Send message |
| `Shift+Enter` | Chat input | New line |
| `Escape` | Viewer open | Close viewer |
| `Escape` | Sidebar open (mobile) | Close sidebar |
| `Tab` | Viewer tabs | Navigate law tabs |

---

## 8. Touch Interactions (Mobile)

| Gesture | Element | Action |
|---------|---------|--------|
| Tap | Sidebar toggle | Open/close sidebar |
| Tap | Citation card | Open law viewer (full screen) |
| Tap | Citation link | Scroll to section |
| Tap | Overlay | Close sidebar |

---

## 9. Feedback Patterns

### Success
- Message sent: appears immediately with fadeSlideUp
- AI starts: typing dots within 100ms

### Error
- Network error: red card with retry button
- No results: amber card with suggested questions
- Rate limit: blue card with countdown progress bar

### Informational
- Disclaimer: static text (smallest, gray-400)
- Data freshness: pulse dot + date badge

---

## 10. CSS Variables

```css
:root {
  --duration-fast: 150ms;
  --duration-normal: 300ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-slide: cubic-bezier(0.4, 0, 0.2, 1);
  --focus-ring: #2d8a4e;
}
```

---

## 11. Reduced Motion

ทุกหน้ามี:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Fallbacks:**
- Sidebar: instant show/hide
- Messages: instant appear
- Typing dots: static opacity 0.6
- Skeleton: solid gray, no shimmer
- Typewriter: instant swap ทุก 3 วินาที
