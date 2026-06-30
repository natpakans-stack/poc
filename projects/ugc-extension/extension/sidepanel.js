// ── Side Panel controller ──────────────────────────────────────────
// กดปุ่ม → inject scraper ลง active tab (หน้าที่ user เปิดเอง) → render
// passive: ทำงานเฉพาะตอน user กด, บนหน้าที่เปิดอยู่แล้ว — ไม่ navigate เอง

const $ = (id) => document.getElementById(id);
// ── icon helper (Lucide path, inline SVG — กฏเหล็ก: ไม่ใช้ emoji) ──
const ICONS = {
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  mic: '<rect x="9" y="2" width="6" height="11" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>',
  thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
};
const ic = (n) => `<svg class="ici" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;
let selectedImages = []; // รูปที่ user ติ๊กเลือก (จาก scrape สินค้า)
let uploadedRefs = [];   // รูปใบหน้า/ลุค ที่ user อัปจากเครื่อง (data URL) — reference เพิ่ม
let lastProduct = null;  // ผล scrape ล่าสุด (ใช้สร้าง prompt)
let selectedReviews = new Set(); // index ของรีวิวที่ user ติ๊กเอาเข้า prompt

// ── อัปโหลดรูปอ้างอิง (ใบหน้า/ลุค) จากเครื่อง — แท็บพรีเซนเตอร์ ──
$("refUpload").addEventListener("click", () => $("refFile").click());
$("refFile").addEventListener("change", () => {
  [...$("refFile").files].forEach((f) => {
    const r = new FileReader();
    r.onload = () => { uploadedRefs.push(r.result); renderRefThumbs(); };
    r.readAsDataURL(f);
  });
  $("refFile").value = "";
});
function renderRefThumbs() {
  $("refThumbs").innerHTML = uploadedRefs.map((u, i) =>
    `<div class="refthumb"><img src="${u}"><button data-i="${i}" title="ลบ">×</button></div>`).join("");
  $("refThumbs").querySelectorAll("button[data-i]").forEach((b) =>
    b.addEventListener("click", () => { uploadedRefs.splice(+b.dataset.i, 1); renderRefThumbs(); }));
}

// ── viral preset gallery (แทน dropdown — เห็นภาพสไตล์) ──
// [value(prompt), ชื่อไทย, ชื่ออังกฤษ]
const VIRAL = [
  ["one continuous unbroken zoom-out starting tight on the subject, pulling back through clouds and atmosphere into outer space revealing the whole Earth, seamless dolly-out, epic scale", "ซูมออกสู่อวกาศ", "Earth Zoom Out"],
  ["one continuous zoom-in from outer space, diving through the atmosphere and clouds straight down to the subject on the ground, seamless descent, epic reveal", "ซูมจากอวกาศลงมา", "Earth Zoom In"],
  ["subject free-fall skydiving, body tumbling against rushing wind, wide aerial parachute-cam over landscape, heavy motion blur, adrenaline energy", "ตกอิสระ/สกายไดฟ์", "Free Fall"],
  ["first-person superhero flight at extreme speed, streaking through sky and clouds, intense forward motion blur, dynamic banking camera, whoosh energy", "บินความเร็วสูง", "Superfast Flight"],
  ["green monochrome night-vision goggle POV, grainy infrared, glowing hot highlights in pitch-dark surroundings, handheld found-footage", "กล้องไนท์วิชั่น", "Night Vision"],
  ["fixed overhead office CCTV surveillance footage, wide fish-eye angle, timestamp overlay, slightly choppy low frame-rate, grainy security-cam look", "กล้องวงจรปิด", "CCTV"],
  ["early-2000s paparazzi ambush, rapid harsh camera flashes, chaotic handheld, blown-out highlights, celebrity caught off-guard", "ปาปารัสซี่ Y2K", "Paparazzi"],
  ["glamorous red carpet arrival, popping camera flashes, slow confident walk toward camera, luxury event spotlight, cinematic", "เดินพรมแดง", "Red Carpet"],
  ["stylized 3D game-style hero character reveal, glowing neon cyberpunk city backdrop, rim lighting and rain reflections, dramatic title-screen 'special edition' cover look", "เมืองนีออน", "Neon City"],
  ["subject dramatically disintegrating into flying particles and embers, dissolving away in the wind, snap-effect, slow motion vfx", "สลายเป็นผง", "Disintegration"],
  ["time freezes mid-action, all motion suspended, camera orbits 360 around the frozen bullet-time moment, floating debris hangs still", "หยุดเวลา", "Frozen Time"],
  ["clean 3D CGI render reveal on a seamless studio backdrop, smooth turntable rotation, soft studio lighting, glossy product-shot quality", "3D เรนเดอร์", "3D Render"],
  ["high-speed drift racing, car sliding sideways, billowing tire smoke and sparks, low chase-cam, heavy motion blur, street-racing energy", "ดริฟต์รถซิ่ง", "Drift Racing"],
  ["casting a powerful magic spell, swirling glowing energy and sparks around the hands, particle vfx, dramatic fantasy lighting", "ร่ายเวทมนตร์", "Magic Spell"],
  ["epic cinematic fantasy scene with a massive dragon, sweeping camera, dramatic scale, atmospheric mist, blockbuster lighting", "มังกรแฟนตาซี", "Dragon"],
  ["extreme slow-motion impact moment, shockwave ripple, debris and sweat flying, ultra high frame-rate, dramatic crunch", "สโลโมชันกระแทก", "Slow-mo Impact"],
  ["dramatic transformation morph of the subject, body and outfit shifting form mid-shot, energy burst, seamless metamorphosis vfx", "แปลงร่าง", "Transformation"],
];
// preview vendored ในเครื่อง (viral/viral-N.mp4 + .webp) — ดึงมาจาก Higgsfield ครั้งเดียว ไม่พึ่ง CDN
const VIRAL_PREVIEW = VIRAL.map((_, i) => [`viral/viral-${i}.mp4`, `viral/viral-${i}.webp`]);
let viralPreset = VIRAL[0][0];
(function renderViral() {
  $("vrGrid").innerHTML = VIRAL.map((p, i) => {
    const pv = VIRAL_PREVIEW[i];
    const vis = pv
      ? `<video class="vrvid" src="${pv[0]}" poster="${pv[1]}" muted loop playsinline preload="none"></video>`
      : `<div class="vrvid" style="background:linear-gradient(135deg, oklch(0.62 0.16 ${(i * 47) % 360}), oklch(0.42 0.14 ${((i * 47) + 45) % 360}))"></div>`;
    return `<div class="vrcard${i === 0 ? " sel" : ""}" data-i="${i}">
      <div class="vrtile">${vis}<div class="vrname"><b>${p[1]}</b><span>${p[2]}</span></div></div>
    </div>`;
  }).join("");
  $("vrGrid").querySelectorAll(".vrcard").forEach((c) => {
    const vid = c.querySelector("video");
    if (vid) {
      c.addEventListener("mouseenter", () => vid.play().catch(() => {}));
      c.addEventListener("mouseleave", () => { vid.pause(); });
    }
    c.addEventListener("click", () => {
      $("vrGrid").querySelectorAll(".vrcard").forEach((x) => x.classList.remove("sel"));
      c.classList.add("sel");
      viralPreset = VIRAL[+c.dataset.i][0];
    });
  });
})();

// ── แนวเรื่อง (ละครสั้น) gallery — รูปประกอบ AI-gen ต่อแนว + fallback gradient ──
// [value(ใช้ใน prompt), ชื่อสั้น(การ์ด), prompt รูป(อังกฤษ)]
const GENRE = [
  ["ซีรีย์จีนโบราณ (ฮ่องเต้/วังหลวง)", "จีนโบราณ", "ancient chinese imperial palace, emperor in royal robes, cinematic period drama"],
  ["ซีรีย์จีนทันสมัย (CEO/โรแมนติก)", "จีนโมเดิร์น", "modern chinese CEO romance drama, elegant city skyline, cinematic"],
  ["ซีรีย์เกาหลี (โรแมนติก/ดราม่า)", "เกาหลี", "korean romance drama, soft warm cinematic, couple in seoul"],
  ["เกาหลีย้อนยุค (ซากึก/ราชวงศ์)", "เกาหลีย้อนยุค", "korean historical sageuk, hanbok, joseon royal palace, cinematic"],
  ["ซีรีย์ญี่ปุ่น (ดราม่า/ฟีลกู้ด)", "ญี่ปุ่น", "japanese feel-good slice of life drama, warm tones, tokyo street"],
  ["หนังไทย (ดราม่า/โรแมนติก)", "หนังไทย", "thai romantic drama film, cinematic warm mood"],
  ["หนังจักรๆ วงศ์ๆ (ไทยพื้นบ้านแฟนตาซี)", "จักรๆวงศ์ๆ", "thai folklore fantasy, ornate traditional costume, mythical golden"],
  ["ละครสั้นไทยตลก", "ตลก", "thai comedy sitcom, funny colorful vibrant scene"],
  ["ละครไทบ้าน (อีสาน/ชนบท)", "ไทบ้าน", "thai isan rural countryside village life, warm rustic"],
  ["สยองขวัญ/ผี (ไทย)", "ผีสยอง", "thai horror ghost film, dark eerie moody atmosphere"],
];
let seriesGenre = GENRE[0][0];
(function renderGenre() {
  $("srGrid").innerHTML = GENRE.map((g, i) => {
    const url = `genres/genre-${i}.jpg`; // รูป vendored (square) → object-fit:cover crop ไม่บีบ
    return `<div class="vrcard${i === 0 ? " sel" : ""}" data-i="${i}">
      <div class="vrtile"><img class="vrvid" data-h="${(i * 53) % 360}" src="${url}" loading="lazy" referrerpolicy="no-referrer"><div class="vrname"><b>${g[1]}</b></div></div></div>`;
  }).join("");
  $("srGrid").querySelectorAll(".vrcard").forEach((c) => {
    const img = c.querySelector("img");
    img.addEventListener("error", () => {            // โหลดรูปไม่ได้ → gradient (inline handler โดน CSP บล็อก เลยผูกที่นี่)
      const h = +img.dataset.h;
      img.style.display = "none";
      img.parentNode.style.background = `linear-gradient(135deg, oklch(0.55 0.16 ${h}), oklch(0.4 0.14 ${(h + 40) % 360}))`;
    });
    c.addEventListener("click", () => {
      $("srGrid").querySelectorAll(".vrcard").forEach((x) => x.classList.remove("sel"));
      c.classList.add("sel");
      seriesGenre = GENRE[+c.dataset.i][0];
    });
  });
})();

$("go").addEventListener("click", async () => {
  const btn = $("go");
  btn.disabled = true;
  setStatus("กำลังอ่านหน้า...");
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

// แก้ช่องสินค้าเอง → sync เข้า lastProduct (storyboard/prompt ใช้ค่าที่กรอก) — ไม่ตันแม้ scrape ไม่ครบ
const ensureProduct = () => (lastProduct ||= { manual: true, images: [], reviews: [] });
$("nm").addEventListener("input", () => { ensureProduct().name = $("nm").value.trim(); });
$("desc").addEventListener("input", () => { ensureProduct().desc = $("desc").value.trim(); });
$("pr").addEventListener("input", () => {
  const n = parseFloat($("pr").value.replace(/[^0-9.]/g, ""));
  ensureProduct().price = isNaN(n) ? null : n;
});

function render(r) {
  $("raw").textContent = JSON.stringify(r, null, 2);
  $("rawWrap").style.display = "block";

  if (!r) { setStatus(`<span class="badge bad">ไม่มีข้อมูลกลับมา</span>`); return; }
  if (r.blocked) {
    setStatus(`<span class="badge bad">หน้านี้กำลังให้ยืนยันตัวตน</span> เลื่อนดูสินค้าในหน้าเองสักครู่ แล้วกดดึงใหม่`);
    $("card").style.display = "none";
    return;
  }
  // แสดง card เสมอ (แก้ไขได้) — auto ดึงไม่ครบ ก็กรอกเองต่อได้ ไม่ตัน
  lastProduct = r;
  $("card").style.display = "block";
  $("nm").value = r.name || "";
  $("pr").value = r.price != null ? `฿${r.price}` : "";
  $("desc").value = r.desc || "";
  const got = r.name || r.price || (r.images && r.images.length);
  setStatus(got
    ? `<span class="badge ok">ดึงข้อมูลสำเร็จ</span> แก้ไขช่องด้านล่างได้`
    : `<span class="badge bad">ดึงอัตโนมัติไม่ได้</span> กรอกชื่อ/ราคา/รูปเองได้เลย`);

  const imgs = r.images || [];
  renderImagePicker(imgs);

  $("meta").innerHTML = [
    r.ids && `ID ${r.ids.shop_id}/${r.ids.item_id}`,
    r.stock != null && `stock ${r.stock}`,
    r.sold != null && `ขาย ${r.sold}`,
    r.rating != null && `★ ${Number(r.rating).toFixed(1)}`,
  ].filter(Boolean).map((t) => `<span class="chip">${t}</span>`).join("");

  // คอมเมนต์/รีวิว — ติ๊กเลือกได้ว่าจะเอาอันไหนเข้า prompt (default 3 อันแรก)
  const rv = (r.reviews || []).slice(0, 8);
  selectedReviews = new Set(rv.map((_, i) => i).slice(0, 3));
  const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  $("reviews").innerHTML = rv.length ? `
    <div class="rv-h">${ic("message")}รีวิว ${rv.length} รายการ — ติ๊กอันที่อยากใช้</div>
    ${rv.map((c, i) => `
      <label class="rv${selectedReviews.has(i) ? " sel" : ""}" data-i="${i}">
        <div class="rv-top">
          <span><input type="checkbox" class="rv-ck" data-i="${i}"${selectedReviews.has(i) ? " checked" : ""}> <b>${esc(c.author) || "ผู้ใช้"}</b> <span class="rv-star">${"★".repeat(c.stars || 0)}</span></span>
          <span>${c.date || ""} · ${ic("thumb")}${c.likes}</span>
        </div>
        <div class="rv-txt">${esc(c.comment)}</div>
      </label>`).join("")}` : "";
  $("reviews").querySelectorAll(".rv-ck").forEach((ck) =>
    ck.addEventListener("change", () => {
      const i = +ck.dataset.i;
      ck.checked ? selectedReviews.add(i) : selectedReviews.delete(i);
      ck.closest(".rv").classList.toggle("sel", ck.checked);
    }));
}

// ── Image picker: คลิกเลือกรูปที่จะใช้เป็น reference ───────────────
// เก็บรูปที่เลือกไว้ใน window.pcsSelectedImages เพื่อ pipeline ดึงต่อ (สเตปหน้า)
function renderImagePicker(imgs) {
  const box = $("imgs"), bar = $("selbar");
  const sel = new Set(imgs.map((_, i) => i).slice(0, 5)); // default: 5 รูปแรก (gallery จาก API)

  box.innerHTML = imgs.map((u, i) =>
    `<div class="pick${sel.has(i) ? " sel" : ""}" data-i="${i}">
       <img src="${u}" referrerpolicy="no-referrer" loading="lazy"></div>`).join("");

  const expose = () => { selectedImages = [...sel].sort((a, b) => a - b).map((i) => imgs[i]); window.pcsSelectedImages = selectedImages; };
  const paint = () => {
    [...box.children].forEach((el) => el.classList.toggle("sel", sel.has(+el.dataset.i)));
    bar.querySelector("b").textContent = sel.size;
    expose();
  };
  bar.innerHTML = `<span>${ic("image")}เลือก <b>${sel.size}</b>/${imgs.length} รูป</span>
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

