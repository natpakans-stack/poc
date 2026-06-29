# PCS — Product Scraper (spike v0.1)

พิสูจน์เสา 🅰: content script อ่านข้อมูลสินค้าจากหน้าที่ **user เปิดเอง** (passive) ผ่าน anti-bot ของ Shopee ได้ไหม

## โหลด (unpacked)
1. Chrome → `chrome://extensions`
2. เปิด **Developer mode** (มุมขวาบน)
3. **Load unpacked** → เลือกโฟลเดอร์ `extension/` นี้
4. ปักหมุดไอคอน PCS ไว้ที่ toolbar

## ทดสอบ
1. **เปิดหน้าสินค้า Shopee เองตามปกติ** (เสิร์ช/กดจากหน้าร้าน — อย่าวาง URL ตรงจาก extension)
2. คลิกไอคอน PCS → Side Panel เด้งข้างขวา
3. กด **"ดึงข้อมูลจากหน้านี้"**
4. ดูผล: ชื่อ/ราคา/รูป + `via <method>` (shopee-api / og-meta / jsonld / dom-price)

## ผลลัพธ์ที่ต้องดู
- ✅ ได้ ชื่อ/ราคา/รูป → **passive scrape ผ่าน anti-bot** = เสา 🅰 ไปต่อได้
- ⚠️ `via og-meta` อย่างเดียว (ไม่มี shopee-api) → API โดนกัน แต่ meta ยังพอใช้เป็น resource
- ❌ "โดน anti-bot" / ไม่เจอข้อมูล → ต้องพึ่ง fallback กรอกมือ

## ขอบเขต (ponytail)
- รองรับ Shopee เต็ม (API adapter) · เว็บอื่นได้ og/jsonld แบบ generic
- ไม่มี: ส่งข้อมูลต่อ pipeline, gen prompt, automate Flow — spike นี้พิสูจน์แค่ "ดึงได้ไหม"
- Lazada/TikTok เต็ม → เพิ่ม adapter ต่อเว็บใน `scrapeProduct()`
