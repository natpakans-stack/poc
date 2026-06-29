// ── Side Panel controller ──────────────────────────────────────────
// กดปุ่ม → inject scraper ลง active tab (หน้าที่ user เปิดเอง) → render
// passive: ทำงานเฉพาะตอน user กด, บนหน้าที่เปิดอยู่แล้ว — ไม่ navigate เอง

const $ = (id) => document.getElementById(id);

$("go").addEventListener("click", async () => {
  const btn = $("go");
  btn.disabled = true;
  setStatus("⏳ กำลังอ่านหน้า...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("ไม่พบแท็บที่เปิดอยู่");
    if (!/^https?:/.test(tab.url || "")) throw new Error("แท็บนี้ไม่ใช่หน้าเว็บสินค้า");

    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",          // เข้าถึง window vars + fetch ใช้ cookie จริงของหน้า
      func: scrapeProduct,
    });
    render(result);
  } catch (e) {
    // host ไม่อยู่ใน permission / หน้าบล็อก → แจ้งตรงๆ
    setStatus(`<span class="badge bad">ดึงไม่ได้</span> ${e.message}`);
  } finally {
    btn.disabled = false;
  }
});

function setStatus(html) { $("status").innerHTML = html; }

function render(r) {
  $("raw").textContent = JSON.stringify(r, null, 2);
  $("rawWrap").style.display = "block";

  if (!r) { setStatus(`<span class="badge bad">ไม่มีข้อมูลกลับมา</span>`); return; }
  if (r.blocked) {
    setStatus(`<span class="badge bad">โดน anti-bot</span> หน้านี้เป็นหน้า verify ของ Shopee — ลองรีเฟรช/เลื่อนดูสินค้าเองก่อนแล้วกดใหม่`);
    $("card").style.display = "none";
    return;
  }
  const got = r.name || r.price || (r.images && r.images.length);
  if (!got) {
    setStatus(`<span class="badge bad">ไม่เจอข้อมูลสินค้า</span> หน้านี้อาจไม่ใช่หน้าสินค้า หรือโครงเปลี่ยน (ดู raw)`);
    $("card").style.display = "none";
    return;
  }

  setStatus(`<span class="badge ok">สำเร็จ</span> via <b>${r.method}</b>`);
  $("card").style.display = "block";
  $("nm").textContent = r.name || "(ไม่พบชื่อ)";
  $("pr").textContent = r.price != null ? `฿${r.price}` : "";
  $("desc").textContent = r.desc || "";
  $("imgs").innerHTML = (r.images || []).slice(0, 6)
    .map((u) => `<img src="${u}" referrerpolicy="no-referrer">`).join("");
  $("meta").innerHTML = [
    r.ids && `ID ${r.ids.shop_id}/${r.ids.item_id}`,
    r.stock != null && `stock ${r.stock}`,
    r.sold != null && `ขาย ${r.sold}`,
    r.rating != null && `★ ${Number(r.rating).toFixed(1)}`,
  ].filter(Boolean).map((t) => `<span class="chip">${t}</span>`).join("");
}

// ── Injected scraper (runs in page MAIN world) ─────────────────────
// self-contained: ห้ามอ้างตัวแปรนอก func นี้
// ponytail: Shopee adapter ก่อน, เว็บอื่นได้ og/jsonld แบบ generic.
//   ถ้าจะรองรับ Lazada/TikTok เต็ม → เพิ่ม adapter ต่อเว็บ (per-site DOM ต่างกัน)
async function scrapeProduct() {
  const out = { url: location.href, blocked: false, method: null, images: [], debug: {} };

  // anti-bot / verify page
  if (/\/verify\//.test(location.pathname)) { out.blocked = true; out.method = "blocked"; return out; }

  const meta = (n) =>
    document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content || null;

  // strategy A: Shopee PDP API (same-origin, ใช้ session จริงของหน้า)
  const m = location.pathname.match(/i\.(\d+)\.(\d+)/);
  if (m) {
    out.ids = { shop_id: m[1], item_id: m[2] };
    try {
      const r = await fetch(`/api/v4/pdp/get_pc?item_id=${m[2]}&shop_id=${m[1]}`,
        { headers: { "x-api-source": "pc", "x-shopee-language": "th" }, credentials: "include" });
      const j = await r.json();
      const d = j?.data?.item;
      if (d) {
        out.method = "shopee-api";
        out.name = d.title;
        out.price = +(d.price_min / 100000).toFixed(2);
        out.stock = d.stock; out.sold = d.historical_sold;
        out.rating = d.item_rating?.rating_star;
        out.images = (d.images || []).map((id) => `https://down-th.img.susercontent.com/file/${id}`);
        out.desc = (d.description || "").slice(0, 200);
        return out;
      }
      out.debug.api = { error: j?.error, msg: j?.error_msg };
    } catch (e) { out.debug.api = "throw:" + e.message; }
  }

  // strategy B: og-meta (เกือบทุกเว็บมี เสถียรสุด)
  const ogTitle = meta("og:title"), ogImg = meta("og:image");
  if (ogTitle || ogImg) {
    out.method = "og-meta";
    out.name = ogTitle || document.title;
    if (ogImg) out.images = [ogImg];
    out.desc = (meta("og:description") || "").slice(0, 200);
    const pa = meta("product:price:amount");
    if (pa) out.price = +pa;
  }

  // strategy C: JSON-LD Product (เติมราคา/รูปถ้า og ไม่มี)
  try {
    const lds = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } })
      .flatMap((x) => Array.isArray(x) ? x : [x]).filter(Boolean);
    const prod = lds.find((x) => /product/i.test(x?.["@type"] || ""));
    if (prod) {
      out.method = out.method ? out.method + "+jsonld" : "jsonld";
      out.name = out.name || prod.name;
      if (!out.images.length && prod.image) out.images = [].concat(prod.image);
      const offer = [].concat(prod.offers || []).find(Boolean);
      if (out.price == null && offer?.price) out.price = +offer.price;
      out.desc = out.desc || (prod.description || "").slice(0, 200);
    }
  } catch (e) { out.debug.jsonld = "throw:" + e.message; }

  // strategy D: ราคาจาก DOM (fallback หยาบ) — หาเลขที่มี ฿/บาท
  if (out.price == null) {
    const txt = document.body.innerText.slice(0, 50000);
    const mm = txt.match(/(?:฿|บาท)\s*([\d,]+(?:\.\d+)?)/) || txt.match(/([\d,]+(?:\.\d+)?)\s*บาท/);
    if (mm) { out.price = +mm[1].replace(/,/g, ""); out.method = (out.method || "") + "+dom-price"; }
  }

  if (!out.method) out.method = "none";
  return out;
}
