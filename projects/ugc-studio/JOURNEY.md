# UGC Studio — Journey Gap Analysis & To-be

> 2026-06-29 · ปรับ journey จาก "storyboard → 3 คอลัมน์" ที่ลำดับย้อนศร ให้เป็น **Hybrid: wizard นำ + studio ลึก**

## As-is (ของเดิม)

```
STAGE 1 Storyboard (เต็มจอ)            STAGE 2 Studio (3 คอลัมน์)
- object (text เท่านั้น)         ──▶   §1 Source: รูปสินค้า · ref · avatar
- platform/ฉาก/mood/visual/style        §2 Script: transcript + AI ร่าง + นับวิ
- → storyboard → เอา dialogue           §3 Output: รูปแบบคลิป · aspect · ความยาว · res
  มาต่อเป็น script เส้นเดียว                    → ปุ่มสร้างวิดีโอ
```

## Gap analysis

| # | Gap | Severity | สถานะ |
|---|-----|----------|-------|
| 1 | Storyboard เขียนบท "ตาบอด" — ไม่ให้แนบรูป แต่รูปไปอยู่หลัง (studio §1) | 🔴 | ✅ ย้ายรูปมา entry |
| 2 | ความยาวตัดสินที่ §3 (ท้าย) แต่บทเขียนตั้งแต่ stage 1 → ไม่รู้จะยาวแค่ไหน | 🔴 | ✅ ตั้งความยาวที่ entry |
| 3 | มี "ความยาว" 2 ระบบไม่คุยกัน (platform 8วิ×ฉาก vs duration=15) → เด้ง ⚠️เกิน | 🔴 | ✅ platform×ฉาก = ตัวตั้งเดียว |
| 4 | ผล storyboard (image/video_prompt ราย scene) ถูกทิ้งใน App.tsx | 🔴 | ◐ เก็บ result ไว้แล้ว · wire เข้า pipeline = next |
| 5 | รูปแบบคลิป (avatar/full/no_person) อยู่ท้ายสุด แต่มันคือ decision บนสุด | 🟡 | ✅ ย้ายมา entry |
| 6 | AI ร่างบทซ้ำ 2 ที่ (storyboard + ScriptColumn) | 🟡 | ◐ คงไว้เป็น fallback ของ path "พิมพ์เอง" |
| 7 | ไม่มี progress / where-am-I | 🟡 | ✅ breadcrumb "ตั้งโจทย์ › สตูดิโอ" |

**ราก:** decision ที่ล็อกขั้นถัดไป (ทรง · ความยาว · ตัวสินค้า) ถูกวางท้ายสุด ส่วนงานเขียนบทที่ต้องรู้ของพวกนั้นก่อนดันมาก่อน

## To-be (Hybrid)

```
╔═ ENTRY "ตั้งโจทย์" (wizard นำ · gate) ═╗      ┌─ STUDIO (workspace ลึก) ─────────┐
║ รูปแบบคลิป ⟵ จาก §3                        ║      │ breadcrumb: ตั้งโจทย์ ✓ › สตูดิโอ │
║ ชื่อสินค้า + อัปโหลดรูป ⟵ จาก §1          ║  ──▶ │ §1 รูป(มาแล้ว) · avatar          │
║ platform + ฉาก → "≈ XX วิ" = ตัวตั้ง     ║      │ §2 บทจาก storyboard · timeline · │
║ mood/visual/บุคลิก                       ║      │    target = วินาทีรวม            │
║ [สร้าง Storyboard →] / [พิมพ์เอง]        ║      │ §3 ความยาว = derived read-only · │
╚════════════════════════════════════════╝      │    aspect · res · [สร้างวิดีโอ]   │
                                                 └──────────────────────────────────┘
```

### Source of truth: ความยาว
`PLATFORM_SEC[platform] × sceneCount = totalSec` (flow 8 · grok 6 · supergrok 10)
→ ป้อน `settings.duration` ตอนเข้า studio → §2 ใช้เป็น target, §3 แสดง read-only

## Next (ยังไม่ทำรอบนี้)
- Gap 4 เต็มขั้น: ส่ง `image_prompt/video_prompt` ราย scene เข้า `/api/generate` + Remotion comp (แตะ server pipeline)
- Gap 6: ถ้า storyboard เป็น default path เสมอ ค่อยถอด AI ร่างใน ScriptColumn