// ── Tabs ───────────────────────────────────────────────────────────
document.querySelectorAll(".tab[data-tab]").forEach((t) =>
  t.addEventListener("click", () => switchTab(t.dataset.tab)));
function switchTab(name) {
  document.querySelectorAll(".tab[data-tab]").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === `tab-${name}`));
  $("shared").style.display = name === "settings" ? "none" : "block"; // ซ่อน executor/results ในแท็บตั้งค่า
  $("setdock").style.display = name === "settings" ? "" : "none";     // โชว์ปุ่มบันทึก (footer) เฉพาะตั้งค่า
}
function setG(html) { $("genstatus").innerHTML = html; }

// ── 3 โหมด gen prompt (ตัวตน/สินค้า/ซีรีย์) ผ่าน system prompt เฉพาะโหมด → cards ────
const schema = (lang, dlgMax, textOverlay) => `Return STRICT JSON {"items":[{"label":"2-4 word label","video_prompt":"...","dialogue":"..."}]}.
- video_prompt: ENGLISH, vivid cinematic for Veo (camera/shot/action/lighting/mood), vertical 9:16.${
  textOverlay === true ? `\n- ALSO embed a short punchy ${lang === "en" ? "English" : "Thai"} on-screen caption/hook as TEXT OVERLAY, described inside video_prompt.`
  : textOverlay === false ? `\n- NO on-screen text or captions anywhere in frame.` : ""}
- dialogue: spoken line in ${lang === "en" ? "English" : "Thai"}, conversational, <= ${dlgMax} words.`;
async function callGen(system, user) {
  const key = $("apikey").value.trim();
  if (!key) { switchTab("settings"); setG(`<span class="badge bad">ใส่คีย์ AI ก่อน</span> ไปที่แท็บ ตั้งค่า`); return null; }
  setG("กำลังสร้างฉาก...");
  const resp = await chrome.runtime.sendMessage({
    type: "genLLM", apiKey: key, provider: $("provider").value, model: $("model").value.trim(), system, user,
  });
  if (!resp?.ok) { setG(`<span class="badge bad">สร้างไม่ได้</span> ${resp?.error || "?"}`); return null; }
  let items;
  try { items = JSON.parse(resp.content).items; } catch { setG(`<span class="badge bad">parse JSON ไม่ได้</span>`); return null; }
  if (!Array.isArray(items) || !items.length) { setG(`<span class="badge bad">ไม่ได้ผลลัพธ์</span>`); return null; }
  return items;
}
function showCards(items, label) {
  renderCards(items);
  $("autoqueue").style.display = "block";
  setG(`<span class="badge ok">${label}</span> ส่งทีละฉาก หรือกดสร้างทั้งหมด (ด้านล่าง) — เปิดแท็บ Flow ก่อน`);
}

