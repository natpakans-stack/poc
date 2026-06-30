// คลิกไอคอน extension → เปิด Side Panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// fetch รูปจาก marketplace CDN ใน background (host_permission ครอบ → ไม่ติด CORS)
// คืนเป็น data URL เพื่อให้หน้า Flow ประกอบเป็น File ได้ (data: ไม่ติด CORS ในหน้า)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "typeInFlow") {
    typeInFlow(msg.tabId, msg.text).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg?.type === "clickGenerate") {
    clickGenerate(msg.tabId).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg?.type === "genStoryboard") {
    genStoryboard(msg).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg?.type === "flowState") {
    chrome.scripting.executeScript({ target: { tabId: msg.tabId }, world: "MAIN", func: flowState })
      .then(([r]) => sendResponse(r?.result || null)).catch(() => sendResponse(null));
    return true;
  }
  if (msg?.type === "clickAdd") {
    clickAdd(msg.tabId).then(sendResponse).catch((e) => sendResponse({ ok: false, error: e.message }));
    return true;
  }
  if (msg?.type !== "fetchImage") return;
  fetch(msg.url)
    .then((r) => r.ok ? r.blob() : Promise.reject(new Error("HTTP " + r.status)))
    .then((blob) => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res({ ok: true, dataUrl: fr.result, mime: blob.type, bytes: blob.size });
      fr.onerror = () => rej(new Error("read fail"));
      fr.readAsDataURL(blob);
    }))
    .then(sendResponse)
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true; // async response
});

