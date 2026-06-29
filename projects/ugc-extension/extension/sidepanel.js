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

  const imgs = r.images || [];
  renderImagePicker(imgs);

  $("meta").innerHTML = [
    r.ids && `ID ${r.ids.shop_id}/${r.ids.item_id}`,
    r.stock != null && `stock ${r.stock}`,
    r.sold != null && `ขาย ${r.sold}`,
    r.rating != null && `★ ${Number(r.rating).toFixed(1)}`,
  ].filter(Boolean).map((t) => `<span class="chip">${t}</span>`).join("");

  // คอมเมนต์/รีวิว
  const rv = r.reviews || [];
  const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  $("reviews").innerHTML = rv.length ? `
    <div class="rv-h">💬 รีวิว ${rv.length} รายการ</div>
    ${rv.slice(0, 8).map((c) => `
      <div class="rv">
        <div class="rv-top">
          <span><b>${esc(c.author) || "ผู้ใช้"}</b> <span class="rv-star">${"★".repeat(c.stars || 0)}</span></span>
          <span>${c.date || ""} · 👍 ${c.likes}</span>
        </div>
        <div class="rv-txt">${esc(c.comment)}</div>
      </div>`).join("")}` : "";
}

// ── Image picker: คลิกเลือกรูปที่จะใช้เป็น reference ───────────────
// เก็บรูปที่เลือกไว้ใน window.pcsSelectedImages เพื่อ pipeline ดึงต่อ (สเตปหน้า)
function renderImagePicker(imgs) {
  const box = $("imgs"), bar = $("selbar");
  const sel = new Set(imgs.map((_, i) => i).slice(0, 5)); // default: 5 รูปแรก (gallery จาก API)

  box.innerHTML = imgs.map((u, i) =>
    `<div class="pick${sel.has(i) ? " sel" : ""}" data-i="${i}">
       <img src="${u}" referrerpolicy="no-referrer" loading="lazy"></div>`).join("");

  const expose = () => { window.pcsSelectedImages = [...sel].sort((a, b) => a - b).map((i) => imgs[i]); };
  const paint = () => {
    [...box.children].forEach((el) => el.classList.toggle("sel", sel.has(+el.dataset.i)));
    bar.querySelector("b").textContent = sel.size;
    expose();
  };
  bar.innerHTML = `<span>🖼️ เลือก <b>${sel.size}</b>/${imgs.length} รูป</span>
    <span><button data-act="all">เลือกทั้งหมด</button> <button data-act="clr">ล้าง</button></span>`;
  bar.onclick = (e) => {
    const act = e.target.dataset.act;
    if (act === "all") imgs.forEach((_, i) => sel.add(i));
    else if (act === "clr") sel.clear();
    else return;
    paint();
  };
  box.onclick = (e) => {
    const p = e.target.closest(".pick"); if (!p) return;
    const i = +p.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i);
    paint();
  };
  expose();
}

// ── Flow: probe DOM + test-fill ────────────────────────────────────
async function injectActive(func, args = []) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("ไม่พบแท็บ");
  if (!/^https?:/.test(tab.url || "")) throw new Error("แท็บนี้ไม่ใช่หน้าเว็บ");
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id }, world: "MAIN", func, args,
  });
  return { result, tab };
}
function setF(html) { $("fstatus").innerHTML = html; }

$("probe").addEventListener("click", async () => {
  setF("⏳ กำลังตรวจ DOM...");
  try {
    const { result: r, tab } = await injectActive(probeFlow);
    $("fraw").textContent = JSON.stringify(r, null, 2);
    $("frawWrap").style.display = "block";
    if (!/labs\.google|google\.com/.test(tab.url)) {
      setF(`<span class="badge bad">ไม่ใช่หน้า Flow</span> เปิด labs.google/fx/tools/flow ก่อน (host ปัจจุบัน: ${new URL(tab.url).host})`);
      return;
    }
    const okIn = r.bestPrompt ? "✅" : "❌";
    const okBtn = r.bestGenerate ? "✅" : "❌";
    setF(`<span class="badge ${r.bestPrompt && r.bestGenerate ? "ok" : "bad"}">ผลตรวจ</span>
      ${okIn} prompt field: <b>${r.bestPrompt?.sel || "ไม่เจอ"}</b><br>
      ${okBtn} ปุ่ม generate: <b>${r.bestGenerate?.text || "ไม่เจอ"}</b><br>
      <span style="color:var(--muted)">inputs ${r.inputs.length} · buttons ตรงคำ ${r.buttons.length} · video ${r.media.videos} · loading ${r.media.loading}</span>`);
  } catch (e) {
    setF(`<span class="badge bad">ตรวจไม่ได้</span> ${e.message}`);
  }
});

