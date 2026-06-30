// ── Side Panel controller ──────────────────────────────────────────
// กดปุ่ม → inject scraper ลง active tab (หน้าที่ user เปิดเอง) → render
// passive: ทำงานเฉพาะตอน user กด, บนหน้าที่เปิดอยู่แล้ว — ไม่ navigate เอง

const $ = (id) => document.getElementById(id);
let selectedImages = []; // รูปที่ user ติ๊กเลือก (คงอยู่ข้ามแท็บ สำหรับยัดเข้า Flow)
let lastProduct = null;  // ผล scrape ล่าสุด (ใช้สร้าง prompt)

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
    setStatus(`<span class="badge bad">โดน anti-bot</span> หน้านี้เป็นหน้า verify ของ Shopee — ลองรีเฟรช/เลื่อนดูสินค้าเองก่อนแล้วกดใหม่`);
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
    ? `<span class="badge ok">สำเร็จ</span> via <b>${r.method}</b> — แก้ไขช่องได้`
    : `<span class="badge bad">scrape ไม่เจอ</span> กรอกชื่อ/ราคา/รูปเองได้เลย (storyboard ใช้ค่าที่กรอก)`);

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

  const expose = () => { selectedImages = [...sel].sort((a, b) => a - b).map((i) => imgs[i]); window.pcsSelectedImages = selectedImages; };
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

// ── Tabs ───────────────────────────────────────────────────────────
document.querySelectorAll(".tab[data-tab]").forEach((t) =>
  t.addEventListener("click", () => switchTab(t.dataset.tab)));
function switchTab(name) {
  document.querySelectorAll(".tab[data-tab]").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("on", p.id === `tab-${name}`));
}
function setG(html) { $("genstatus").innerHTML = html; }

// ── 3 โหมด gen prompt (ตัวตน/สินค้า/ซีรีย์) ผ่าน system prompt เฉพาะโหมด → cards ────
const schema = (lang, dlgMax) => `Return STRICT JSON {"items":[{"label":"2-4 word label","video_prompt":"...","dialogue":"..."}]}.
- video_prompt: ENGLISH, vivid cinematic for Veo (camera/shot/action/lighting/mood), vertical 9:16.
- dialogue: spoken line in ${lang === "en" ? "English" : "Thai"}, conversational, <= ${dlgMax} words.`;
async function callGen(system, user) {
  const key = $("apikey").value.trim();
  if (!key) { switchTab("settings"); setG(`<span class="badge bad">ใส่ LLM API key ก่อน</span> (แท็บ ตั้งค่า)`); return null; }
  setG("⏳ LLM กำลังสร้าง...");
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
  setG(`<span class="badge ok">${label} ✅</span> พิมพ์ทีละ card หรือกด ▶️ Auto (ด้านล่าง) — เปิดแท็บ Flow ก่อน`);
}

$("genIdentity").addEventListener("click", async () => {
  const n = +$("idCount").value, lang = $("lang").value;
  const system = `You are a UGC video prompt director for Google Flow (Veo), Thai market.
Generate EXACTLY ${n} distinct vertical 9:16 video prompts for ONE consistent Thai content creator (same gender/skin/look every item), in the given theme. Each item = a DIFFERENT shot/moment of that creator talking to camera.
${schema(lang, 14)}`;
  const user = `Creator: ${$("idName").value || "Thai creator"}\nGender: ${$("idGender").value}\nSkin: ${$("idSkin").value}\nTheme/setting: ${$("idTheme").value}\nExtra: ${$("idDetails").value}\nText overlay: ${$("idText").checked ? "yes" : "no"}\nCount: ${n}`;
  const items = await callGen(system, user);
  if (items) showCards(items, `ตัวตน ${items.length} ชุด`);
});

$("genProduct").addEventListener("click", async () => {
  if (!lastProduct || (!lastProduct.name && !lastProduct.desc)) {
    switchTab("product"); setG(`<span class="badge bad">ยังไม่มีข้อมูลสินค้า</span> ดึง/กรอกในแท็บ สินค้า ก่อน`); return;
  }
  const n = +$("pdCount").value, lang = $("lang").value;
  const system = `You are a UGC product-review prompt director for Google Flow (Veo), Thai market.
Generate EXACTLY ${n} distinct vertical 9:16 video prompts reviewing the product, sales angle "${$("pdAngle").value}". The REAL product appears; each item a DIFFERENT shot. Use only real facts from details/reviews.
${schema(lang, 14)}`;
  const user = `Product: ${lastProduct.name || ""}\nDetails: ${(lastProduct.desc || "").slice(0, 600)}\nReviews: ${(lastProduct.reviews || []).slice(0, 3).map((r) => `"${r.comment}"`).join(" ") || "(none)"}\nAngle: ${$("pdAngle").value}\nText overlay: ${$("pdText").checked ? "yes" : "no"}\nCount: ${n}`;
  const items = await callGen(system, user);
  if (items) showCards(items, `สินค้า ${items.length} ชุด`);
});