$("genIdentity").addEventListener("click", async () => {
  const n = +$("idCount").value, lang = $("lang").value;
  const system = `You are a UGC video prompt director for Google Flow (Veo), Thai market.
Generate EXACTLY ${n} distinct vertical 9:16 video prompts for ONE consistent Thai content creator (same gender/skin/look every item), in the given theme. Each item = a DIFFERENT shot/moment of that creator talking to camera.
${schema(lang, 14, $("idText").checked)}`;
  const user = `Creator: ${$("idName").value || "Thai creator"}\nGender: ${$("idGender").value}\nSkin: ${$("idSkin").value}\nTheme/setting: ${$("idTheme").value}\nExtra: ${$("idDetails").value}\nText overlay: ${$("idText").checked ? "yes" : "no"}\nCount: ${n}`;
  const items = await callGen(system, user);
  if (items) showCards(items, `พรีเซนเตอร์ ${items.length} ชุด`);
});

$("genProduct").addEventListener("click", async () => {
  if (!lastProduct || (!lastProduct.name && !lastProduct.desc)) {
    switchTab("product"); setG(`<span class="badge bad">ยังไม่มีข้อมูลสินค้า</span> ดึง/กรอกในแท็บ สินค้า ก่อน`); return;
  }
  const n = +$("pdCount").value, lang = $("lang").value;
  const system = `You are a UGC product-review prompt director for Google Flow (Veo), Thai market.
Generate EXACTLY ${n} distinct vertical 9:16 video prompts reviewing the product. The REAL product appears; each item a DIFFERENT shot. Use only real facts from details/reviews.
EVERY prompt MUST strictly obey this shot directive (it defines the style/angle — do not deviate): ${$("pdAngle").value}.
${schema(lang, 14, $("pdText").checked)}`;
  const reviews = lastProduct.reviews || [];
  const pickedReviews = [...selectedReviews].sort((a, b) => a - b).map((i) => reviews[i]?.comment).filter(Boolean);
  const user = `Product: ${lastProduct.name || ""}\nDetails: ${(lastProduct.desc || "").slice(0, 600)}\nReviews: ${pickedReviews.map((c) => `"${c}"`).join(" ") || "(none)"}\nShot directive: ${$("pdAngle").value}\nText overlay: ${$("pdText").checked ? "yes" : "no"}\nCount: ${n}`;
  const items = await callGen(system, user);
  if (items) showCards(items, `สินค้า ${items.length} ชุด`);
});

