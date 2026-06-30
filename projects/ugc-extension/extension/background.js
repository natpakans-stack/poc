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

// center ของปุ่ม generate ที่ "เปิดอยู่" (ถ้าปิด = คืน null → ไม่ยิง)
function getGenerateCenter() {
  const vis = (el) => { const r = el.getBoundingClientRect();
    return (el.offsetParent !== null || getComputedStyle(el).position === "fixed") && r.width > 4 && r.height > 4; };
  const reGen = /\b(create|generate|render|animate)\b|สร้าง|เริ่ม/i;
  const gens = [...document.querySelectorAll('button,[role="button"]')].filter(vis)
    .filter((b) => { const t = (b.innerText || "").trim();
      return t.length < 40 && reGen.test(t) && !(b.disabled || b.getAttribute("aria-disabled") === "true"); });
  const g = gens.find((b) => /arrow_forward/i.test(b.innerText)) || gens[0];
  if (!g) return null;
  const r = g.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