$("genSeries").addEventListener("click", async () => {
  const n = +$("srScenes").value, lang = $("lang").value;
  const system = `You are a short-drama series director for Google Flow (Veo).
Generate a CONNECTED ${n}-scene vertical 9:16 story in genre "${$("srGenre").value}", with the SAME protagonist(s) (consistent face/look) in EVERY scene. Continuous narrative arc across scenes.
${schema(lang, 21)} label = scene beat.`;
  const user = `Genre: ${$("srGenre").value}\nScenes: ${n}\nMain characters: ${$("srChars").value}\nLead gender: ${$("srGender").value}\nSkin: ${$("srSkin").value}\nStory: ${$("srStory").value || "(AI decides a compelling arc)"}`;
  const items = await callGen(system, user);
  if (items) showCards(items, `ซีรีย์ ${items.length} ฉาก`);
});

// LLM key/provider/model (เก็บใน chrome.storage.local) — รองรับ OpenAI + DeepSeek
const KEY_FIELD = { openai: "openai_key", deepseek: "deepseek_key" };
chrome.storage.local.get(["llm_provider", "openai_key", "deepseek_key", "llm_model"]).then((s) => {
  const p = s.llm_provider || "openai";
  $("provider").value = p;
  $("apikey").value = s[KEY_FIELD[p]] || "";
  $("model").value = s.llm_model || "";
});
$("provider").addEventListener("change", async () => {
  const s = await chrome.storage.local.get(["openai_key", "deepseek_key"]);
  $("apikey").value = s[KEY_FIELD[$("provider").value]] || "";
});
$("keysave").addEventListener("click", () => {
  chrome.storage.local.set({
    llm_provider: $("provider").value,
    [KEY_FIELD[$("provider").value]]: $("apikey").value.trim(),
    llm_model: $("model").value.trim(),
  });
  $("keysave").textContent = "บันทึกแล้ว ✓";
  setTimeout(() => { $("keysave").textContent = "บันทึก"; }, 1500);
});
// helper: พิมพ์ข้อความเข้า Flow (ใช้ทั้งปุ่มเดี่ยว + ปุ่มรายซีน) — คืน tabId เผื่อ re-probe
async function typeToFlow(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/labs\.google|google\.com/.test(tab?.url || "")) return { ok: false, error: "สลับไปแท็บ Flow ก่อน" };
  const resp = await chrome.runtime.sendMessage({ type: "typeInFlow", tabId: tab.id, text });
  return resp?.ok ? { ok: true, tabId: tab.id } : { ok: false, error: resp?.error || "?" };
}

// ▶️ Auto scene-queue: วน type → generate → รอเสร็จ → กด + → ซีนถัดไป (เปลืองเครดิตหลายเครดิต!)
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
      setF(`⏳ ซีน ${i + 1}/${tas.length}: พิมพ์ prompt...`);
      const t = await chrome.runtime.sendMessage({ type: "typeInFlow", tabId: tab.id, text });
      if (!t?.ok) { setF(`<span class="badge bad">ซีน ${i + 1}: พิมพ์ไม่ได้</span> ${t?.error}`); return; }
      await sleep(600);
      const base = (await chrome.runtime.sendMessage({ type: "flowState", tabId: tab.id }))?.videos ?? 0;
      setF(`⏳ ซีน ${i + 1}/${tas.length}: กด Generate...`);
      const g = await chrome.runtime.sendMessage({ type: "clickGenerate", tabId: tab.id });
      if (!g?.ok) { setF(`<span class="badge bad">ซีน ${i + 1}: generate ไม่ได้</span> ${g?.error}`); return; }
      setF(`⏳ ซีน ${i + 1}/${tas.length}: รอ generate เสร็จ... (สูงสุด 4 นาที)`);
      const done = await waitGenerateDone(tab.id, base, 240000);
      if (!done) { setF(`<span class="badge bad">ซีน ${i + 1}: รอเกินเวลา</span> เช็คหน้า Flow แล้วทำต่อเอง`); return; }
      if (i < tas.length - 1) {
        setF(`⏳ เพิ่มซีน ${i + 2}...`);
        await chrome.runtime.sendMessage({ type: "clickAdd", tabId: tab.id });
        await sleep(1500);
      }
    }
    setF(`<span class="badge ok">ยิงครบ ${tas.length} ซีน ✅</span> ดูผลในหน้า Flow แล้วโหลดเอง`);
  } finally { $("autoqueue").disabled = false; }
});

