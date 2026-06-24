// One-off: regen voice.mp3 ด้วยฟิกซ์คำอ่าน (AURA→ออร่าา) + stability 0.3 แล้ว rebuild props timing
// run: bun --env-file=../.env regen-voice.ts
import { synthesizeVoice, linesToTtsText, fixThaiPron, buildCaptions, audioDurationMs } from "./pipeline";

const REMOTION = import.meta.dir + "/remotion";

// บทพูด (มี AURA → ฟิกซ์จะแปลงเป็น ออร่าา) + keyword บนจอ (ต้นฉบับ)
const SHOTS = [
  { line: "เซรั่ม AURA ทาแล้วหน้าใสขึ้นออร่า", keyword: "หน้าใสออร่า" },
  { line: "ซึมไวมาก ไม่เหนียวเหนอะหนะเลย", keyword: "ซึมไว ไม่เหนียว" },
  { line: "ทาเลยทั้งหน้า ฉ่ำวาวตั้งแต่หยดแรก", keyword: "ทาลงหน้าเลย" },
  { line: "ช่วยลดจุดด่างดำ เห็นผลไวมาก", keyword: "ลดจุดด่างดำ" },
  { line: "ราคาพิเศษเฉพาะไลฟ์นี้ รีบกดเลย", keyword: "ราคาพิเศษ" },
];

const lines = SHOTS.map((s) => fixThaiPron(s.line));
const keywords = SHOTS.map((s) => s.keyword);

const { audio, alignment } = await synthesizeVoice(linesToTtsText(lines));
await Bun.write(REMOTION + "/public/voice.mp3", audio);

const cap = buildCaptions(lines, alignment, Infinity, keywords);
const captions = cap.captions;
const audioMs = await audioDurationMs(REMOTION + "/public/voice.mp3");
const durationMs = Math.max(cap.durationMs, audioMs) + 300; // กัน "เลย" ท้ายโดนตัด
captions[captions.length - 1].endMs = durationMs;
const c = captions;

// clips timeline (สไตล์ test-mix5): พรีเซนเตอร์เปิด → b-roll → พรีเซนเตอร์ slow-mo (ทา/หยด) → b-roll CTA
const clips = [
  { src: "demo.mp4", startFromMs: 0, startMs: 0, endMs: c[1].startMs },
  { src: "clip0.mp4", startMs: c[1].startMs, endMs: c[2].startMs },
  { src: "demo.mp4", startFromMs: 9500, playbackRate: 0.65, startMs: c[2].startMs, endMs: c[4].startMs, transition: true },
  { src: "clip3.mp4", startMs: c[4].startMs, endMs: durationMs, transition: true },
];

const props = {
  clips,
  captions,
  audioSrc: "voice.mp3",
  hook: "เซรั่มหน้าใส แค่ทาก็ออร่า!",
  durationInSeconds: durationMs / 1000,
  sfx: true,
};
await Bun.write(REMOTION + "/props.json", JSON.stringify(props, null, 2));
console.log("✅ voice.mp3 + props.json ใหม่ · ยาว", (durationMs / 1000).toFixed(2), "วิ");
console.log("captions:", captions.map((x) => `${x.text}[${Math.round(x.startMs)}]`).join("  "));