$("fill").addEventListener("click", async () => {
  const sample = "A cinematic 9:16 product review by a Thai female creator holding a Bluetooth mini keyboard, warm UGC tone, vertical video";
  setF("⏳ กำลังทดสอบพิมพ์...");
  try {
    const { result: r } = await injectActive(fillFlow, [sample]);
    if (r.ok) {
      setF(`<span class="badge ok">พิมพ์สำเร็จ</span> ใส่ลง <b>${r.sel}</b> แล้ว (${r.len} ตัวอักษร) — <b>ยังไม่กด generate</b> ✋ ลองดูช่อง prompt ในหน้า Flow ว่าขึ้นข้อความไหม`);
    } else {
      setF(`<span class="badge bad">พิมพ์ไม่ได้</span> ${r.reason || "ไม่เจอช่อง prompt"} (กด "ตรวจ DOM" ดู candidates)`);
    }
  } catch (e) {
    setF(`<span class="badge bad">พิมพ์ไม่ได้</span> ${e.message}`);
  }
});

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

  // เก็บรูป "ทั้งหมด" ในหน้า: gallery + description + bg — auto-scroll โหลด lazy แล้วเลื่อนกลับ
  const cdn = /susercontent|lazcdn|alicdn|tiktokcdn/;
  const normKey = (s) => s.split("?")[0].replace(/_tn$/, "");      // ตัด query + thumbnail suffix
  const gatherAllImages = async () => {
    const map = new Map();  // normKey -> url (เก็บตัวเต็ม กันซ้ำ)
    const collect = () => {
      const og = meta("og:image"); if (og) map.set(normKey(og), og.split("?")[0]);
      document.querySelectorAll("img").forEach((i) => {
        const s = i.currentSrc || i.src || "";
        if (cdn.test(s)) { const k = normKey(s); if (!map.has(k)) map.set(k, s.split("?")[0]); }
      });
      document.querySelectorAll('[style*="background-image"]').forEach((e) => {
        const m = (e.style.backgroundImage || "").match(/url\(["']?(.*?)["']?\)/);
        if (m && cdn.test(m[1])) map.set(normKey(m[1]), m[1].split("?")[0]);
      });
    };
    const y0 = window.scrollY;
    collect();
    for (let y = 0, g = 0; y < document.body.scrollHeight && g < 60; y += 600, g++) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));   // รอ lazy-load
      collect();
    }
    window.scrollTo(0, y0);                            // คืนตำแหน่งเดิม
    collect();
    return [...map.values()];
  };
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter((u) => { const k = normKey(u); if (seen.has(k)) return false; seen.add(k); return true; });
  };
  // คอมเมนต์/รีวิวจาก Shopee ratings API (same-origin, session จริง)
  const fetchShopeeReviews = async (itemid, shopid, limit = 20) => {
    try {
      const r = await fetch(
        `/api/v4/item/get_ratings?filter=1&flag=1&itemid=${itemid}&shopid=${shopid}&type=0&offset=0&limit=${limit}`,
        { credentials: "include" });
      const j = await r.json();
      return (j?.data?.ratings || []).filter((x) => x.comment).map((x) => ({
        author: x.author_username,
        stars: x.rating_star,
        comment: x.comment.slice(0, 400),
        date: x.ctime ? new Date(x.ctime * 1000).toISOString().slice(0, 10) : null,
        likes: x.like_count || 0,
        images: (x.images || []).map((id) => `https://down-th.img.susercontent.com/file/${id}`),
      }));
    } catch (e) { return []; }
  };

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
        // รูป: API คืน hash ได้หลาย field (images[] / image / upcoming) — รวม + ทำ URL
        const hashes = [d.image, ...(d.images || [])].filter((x) => typeof x === "string");
        out.images = hashes.map((id) => `https://down-th.img.susercontent.com/file/${id}`);
        out.desc = (d.description || "").slice(0, 300);
        // รวมรูป "ทั้งหมด" ในหน้า (gallery + description) แล้ว dedup
        out.images = dedup([...out.images, ...(await gatherAllImages())]);
        out.imageCount = out.images.length;
        // คอมเมนต์/รีวิว (get_ratings API)
        out.reviews = await fetchShopeeReviews(m[2], m[1]);
        out.reviewCount = out.reviews.length;
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

  // เว็บอื่น (ไม่ผ่าน shopee-api): รวมรูปทั้งหน้าให้ครบเหมือนกัน
  out.images = dedup([...(out.images || []), ...(await gatherAllImages())]);
  out.imageCount = out.images.length;

  if (!out.method) out.method = "none";
  return out;
}