function renderCards(items) {
  const esc = (s) => (s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  $("cards").innerHTML = items.map((s, i) => `
    <div class="scene">
      <div class="scene-h"><b>${i + 1} · ${esc(s.label || s.shot || "")}</b><button data-i="${i}">⌨️ พิมพ์ → Flow</button></div>
      <textarea data-i="${i}" rows="3">${esc(s.video_prompt || s.prompt || "")}</textarea>
      ${s.dialogue ? `<div class="dlg">🗣️ ${esc(s.dialogue)}</div>` : ""}
    </div>`).join("");
  $("cards").querySelectorAll("button[data-i]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const i = btn.dataset.i;
      const ta = $("cards").querySelector(`textarea[data-i="${i}"]`);
      setF(`⏳ พิมพ์ card ${+i + 1} เข้า Flow...`);
      const r = await typeToFlow(ta.value.trim());
      setF(r.ok
        ? `<span class="badge ok">พิมพ์ card ${+i + 1} แล้ว ✅</span> กด ▶️ Generate → รอเสร็จ → กด + ใน Flow → พิมพ์ card ถัดไป`
        : `<span class="badge bad">พิมพ์ไม่ได้</span> ${r.error}`);
    });
  });
}

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
    const gtext = (r.bestGenerate?.text || "ไม่เจอ").replace(/\n/g, " ");
    setF(`<span class="badge ${r.bestPrompt && r.bestGenerate ? "ok" : "bad"}">ผลตรวจ</span>
      ${okIn} prompt: <b>${r.bestPrompt?.sel || "ไม่เจอ"}</b> ${r.bestPrompt?.editable ? "(editable✓)" : ""}<br>
      ${okBtn} generate: <b>${gtext}</b> ${r.bestGenerate?.disabled ? "(ปิดอยู่—รอพิมพ์)" : "(พร้อม)"}<br>
      <span style="color:var(--muted)">fields ${r.fields?.length ?? 0} · buttons ${r.buttons?.length ?? 0} · video ${r.media?.videos ?? 0} · loading ${r.media?.loading ?? 0}</span>`);
  } catch (e) {
    setF(`<span class="badge bad">ตรวจไม่ได้</span> ${e.message}`);
  }
});

// ── Flow: ยัดรูปที่เลือก เข้า Flow เป็น reference ──────────
// background fetch bytes (เลี่ยง CORS) → ส่ง data URL → ประกอบ File ในหน้า Flow → ยัด file input
$("injimg").addEventListener("click", async () => {
  try {
    if (!selectedImages.length) {
      setF(`<span class="badge bad">ยังไม่มีรูป</span> กด "ดึงข้อมูลจากหน้านี้" แล้วเลือกรูปก่อน (แท็บ Shopee)`);
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/labs\.google|google\.com/.test(tab?.url || "")) {
      setF(`<span class="badge bad">ไม่ใช่หน้า Flow</span> สลับไปแท็บ Flow ก่อนกด (รูปที่เลือกยังอยู่)`);
      return;
    }
    const urls = selectedImages;
    let injected = 0, failed = 0;
    // วนยัดทีละรูป + เว้นจังหวะให้ Flow รับ (re-query input ใหม่ทุกรอบในตัว inject)
    for (let i = 0; i < urls.length; i++) {
      setF(`⏳ ยัดรูป ${i + 1}/${urls.length}... (สำเร็จ ${injected})`);
      const resp = await chrome.runtime.sendMessage({ type: "fetchImage", url: urls[i] });
      if (!resp?.ok) { failed++; continue; }
      const [{ result: r } = {}] = await chrome.scripting.executeScript({
        target: { tabId: tab.id }, world: "MAIN", func: injectImageToFlow,
        args: [{ dataUrl: resp.dataUrl, filename: `product-${i + 1}.jpg` }],
      });
      if (r?.ok) injected++; else failed++;
      await new Promise((res) => setTimeout(res, 700)); // ให้ Flow ประมวลผลก่อนรูปถัดไป
    }
    setF(`<span class="badge ${injected ? "ok" : "bad"}">ยัดเสร็จ</span> สำเร็จ <b>${injected}</b>/${urls.length} รูป${failed ? ` · พลาด ${failed}` : ""}
      <br>👀 ดูที่ Flow ว่ารูปขึ้นครบไหม — ℹ️ โหมด Ingredients ของ Flow มักรับสูงสุด ~3 รูป`);
  } catch (e) { setF(`<span class="badge bad">ผิดพลาด</span> ${e.message}`); }
});

// กด Create (generate จริง) — ยิงเฉพาะปุ่ม arrow_forward ที่ enabled (ไม่แตะปุ่ม +)
$("gen").addEventListener("click", async () => {
  setF("⏳ กด Generate...");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!/labs\.google|google\.com/.test(tab?.url || "")) {
      setF(`<span class="badge bad">ไม่ใช่หน้า Flow</span> สลับไปแท็บ Flow ก่อน`); return;
    }
    const resp = await chrome.runtime.sendMessage({ type: "clickGenerate", tabId: tab.id });
    setF(resp?.ok
      ? `<span class="badge ok">กด Create แล้ว ▶️</span> Flow กำลัง generate — รอผลในหน้า Flow แล้วโหลดคลิปเอง`
      : `<span class="badge bad">กดไม่ได้</span> ${resp?.error || "?"}`);
  } catch (e) { setF(`<span class="badge bad">ผิดพลาด</span> ${e.message}`); }
});

// injected: ประกอบ File จาก data URL แล้วยัดเข้า file input / drop ของ Flow
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