$("genSeries").addEventListener("click", async () => {
  const n = +$("srScenes").value, lang = $("lang").value;
  const system = `You are a short-drama series director for Google Flow (Veo).
Generate a CONNECTED ${n}-scene vertical 9:16 story in genre "${seriesGenre}", with the SAME protagonist(s) (consistent face/look) in EVERY scene. Continuous narrative arc across scenes.
${schema(lang, 21)} label = scene beat.`;
  const user = `Genre: ${seriesGenre}\nScenes: ${n}\nMain characters: ${$("srChars").value}\nLead gender: ${$("srGender").value}\nSkin: ${$("srSkin").value}\nStory: ${$("srStory").value || "(AI decides a compelling arc)"}`;
  const items = await callGen(system, user);
  if (items) showCards(items, `ละครสั้น ${items.length} ฉาก`);
});

$("genViral").addEventListener("click", async () => {
  const n = +$("vrCount").value, lang = $("lang").value;
  const subject = $("vrSubject").value.trim() || (lastProduct?.name || "the subject");
  const effect = viralPreset;
  const system = `You are a viral short-video prompt director for Google Flow (Veo).
Apply the viral video effect/style: "${effect}" to the subject. Generate EXACTLY ${n} vertical 9:16 Veo prompts that showcase this effect DRAMATICALLY — scroll-stopping, high-energy, trend-worthy. The subject appears clearly. Each item a distinct beat/angle of the effect.
${schema(lang, 12)}`;
  const user = `Subject: ${subject}\nViral effect: ${effect}\nCount: ${n}`;
  const items = await callGen(system, user);
  if (items) showCards(items, `ไวรัล ${items.length} ชุด`);
});

// LLM key/provider/model (เก็บใน chrome.storage.local) — รองรับ OpenAI + DeepSeek
const KEY_FIELD = { openai: "openai_key", deepseek: "deepseek_key" };
if (globalThis.chrome?.storage) {
  chrome.storage.local.get(["llm_provider", "openai_key", "deepseek_key", "llm_model", "lang"]).then((s) => {
    const p = s.llm_provider || "openai";
    $("provider").value = p;
    $("apikey").value = s[KEY_FIELD[p]] || "";
    $("model").value = s.llm_model || "";
    if (s.lang) $("lang").value = s.lang;            // ภาษาพากย์ต้องคงค่าที่ user เลือก ไม่งั้น gen ผิดภาษาเงียบๆ
    resyncSelects();
  });
}
$("provider").addEventListener("change", async () => {
  const s = await chrome.storage.local.get(["openai_key", "deepseek_key"]);
  $("apikey").value = s[KEY_FIELD[$("provider").value]] || "";
  $("model").value = "";                             // ล้าง model กัน gpt-4o ค้างไปยิง endpoint deepseek (400)
  resyncSelects();
});
$("keysave").addEventListener("click", () => {
  chrome.storage.local.set({
    llm_provider: $("provider").value,
    [KEY_FIELD[$("provider").value]]: $("apikey").value.trim(),
    llm_model: $("model").value.trim(),
    lang: $("lang").value,
  });
  $("keysave").textContent = "บันทึกแล้ว ✓";
  setTimeout(() => { $("keysave").textContent = "บันทึกการตั้งค่า"; }, 1500);
});
// helper: พิมพ์ข้อความเข้า Flow (ใช้ทั้งปุ่มเดี่ยว + ปุ่มรายซีน) — คืน tabId เผื่อ re-probe
async function typeToFlow(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/labs\.google|google\.com/.test(tab?.url || "")) return { ok: false, error: "สลับไปแท็บ Flow ก่อน" };
  const resp = await chrome.runtime.sendMessage({ type: "typeInFlow", tabId: tab.id, text });
  return resp?.ok ? { ok: true, tabId: tab.id } : { ok: false, error: resp?.error || "?" };
}