// ── พิมพ์ prompt เข้า Flow แบบ trusted keystroke ผ่าน CDP (chrome.debugger) ──
// synthetic input ไม่พอให้ Lexical รับรู้ → ใช้ Input.insertText ที่ trusted เหมือนคนพิมพ์จริง
async function typeInFlow(tabId, text) {
  // 1) หา center ของช่อง prompt (ในหน้า) เพื่อคลิกวาง caret
  const [{ result: pos } = {}] = await chrome.scripting.executeScript({
    target: { tabId }, world: "MAIN", func: getPromptCenter,
  });
  if (!pos) return { ok: false, error: "ไม่เจอช่อง prompt" };

  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");
  const cmd = (m, p) => chrome.debugger.sendCommand(target, m, p);
  const mod = /Mac/i.test(navigator.userAgent) ? 8 : 2; // Cmd=8 / Ctrl=2
  try {
    // คลิกช่อง prompt → focus + วาง caret
    await cmd("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    // select-all ของเดิม (กันพิมพ์ต่อท้าย) แล้ว insert ทับ
    await cmd("Input.dispatchKeyEvent", { type: "keyDown", modifiers: mod, key: "a", code: "KeyA", windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 });
    await cmd("Input.dispatchKeyEvent", { type: "keyUp", modifiers: mod, key: "a", code: "KeyA", windowsVirtualKeyCode: 65, nativeVirtualKeyCode: 65 });
    await cmd("Input.insertText", { text }); // trusted → Lexical รับ
    return { ok: true };
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

// หา center ของช่อง prompt (inject ในหน้า) — เลือก field ใกล้ปุ่ม generate, ตัด search
function getPromptCenter() {
  const vis = (el) => { const r = el.getBoundingClientRect();
    return (el.offsetParent !== null || getComputedStyle(el).position === "fixed") && r.width > 4 && r.height > 4; };
  const attrs = (el) => ((el.getAttribute("placeholder") || "") + " " + (el.getAttribute("aria-label") || "") + " " + (el.type || "")).toLowerCase();
  const center = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const reGen = /\b(create|generate|render|animate)\b|สร้าง|เริ่ม/i, reSearch = /search|ค้นหา/i;
  const gens = [...document.querySelectorAll('button,[role="button"]')].filter(vis)
    .filter((b) => { const t = (b.innerText || "").trim(); return t.length < 40 && reGen.test(t); });
  let fields = [...document.querySelectorAll('textarea,[contenteditable=""],[contenteditable="true"],input[type="text"],input:not([type])')]
    .filter(vis).filter((el) => !reSearch.test(attrs(el)));
  if (!fields.length) return null;
  let best;
  if (gens.length) {
    let bd = Infinity;
    for (const f of fields) { const [fx, fy] = center(f);
      for (const g of gens) { const [gx, gy] = center(g); const d = Math.hypot(fx - gx, fy - gy); if (d < bd) { bd = d; best = f; } } }
  } else {
    best = fields.sort((a, b) => { const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect(); return br.width * br.height - ar.width * ar.height; })[0];
  }
  const [x, y] = center(best);
  return { x, y };
}

// ── กดปุ่ม Create (generate จริง) ผ่าน CDP — คลิกเฉพาะปุ่มที่ enabled ──
async function clickGenerate(tabId) {
  const [{ result: pos } = {}] = await chrome.scripting.executeScript({
    target: { tabId }, world: "MAIN", func: getGenerateCenter,
  });
  if (!pos) return { ok: false, error: "ไม่เจอปุ่ม Create ที่กดได้ (พิมพ์ prompt ให้ปุ่มเปิดก่อน)" };
  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");
  const cmd = (m, p) => chrome.debugger.sendCommand(target, m, p);
  try {
    await cmd("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    return { ok: true };
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

// center ของปุ่ม Generate จริง (arrow_forward) ที่ "เปิดอยู่"
// ⚠️ ต้องตัดปุ่ม "+" (add_2 = add source/reference) ทิ้ง — มันมีคำว่า Create เหมือนกัน
// ถ้าปุ่ม generate ปิด/ไม่เจอ = คืน null (ไม่ fallback ปุ่มอื่น กันกดผิดไปโดนปุ่ม +)
function getGenerateCenter() {
  const vis = (el) => { const r = el.getBoundingClientRect();
    return (el.offsetParent !== null || getComputedStyle(el).position === "fixed") && r.width > 4 && r.height > 4; };
  const txt = (b) => (b.innerText || b.textContent || "").trim();
  const isAdd = (b) => /add_|(^|\s)add(\s|$)|^\+$/i.test(txt(b)); // ปุ่ม + / add source — ห้ามแตะ
  const enabled = (b) => !(b.disabled || b.getAttribute("aria-disabled") === "true");
  const reGen = /\b(generate|render|animate|create)\b|สร้าง|เริ่ม/i;
  const cands = [...document.querySelectorAll('button,[role="button"]')].filter(vis)
    .filter((b) => txt(b).length < 40 && !isAdd(b) && enabled(b) && reGen.test(txt(b)));
  const g = cands.find((b) => /arrow_forward/i.test(txt(b))) || cands[0];
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// ── LLM storyboard: แตกสินค้า → N ซีน (video-prompt อังกฤษ + บทไทย) ผ่าน OpenAI ──
async function genStoryboard({ apiKey, product, angle, lang, scenes, provider, model }) {
  if (!apiKey) return { ok: false, error: "ยังไม่ได้ใส่ LLM API key (ช่อง ⚙️)" };
  const ENDPOINT = provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
  const MODEL = model?.trim() || (provider === "deepseek" ? "deepseek-chat" : "gpt-4o");
  const n = Math.max(1, Math.min(8, +scenes || 3));
  const sys = `You are a UGC short-video storyboard director for Google Flow (Veo), making vertical 9:16 product videos for the Thai market.
Output a storyboard of EXACTLY ${n} distinct scenes (~8s each) forming one cohesive, scroll-stopping UGC review.
Return STRICT JSON: {"scenes":[{"shot":"...","video_prompt":"...","dialogue":"..."}]}
Rules:
- video_prompt: ENGLISH, vivid cinematic description for Veo — camera angle/movement, on-screen subject & action, lighting, mood. A Thai creator and the REAL product appear naturally. Each scene a DIFFERENT shot (e.g. hook close-up, hands-on demo, lifestyle, reaction, CTA). Vertical 9:16.
- dialogue: the spoken line in ${lang === "en" ? "English" : "Thai"}, conversational, <= 14 words.
- shot: 2-4 word label.
- Arc across scenes: hook -> benefit/demo -> proof/reaction -> CTA, adapted to the angle "${angle}".
- Use only real facts from the product details/reviews. Do not invent specs.`;
  const user = `Product: ${product.name || "(unknown)"}
Details: ${(product.desc || "").slice(0, 600)}
Top reviews: ${(product.reviews || []).slice(0, 3).map((r) => `"${r.comment}"`).join(" ") || "(none)"}
Angle: ${angle}
Number of scenes: ${n}`;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL, response_format: { type: "json_object" },
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) return { ok: false, error: `${provider || "openai"} ${res.status}: ${(await res.text()).slice(0, 180)}` };
  const data = await res.json();
  let parsed;
  try { parsed = JSON.parse(data.choices[0].message.content); }
  catch { return { ok: false, error: "parse JSON ไม่ได้" }; }
  const out = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  if (!out.length) return { ok: false, error: "ไม่ได้ซีนกลับมา" };
  return { ok: true, scenes: out };
}

// ── done-detection: สถานะ Flow (จำนวน video + กำลังประมวลผลไหม) ──
function flowState() {
  const videos = document.querySelectorAll("video").length;
  const busy = document.querySelectorAll('[aria-busy="true"],[role="progressbar"]').length +
    [...document.querySelectorAll("button,span,div")].filter((e) =>
      /generating|loading|processing|rendering|กำลังสร้าง|กำลังประมวล/i.test((e.innerText || "").slice(0, 40))).length;
  return { videos, busy };
}

// ── กดปุ่ม "+" (add_2 = add scene/source) ผ่าน CDP — สำหรับเพิ่มซีนถัดไป ──
async function clickAdd(tabId) {
  const [{ result: pos } = {}] = await chrome.scripting.executeScript({
    target: { tabId }, world: "MAIN", func: getAddCenter,
  });
  if (!pos) return { ok: false, error: "ไม่เจอปุ่ม + (add)" };
  const target = { tabId };
  await chrome.debugger.attach(target, "1.3");
  const cmd = (m, p) => chrome.debugger.sendCommand(target, m, p);
  try {
    await cmd("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1 });
    return { ok: true };
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

function getAddCenter() {
  const vis = (el) => { const r = el.getBoundingClientRect();
    return (el.offsetParent !== null || getComputedStyle(el).position === "fixed") && r.width > 4 && r.height > 4; };
  const txt = (b) => (b.innerText || b.textContent || "").trim();
  const enabled = (b) => !(b.disabled || b.getAttribute("aria-disabled") === "true");
  const adds = [...document.querySelectorAll('button,[role="button"]')].filter(vis)
    .filter((b) => /add_|(^|\s)add(\s|$)|^\+$/i.test(txt(b)) && enabled(b));
  const g = adds.find((b) => /add_2/i.test(txt(b))) || adds[0];
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