// ── Injected: probe Flow DOM (read-only) ───────────────────────────
// ค้นหา prompt field + ปุ่ม generate แบบ by-role/by-text (ทนการเปลี่ยน selector)
// ponytail: discovery > hardcode. ได้ candidates มาแล้วค่อย lock selector ทีหลัง
function probeFlow() {
  const desc = (el) => el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return (el.offsetParent !== null || getComputedStyle(el).position === "fixed")
      && r.width > 4 && r.height > 4;
  };
  const label = (el) => (el.getAttribute("placeholder") || el.getAttribute("aria-label") ||
    el.getAttribute("title") || "").slice(0, 80);

  // prompt-field candidates
  const fields = [...document.querySelectorAll(
    'textarea, [contenteditable="true"], [contenteditable=""], input[type="text"], input[type="search"], input:not([type])'
  )].filter(vis).map((el) => {
    const r = el.getBoundingClientRect();
    const lab = label(el);
    return { el, sel: desc(el), tag: el.tagName.toLowerCase(), label: lab,
      area: Math.round(r.width * r.height),
      hint: /prompt|describe|idea|generat|video|พิมพ์|บรรยาย|ไอเดีย/i.test(lab) };
  });
  fields.sort((a, b) => (b.hint - a.hint) || (b.area - a.area));
  const bestPrompt = fields[0] ? { sel: fields[0].sel, label: fields[0].label, area: fields[0].area } : null;

  // generate-button candidates (by text/aria)
  const re = /\b(generate|create|render|animate|make video)\b|สร้าง|เริ่ม|เรนเดอร์/i;
  const btns = [...document.querySelectorAll('button, [role="button"], a')].filter(vis).map((el) => {
    const t = (el.innerText || el.textContent || "").trim().slice(0, 40);
    const lab = label(el);
    return { el, sel: desc(el), text: t, label: lab,
      disabled: el.disabled || el.getAttribute("aria-disabled") === "true",
      match: (t.length < 40 && re.test(t)) || re.test(lab) };
  }).filter((b) => b.match);
  const bestGenerate = (btns.find((b) => !b.disabled) || btns[0]);

  // done-detection signals
  const media = {
    videos: document.querySelectorAll("video").length,
    loading: document.querySelectorAll('[role="progressbar"], [aria-busy="true"]').length +
      [...document.querySelectorAll("button,span,div")].filter((e) =>
        /generating|loading|processing|กำลังสร้าง|กำลังประมวล/i.test((e.innerText || "").slice(0, 30))).length,
  };

  return {
    url: location.href,
    bestPrompt,
    bestGenerate: bestGenerate ? { text: bestGenerate.text, sel: bestGenerate.sel, label: bestGenerate.label, disabled: bestGenerate.disabled } : null,
    inputs: fields.slice(0, 8).map((f) => ({ sel: f.sel, label: f.label, area: f.area, hint: f.hint })),
    buttons: btns.slice(0, 8).map((b) => ({ sel: b.sel, text: b.text, label: b.label, disabled: b.disabled })),
    media,
  };
}

// ── Injected: test-fill prompt (NO generate click) ─────────────────
function fillFlow(text) {
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    return (el.offsetParent !== null || getComputedStyle(el).position === "fixed")
      && r.width > 4 && r.height > 4;
  };
  const label = (el) => (el.getAttribute("placeholder") || el.getAttribute("aria-label") ||
    el.getAttribute("title") || "");

  const fields = [...document.querySelectorAll(
    'textarea, [contenteditable="true"], [contenteditable=""], input[type="text"], input[type="search"], input:not([type])'
  )].filter(vis).map((el) => {
    const r = el.getBoundingClientRect();
    return { el, area: r.width * r.height, hint: /prompt|describe|idea|generat|video|พิมพ์|บรรยาย|ไอเดีย/i.test(label(el)) };
  });
  fields.sort((a, b) => (b.hint - a.hint) || (b.area - a.area));
  const el = fields[0]?.el;
  if (!el) return { ok: false, reason: "ไม่เจอช่อง prompt ที่มองเห็น" };

  el.focus();
  const sel = el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "");
  try {
    if (el.isContentEditable) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
    } else {
      // React-controlled: ใช้ native setter เพื่อให้ state อัปเดต
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const got = (el.value ?? el.textContent ?? "");
    return { ok: got.includes(text.slice(0, 12)), sel, len: got.length };
  } catch (e) {
    return { ok: false, reason: e.message, sel };
  }
}