//  Auto scene-queue: วน type → generate → รอเสร็จ → กด + → ซีนถัดไป (เปลืองเครดิตหลายเครดิต!)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitGenerateDone(tabId, baselineVideos, timeoutMs) {
  const start = Date.now(); let wasBusy = false;
  while (Date.now() - start < timeoutMs) {
    await sleep(4000);
    const s = await chrome.runtime.sendMessage({ type: "flowState", tabId });
    if (!s) continue;
    if (s.busy > 0) wasBusy = true;
    if (s.videos > baselineVideos) return true;                          // มี clip ใหม่ = เสร็จ
    if (wasBusy && s.busy === 0 && Date.now() - start > 10000) return true; // เคยประมวลผลแล้วหยุด
  }
  return false;
}
$("autoqueue").addEventListener("click", async () => {
  const tas = [...$("cards").querySelectorAll("textarea[data-i]")].filter((t) => t.value.trim());
  if (!tas.length) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/labs\.google|google\.com/.test(tab?.url || "")) {
    setF(`<span class="badge bad">ไม่ใช่หน้า Flow</span> สลับไปแท็บ Flow ก่อน`); return;
  }
  $("autoqueue").disabled = true;
  try {
    for (let i = 0; i < tas.length; i++) {
      const text = tas[i].value.trim();
      setF(`ฉาก ${i + 1}/${tas.length}: กำลังส่ง...`);
      const t = await chrome.runtime.sendMessage({ type: "typeInFlow", tabId: tab.id, text });
      if (!t?.ok) { setF(`<span class="badge bad">ฉาก ${i + 1}: ส่งไม่ได้</span> ${t?.error}`); return; }
      await sleep(600);
      const base = (await chrome.runtime.sendMessage({ type: "flowState", tabId: tab.id }))?.videos ?? 0;
      setF(`ฉาก ${i + 1}/${tas.length}: กำลังสั่งสร้าง...`);
      const g = await chrome.runtime.sendMessage({ type: "clickGenerate", tabId: tab.id });
      if (!g?.ok) { setF(`<span class="badge bad">ฉาก ${i + 1}: สั่งสร้างไม่ได้</span> ${g?.error}`); return; }
      setF(`ฉาก ${i + 1}/${tas.length}: กำลังสร้างวิดีโอ... (สูงสุด 4 นาที)`);
      const done = await waitGenerateDone(tab.id, base, 240000);
      if (!done) { setF(`<span class="badge bad">ฉาก ${i + 1}: รอเกินเวลา</span> เช็คหน้า Flow แล้วทำต่อเอง`); return; }
      if (i < tas.length - 1) {
        setF(`เพิ่มฉาก ${i + 2}...`);
        await chrome.runtime.sendMessage({ type: "clickAdd", tabId: tab.id });
        await sleep(1500);
      }
    }
    setF(`<span class="badge ok">สร้างครบ ${tas.length} ฉาก</span> ดูผลในหน้า Flow แล้วโหลดเอง`);
  } finally { $("autoqueue").disabled = false; }
});

function renderCards(items) {
  const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  $("cards").innerHTML = items.map((s, i) => `
    <div class="scene">
      <div class="scene-h"><b>${i + 1} · ${esc(s.label || s.shot || "")}</b><button data-i="${i}">${ic("keyboard")}ส่งฉากนี้</button></div>
      <textarea data-i="${i}" rows="3">${esc(s.video_prompt || s.prompt || "")}</textarea>
      ${s.dialogue ? `<div class="dlg">${ic("mic")}${esc(s.dialogue)}</div>` : ""}
    </div>`).join("");
  $("cards").querySelectorAll("button[data-i]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = btn.dataset.i;
      const ta = $("cards").querySelector(`textarea[data-i="${i}"]`);
      setF(`กำลังส่งฉาก ${+i + 1}...`);
      const r = await typeToFlow(ta.value.trim());
      setF(r.ok
        ? `<span class="badge ok">ส่งฉาก ${+i + 1} แล้ว</span> กดสร้างวิดีโอ → รอเสร็จ → เพิ่มฉากใน Flow → ส่งฉากถัดไป`
        : `<span class="badge bad">ส่งไม่ได้</span> ${r.error}`);
    });
  });
}

$("probe").addEventListener("click", async () => {
  setF("กำลังเช็คการเชื่อมต่อ...");
  try {
    const { result: r, tab } = await injectActive(probeFlow);
    $("fraw").textContent = JSON.stringify(r, null, 2);
    $("frawWrap").style.display = "block";
    if (!/labs\.google|google\.com/.test(tab.url)) {
      setF(`<span class="badge bad">ยังไม่ได้เปิดหน้า Flow</span> เปิด Google Flow ในอีกแท็บก่อน แล้วกดใหม่`);
      return;
    }
    const ok = r.bestPrompt && r.bestGenerate;
    setF(`<span class="badge ${ok ? "ok" : "bad"}">${ok ? "เชื่อมต่อ Flow ได้" : "ยังเชื่อมไม่ได้"}</span>
      ${r.bestPrompt ? "พบช่องพิมพ์ ✓" : "ไม่พบช่องพิมพ์ ✗"} · ${r.bestGenerate ? "พบปุ่มสร้าง ✓" : "ไม่พบปุ่มสร้าง ✗"}`);
  } catch (e) {
    setF(`<span class="badge bad">เช็คไม่ได้</span> ${e.message}`);
  }
});

