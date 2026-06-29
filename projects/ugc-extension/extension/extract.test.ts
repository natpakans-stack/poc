// ponytail self-check: ตรรกะ parse ที่พังเงียบได้ (id จาก URL, ราคาจากข้อความ)
// รันด้วย: bun test
import { test, expect } from "bun:test";

const idFromPath = (p: string) => {
  const m = p.match(/i\.(\d+)\.(\d+)/);
  return m ? { shop_id: m[1], item_id: m[2] } : null;
};
const priceFromText = (t: string) => {
  const m = t.match(/(?:฿|บาท)\s*([\d,]+(?:\.\d+)?)/) || t.match(/([\d,]+(?:\.\d+)?)\s*บาท/);
  return m ? +m[1].replace(/,/g, "") : null;
};

test("แกะ shop_id/item_id จาก URL Shopee", () => {
  expect(idFromPath("/Bluetooth-Remote-i.660962832.46305582956")).toEqual({
    shop_id: "660962832", item_id: "46305582956",
  });
  expect(idFromPath("/search?keyword=x")).toBeNull();
});

test("แกะราคาจากข้อความหน้า", () => {
  expect(priceFromText("ราคา ฿1,290 ส่งฟรี")).toBe(1290);
  expect(priceFromText("เพียง 99 บาท")).toBe(99);
  expect(priceFromText("฿2,499.50")).toBe(2499.5);
  expect(priceFromText("ไม่มีราคา")).toBeNull();
});