// ── Flow: ส่งรูปที่เลือก เข้า Flow เป็น reference ──────────
// background fetch bytes (เลี่ยง CORS) → ส่ง data URL → ประกอบ File ในหน้า Flow → ส่ง file input
$("injimg").addEventListener("click", async () => {
  try {
    const urls = [...uploadedRefs, ...selectedImages]; // รูปอัปจากเครื่อง + รูป scrape
    if (!urls.length) {
      setF(`<span class="badge bad">ยังไม่มีรูป</span> อัปรูป (แท็บพรีเซนเตอร์) หรือเลือกรูป (แท็บสินค้า) ก่อน`);
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/labs\.google|google\.com/.test(tab?.url || "")) {
      setF(`<span class="badge bad">ยังไม่ได้เปิดหน้า Flow</span> สลับไปแท็บ Flow ก่อน (รูปที่เลือกยังอยู่)`);
      return;
    }
    let injected = 0, failed = 0;
    // วนส่งทีละรูป + เว้นจังหวะให้ Flow รับ (re-query input ใหม่ทุกรอบในตัว inject)
    for (let i = 0; i < urls.length; i++) {
      setF(`ส่งรูป ${i + 1}/${urls.length}... (สำเร็จ ${injected})`);
      let dataUrl;
      if (urls[i].startsWith("data:")) dataUrl = urls[i];           // รูปอัปจากเครื่อง — ใช้ตรง
      else { const resp = await chrome.runtime.sendMessage({ type: "fetchImage", url: urls[i] }); // รูป URL — fetch ผ่าน bg เลี่ยง CORS
        if (!resp?.ok) { failed++; continue; } dataUrl = resp.dataUrl; }
      const [{ result: r } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, world: "MAIN", func: injectImageToFlow,
        args: [{ dataUrl, filename: `ref-${i + 1}.jpg` }],
      });
      if (r?.ok) injected++; else failed++;
      await new Promise((res) => setTimeout(res, 700)); // ให้ Flow ประมวลผลก่อนรูปถัดไป
    }
    setF(`<span class="badge ${injected ? "ok" : "bad"}">ส่งรูปแล้ว <b>${injected}</b>/${urls.length}</span>${failed ? ` · ไม่สำเร็จ ${failed}` : ""}
      <br>ดูที่ Flow ว่ารูปขึ้นครบไหม — Flow มักรับรูปอ้างอิงสูงสุด ~3 รูป`);
  } catch (e) { setF(`<span class="badge bad">ผิดพลาด</span> ${e.message}`); }
});

// กด Create (generate จริง) — ยิงเฉพาะปุ่ม arrow_forward ที่ enabled (ไม่แตะปุ่ม +)
$("gen").addEventListener("click", async () => {
  setF("กำลังสั่งสร้าง...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/labs\.google|google\.com/.test(tab?.url || "")) {
      setF(`<span class="badge bad">ยังไม่ได้เปิดหน้า Flow</span> สลับไปแท็บ Flow ก่อน`); return;
    }
    const resp = await chrome.runtime.sendMessage({ type: "clickGenerate", tabId: tab.id });
    setF(resp?.ok
      ? `<span class="badge ok">สั่งสร้างแล้ว</span> Flow กำลังสร้างวิดีโอ — รอในหน้า Flow แล้วโหลดคลิปเอง`
      : `<span class="badge bad">สั่งสร้างไม่ได้</span> ${resp?.error || "?"}`);
  } catch (e) { setF(`<span class="badge bad">ผิดพลาด</span> ${e.message}`); }
});

// injected: ประกอบ File จาก data URL แล้วส่งเข้า file input / drop ของ Flow
async function injectImageToFlow(arg) {
  try {
    const blob = await (await fetch(arg.dataUrl)).blob(); // data: URL ไม่ติด CORS
    const file = new File([blob], arg.filename, { type: blob.type || "image/jpeg" });
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    if (inputs.length) {
      const input = inputs.find((i) => !i.disabled) || inputs[0];
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return { ok: true, method: "file-input", fileInputs: inputs.length };
    }
    // fallback: simulate drop บนช่อง prompt/เพจ
    const drop = document.querySelector('[contenteditable=""],[contenteditable="true"]') || document.body;
    const dt = new DataTransfer();
    dt.items.add(file);
    const rc = drop.getBoundingClientRect();
    const opts = { bubbles: true, cancelable: true, composed: true, dataTransfer: dt,
      clientX: rc.left + rc.width / 2, clientY: rc.top + rc.height / 2 };
    for (const t of ["dragenter", "dragover", "drop"]) drop.dispatchEvent(new DragEvent(t, opts));
    return { ok: true, method: "drop(fallback)", fileInputs: 0 };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ── Custom dropdown (แทน native <select>) — เก็บ select เป็น state, overlay UI ของเรา ──
const _csSyncs = [];
function resyncSelects() { _csSyncs.forEach((f) => f()); }
function buildCustom(sel) {
  if (sel.dataset.cs) return; sel.dataset.cs = "1";
  const opts = [...sel.options];
  const wrap = document.createElement("div"); wrap.className = "cs";
  const btn = document.createElement("button"); btn.type = "button"; btn.className = "cs-btn";
  btn.innerHTML = '<span class="cs-val"></span><span class="cs-cv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>';
  const list = document.createElement("div"); list.className = "cs-list"; list.setAttribute("role", "listbox");
  let active = -1;
  const sync = () => {
    btn.querySelector(".cs-val").textContent = sel.options[sel.selectedIndex]?.text || "";
    [...list.children].forEach((li, i) => li.classList.toggle("on", i === sel.selectedIndex));
  };
  _csSyncs.push(sync);
  const setActive = (i) => {
    active = Math.max(0, Math.min(opts.length - 1, i));
    [...list.children].forEach((li, j) => li.classList.toggle("active", j === active));
    list.children[active]?.scrollIntoView({ block: "nearest" });
  };
  const choose = (i) => { sel.selectedIndex = i; sel.dispatchEvent(new Event("change", { bubbles: true })); sync(); close(); btn.focus(); };
  const open = () => {
    document.querySelectorAll(".cs.open").forEach((c) => c.classList.remove("open", "up"));
    const r = btn.getBoundingClientRect();
    if (window.innerHeight - r.bottom < 240 && r.top > 240) wrap.classList.add("up"); // เปิดขึ้นบนถ้าใกล้ขอบล่าง
    wrap.classList.add("open");
    setActive(sel.selectedIndex >= 0 ? sel.selectedIndex : 0);
  };
  const close = () => wrap.classList.remove("open", "up");
  opts.forEach((o, i) => {
    const li = document.createElement("div"); li.className = "cs-opt"; li.textContent = o.text; li.setAttribute("role", "option");
    li.addEventListener("click", () => choose(i));
    li.addEventListener("mousemove", () => setActive(i));
    list.appendChild(li);
  });
  btn.addEventListener("click", (e) => { e.stopPropagation(); wrap.classList.contains("open") ? close() : open(); });
  btn.addEventListener("keydown", (e) => {
    if (!wrap.classList.contains("open")) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); open(); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(active); }
    else if (e.key === "Escape" || e.key === "Tab") { close(); }
  });
  sel.style.display = "none";
  sel.parentNode.insertBefore(wrap, sel);
  wrap.append(sel, btn, list);
  sel.addEventListener("change", sync);
  sync();
}
document.addEventListener("click", () => document.querySelectorAll(".cs.open").forEach((c) => c.classList.remove("open", "up")));

// fixed footer (flowdock) → เว้น padding ล่างของ body เท่าความสูง dock (วัดอัตโนมัติ)
if (window.ResizeObserver) {
  const docks = [$("flowdock"), $("setdock")];      // footer ที่โชว์อยู่ตัวเดียว อีกตัว height 0
  const ro = new ResizeObserver(() => {
    const h = docks.reduce((s, d) => s + (d.offsetHeight || 0), 0);
    document.body.style.paddingBottom = (h ? h + 4 : 0) + "px";
  });
  docks.forEach((d) => ro.observe(d));
}
document.querySelectorAll("select.psel").forEach(buildCustom);

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

  // เก็บรูป "ทั้งหมด" ในหน้า (ทุกเว็บ): img + bg ที่ใหญ่พอ (ตัด icon/logo) — auto-scroll โหลด lazy
  const normKey = (s) => s.split("?")[0].replace(/_tn$/, "");      // ตัด query + thumbnail suffix (shopee)
  const okImg = (s) => /^https?:\/\//.test(s) && !/\.svg(\?|$)/i.test(s);
  const gatherAllImages = async () => {
    const map = new Map();  // normKey -> url (เก็บตัวเต็ม กันซ้ำ)
    const collect = () => {
      const og = meta("og:image"); if (og && okImg(og)) map.set(normKey(og), og.split("?")[0]);
      document.querySelectorAll("img").forEach((i) => {
        const s = i.currentSrc || i.src || "";
        if (!okImg(s)) return;
        const big = (i.naturalWidth || 0) >= 100 || i.getBoundingClientRect().width >= 100; // ตัด icon เล็ก
        if (big) { const k = normKey(s); if (!map.has(k)) map.set(k, s.split("?")[0]); }
      });
      document.querySelectorAll('[style*="background-image"]').forEach((e) => {
        const m = (e.style.backgroundImage || "").match(/url\(["']?(.*?)["']?\)/);
        if (!m || !okImg(m[1])) return;
        const r = e.getBoundingClientRect();
        if (r.width >= 100 || r.height >= 100) map.set(normKey(m[1]), m[1].split("?")[0]);
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

  // strategy B: og-meta (เกือบทุกเว็บมี)
  const ogTitle = meta("og:title"), ogImg = meta("og:image");
  if (ogTitle || ogImg) {
    out.method = "og-meta";
    out._og = ogTitle;
    if (ogImg) out.images = [ogImg];
    out.desc = (meta("og:description") || "").slice(0, 200);
    const pa = meta("product:price:amount");
    if (pa) out.price = +pa;
  }

  // strategy C: JSON-LD Product (รองรับ @graph ของ Yoast/WooCommerce + ราคาหลายรูปแบบ)
  try {
    const raw = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } })
      .flatMap((x) => Array.isArray(x) ? x : [x]).filter(Boolean);
    const flat = raw.flatMap((x) => Array.isArray(x?.["@graph"]) ? x["@graph"] : [x]); // กาง @graph
    const prod = flat.find((x) => /product/i.test([].concat(x?.["@type"] || "").join(" ")));
    if (prod) {
      out.method = out.method ? out.method + "+jsonld" : "jsonld";
      out._ld = prod.name;
      if (prod.image) {
        const imgs = [].concat(prod.image).map((im) => typeof im === "string" ? im : im?.url).filter(Boolean);
        out.images = [...out.images, ...imgs];
      }
      const offer = [].concat(prod.offers || []).find(Boolean);
      const price = offer?.price ?? offer?.priceSpecification?.price ?? offer?.lowPrice;
      if (out.price == null && price != null) out.price = +price;
      out.desc = out.desc || (prod.description || "").slice(0, 300);
    }
  } catch (e) { out.debug.jsonld = "throw:" + e.message; }

  // strategy C2: __NEXT_DATA__ / __NUXT__ — Next.js/Nuxt ฝัง product ใน JSON (Lotus's/BigC ฯลฯ)
  if (out.price == null || !out._ld) {
    try {
      const el = document.getElementById("__NEXT_DATA__");
      let root = null;
      if (el) { try { root = JSON.parse(el.textContent); } catch {} }
      if (!root && window.__NUXT__) root = window.__NUXT__;
      if (root) {
        const PRICE = /^(price|sellprice|saleprice|finalprice|priceincvat|unitprice|special_?price|min_?price|current_?price)$/i;
        const NAME = /^(name|title|productname|product_name|displayname)$/i;
        const seen = new Set();
        let found = null;
        const walk = (o, d) => {
          if (found || !o || typeof o !== "object" || d > 8 || seen.has(o)) return;
          seen.add(o);
          let nm = null, pr = null, img = null;
          for (const k in o) {
            const v = o[k];
            if (!nm && typeof v === "string" && NAME.test(k) && v.length >= 5 && v.length <= 150) nm = v;
            if (pr == null && PRICE.test(k) && (typeof v === "number" || (typeof v === "string" && /^[0-9.]+$/.test(v)))) { const n = +v; if (n > 0) pr = n; }
            if (!img && typeof v === "string" && /image|thumb|cover|photo/i.test(k) && /^https?:/.test(v)) img = v;
          }
          if (nm && pr != null) { found = { name: nm, price: pr, image: img }; return; }
          for (const k in o) if (o[k] && typeof o[k] === "object") { walk(o[k], d + 1); if (found) return; }
        };
        walk(root, 0);
        if (found) {
          out.method = out.method ? out.method + "+nextdata" : "nextdata";
          if (!out._ld && found.name) out._ld = found.name;
          if (out.price == null) out.price = found.price;
          if (found.image) out.images = [...out.images, found.image];
        }
      }
    } catch (e) { out.debug.nextdata = "throw:" + e.message; }
  }

  // strategy D: ราคาจาก DOM (fallback หยาบ) — หาเลขที่มี ฿/บาท
  if (out.price == null) {
    const txt = document.body.innerText.slice(0, 50000);
    const mm = txt.match(/(?:฿|บาท)\s*([\d,]+(?:\.\d+)?)/) || txt.match(/([\d,]+(?:\.\d+)?)\s*บาท/);
    if (mm) { out.price = +mm[1].replace(/,/g, ""); out.method = (out.method || "") + "+dom-price"; }
  }

  // เลือกชื่อ: JSON-LD > h1 (ดีกับ SPA ที่ og เป็น homepage) > og > document.title
  const h1 = [...document.querySelectorAll("h1")].map((h) => (h.innerText || "").trim())
    .find((t) => t.length >= 5 && t.length <= 120);
  let nm = out._ld || h1 || out._og || document.title;
  // ตัด suffix " | ชื่อเว็บ" ออก — เทียบกับ og:site_name หรือชื่อ domain (เช่น lazada/thaimart)
  // ตัดเฉพาะ segment สุดท้ายที่ match เว็บ → ปลอดภัย ไม่โดนชื่อสินค้าที่มี - คั่น
  if (nm) {
    const site = (meta("og:site_name") || "").trim().toLowerCase();
    const host = location.hostname.replace(/^www\./, "").split(".")[0].toLowerCase(); // lazada, thaimart...
    const parts = nm.split(/\s+[|–—·]\s+|\s+-\s+/);
    if (parts.length > 1) {
      const last = parts[parts.length - 1].trim().toLowerCase();
      if ((host && last.includes(host)) || (site && last === site))
        nm = parts.slice(0, -1).join(" - ").trim();
    }
  }
  out.name = nm;
  delete out._ld; delete out._og;

  // เว็บอื่น (ไม่ผ่าน shopee-api): รวมรูปทั้งหน้าให้ครบเหมือนกัน
  out.images = dedup([...(out.images || []), ...(await gatherAllImages())]);
  out.imageCount = out.images.length;

  if (!out.method) out.method = "none";
  return out;
}

// ── Injected: probe Flow DOM (read-only) ───────────────────────────
// strategy: ช่อง prompt = field ที่ "ใกล้ปุ่ม generate ที่สุด" + ตัด search ทิ้ง
//   (Flow: ช่อง prompt ติดปุ่ม Create, search อยู่บนสุด)
function probeFlow() {
  const desc = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");
  const vis = (el) => { const r = el.getBoundingClientRect();
    return (el.offsetParent !== null || getComputedStyle(el).position === "fixed") && r.width > 4 && r.height > 4; };
  const attrs = (el) => ((el.getAttribute("placeholder") || "") + " " + (el.getAttribute("aria-label") || "") + " " +
    (el.getAttribute("title") || "") + " " + (el.type || "")).toLowerCase();
  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const reGen = /\b(create|generate|render|animate)\b|สร้าง|เริ่ม|เรนเดอร์/i;
  const reSearch = /search|ค้นหา/i;
  const genButtons = () => [...document.querySelectorAll('button,[role="button"]')].filter(vis)
    .filter((b) => { const t = (b.innerText || b.textContent || "").trim(); return t.length < 40 && (reGen.test(t) || reGen.test(attrs(b))); });
  const fieldCandidates = () => [...document.querySelectorAll(
    'textarea,[contenteditable="true"],[contenteditable=""],input[type="text"],input[type="search"],input:not([type])'
  )].filter(vis).filter((el) => !reSearch.test(attrs(el)));
  const pickPrompt = () => {
    const fields = fieldCandidates(); if (!fields.length) return null;
    const gens = genButtons();
    if (gens.length) {
      let best = null, bestD = Infinity;
      for (const f of fields) { const [fx, fy] = center(f);
        for (const g of gens) { const [gx, gy] = center(g); const d = Math.hypot(fx - gx, fy - gy); if (d < bestD) { bestD = d; best = f; } } }
      return best;
    }
    fields.sort((a, b) => { const ce = (x) => x.isContentEditable ? 1 : 0; const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return ce(b) - ce(a) || (br.width * br.height - ar.width * ar.height); });
    return fields[0];
  };

  const pf = pickPrompt();
  const gens = genButtons();
  const bestGenerate = gens.find((b) => /arrow_forward/i.test(b.innerText)) ||
    gens.find((b) => !(b.disabled || b.getAttribute("aria-disabled") === "true")) || gens[0];
  const media = {
    videos: document.querySelectorAll("video").length,
    loading: document.querySelectorAll('[role="progressbar"],[aria-busy="true"]').length +
      [...document.querySelectorAll("button,span,div")].filter((e) =>
        /generating|loading|processing|กำลังสร้าง|กำลังประมวล/i.test((e.innerText || "").slice(0, 30))).length,
  };
  return {
    url: location.href,
    bestPrompt: pf ? { sel: desc(pf), tag: pf.tagName.toLowerCase(), editable: pf.isContentEditable, attrs: attrs(pf).trim() } : null,
    bestGenerate: bestGenerate ? { text: (bestGenerate.innerText || "").trim().slice(0, 30), sel: desc(bestGenerate),
      disabled: bestGenerate.disabled || bestGenerate.getAttribute("aria-disabled") === "true" } : null,
    fields: fieldCandidates().slice(0, 8).map((el) => ({ sel: desc(el), tag: el.tagName.toLowerCase(), editable: el.isContentEditable, attrs: attrs(el).trim() })),
    buttons: gens.slice(0, 8).map((b) => ({ sel: desc(b), text: (b.innerText || "").trim().slice(0, 30),
      disabled: b.disabled || b.getAttribute("aria-disabled") === "true" })),
    media,
  };
}

