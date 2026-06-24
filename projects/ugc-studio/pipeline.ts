// UGC video pipeline — OpenAI script → ElevenLabs voice+timestamps → Remotion render.
//
// Wire into UGC Studio: `import { runPipeline } from "./pipeline"`.
// Run standalone:        `bun --env-file=../.env pipeline.ts "<product brief>"`
//   (.env lives in poc/projects/.env — one level up — so pass --env-file when running from here)

import { $ } from "bun";

const REMOTION_DIR = import.meta.dir + "/remotion";
const PUBLIC_DIR = REMOTION_DIR + "/public";
const DEFAULT_VOICE_ID = "cgSgspJ2msm6clMCkdW9"; // Jessica — playful, bright, young (สดใส) · eleven_v3
const HF = "/Users/natpakansirirat/.npm-global/lib/node_modules/@higgsfield/cli/vendor/hf";

export type Caption = { text: string; startMs: number; endMs: number };
export type Script = { hook: string; lines: string[] };

function key(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} missing — run with: bun --env-file=../.env`);
  return v;
}

// ── 1. Script ──────────────────────────────────────────────────────────────
const SCRIPT_SYSTEM = `คุณเป็นนักเขียนสคริปต์ UGC live-selling ภาษาไทยที่ขายเก่งมาก
เขียนสคริปต์พากย์สำหรับวิดีโอแนวตั้งสั้น ~13 วินาที จากข้อมูลสินค้าที่ได้รับ
โครงสร้าง: hook สะดุด → ปัญหา/ประโยชน์ → จุดเด่นสินค้า → CTA เร่งให้ซื้อ
กฎ:
- ภาษาพูดเป็นกันเอง เหมือนรีวิวให้เพื่อนฟัง ไม่เป็นทางการ
- แต่ละบรรทัดสั้น พอเป็น caption บนจอ (≤ 12 คำ)
- รวมทั้งหมด 4-5 บรรทัด พูดจบใน ~13 วินาที
ตอบเป็น JSON เท่านั้น: {"hook": "ข้อความ hook สั้นๆ ขึ้นบนจอ", "lines": ["บรรทัด1", "บรรทัด2", ...]}`;

export async function generateScript(brief: string, model = "gpt-4o"): Promise<Script> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SCRIPT_SYSTEM },
        { role: "user", content: brief },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const script = JSON.parse(data.choices[0].message.content) as Script;
  if (!script.hook || !Array.isArray(script.lines) || !script.lines.length) {
    throw new Error("OpenAI returned malformed script: " + JSON.stringify(script));
  }
  return script;
}

// ── 2. Voice + char-level timestamps ─────────────────────────────────────────
type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export async function synthesizeVoice(
  text: string,
  voiceId = DEFAULT_VOICE_ID,
): Promise<{ audio: Buffer; alignment: Alignment }> {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
    {
      method: "POST",
      headers: { "xi-api-key": key("ELEVENLABS_API_KEY"), "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_v3", // v3 = โมเดลเดียวที่ลิสต์รองรับไทยอย่างเป็นทางการ (v2 ฟังไม่ออก)
        voice_settings: { stability: 0.2 }, // 0.2 = สดใส มีชีวิตชีวา (ต่ำ=expressive กว่า)
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return { audio: Buffer.from(data.audio_base64, "base64"), alignment: data.alignment };
}

// ── 3. Map each script line → caption with ms timings from the char alignment ─
// Lines are TTS'd as one text joined by "\n"; we walk the char cursor to find
// each line's first/last character and read its start/end time.
// labels: optional per-line display text (e.g. plan keywords). เวลายังจับจาก line จริง
// แต่ text ที่โชว์บนจอใช้ labels[i] แทน — ให้ keyword เด้งตรงจังหวะที่ประโยคนั้นถูกพูด
export function buildCaptions(
  lines: string[],
  alignment: Alignment,
  capMs = Infinity,
  labels?: string[],
): { captions: Caption[]; durationMs: number } {
  const starts = alignment.character_start_times_seconds;
  const ends = alignment.character_end_times_seconds;
  const captions: Caption[] = [];
  let cursor = 0;
  for (const [i, line] of lines.entries()) {
    const startMs = (starts[cursor] ?? 0) * 1000;
    const lastIdx = cursor + line.length - 1;
    const endMs = (ends[lastIdx] ?? starts[cursor] ?? 0) * 1000;
    const text = labels?.[i] ?? line;
    if (startMs < capMs) captions.push({ text, startMs, endMs: Math.min(endMs, capMs) });
    cursor += line.length + 1; // +1 for the "\n" joiner
  }
  const audioMs = (ends[ends.length - 1] ?? 0) * 1000;
  return { captions, durationMs: Math.min(audioMs, capMs) };
}

export function linesToTtsText(lines: string[]): string {
  return lines.join("\n");
}

// ความยาวเสียงจริงจากไฟล์ (alignment ตัวอักษรสุดท้ายมักสั้นกว่าจริงเมื่อคำท้ายลากเสียง เช่น "เลยยย")
export async function audioDurationMs(path: string): Promise<number> {
  const r = await $`ffprobe -v error -show_entries format=duration -of csv=p=0 ${path}`.quiet();
  return parseFloat(r.stdout.toString().trim()) * 1000;
}
const TAIL_MS = 300; // กันจบห้วน — เผื่อหางเสียง/ความเงียบท้าย

// แก้คำอ่านไทยที่ ElevenLabs ออกเสียงเพี้ยน — ใช้กับ "บทพูด" เท่านั้น (keyword บนจอยังปกติ)
// timing คำนวณจากบทพูดที่แก้แล้ว → ความยาวตัวอักษรตรงกับ alignment เสมอ
const PRON_FIX: [RegExp, string][] = [
  [/\bAURA\b/gi, "ออร่าา"], // แบรนด์ AURA ตัวอังกฤษ → ออกเสียงไทย (ไม่งั้นเป็น "ออร่ะ")
  [/ออร่า/g, "ออร่าา"], // เผื่อบทพูดมีคำไทย ออร่า ตรงๆ
];
export function fixThaiPron(text: string): string {
  return PRON_FIX.reduce((s, [re, to]) => s.replace(re, to), text);
}

// ── 4. Higgsfield: แตกรูปมุม (nano_banana) → เติม motion เป็นคลิป (seedance) ─────
// "คน = มือ/บางส่วน" — ช็อตคนเป็นมือถือ/ทา/หยิบ ไม่เห็นหน้าเต็ม (เลี่ยง lip-sync)
const SHOT_PROMPT: Record<string, string> = {
  product_closeup:
    "Professional UGC product photo, extreme close-up of this product held in a person's hand, soft natural lighting, cozy lifestyle background, vertical 9:16, sharp focus on the label",
  product_angle:
    "UGC product flat-lay from above, this product on a warm aesthetic surface with lifestyle props around, soft daylight, vertical 9:16, editorial feel, no hands",
  presenter_talk:
    "UGC lifestyle shot, a young woman's hand and forearm presenting this product toward the camera in a cozy home setting, natural light, shallow depth of field, vertical 9:16, authentic social-media vibe",
};
// motion ต่อชนิดช็อต — ช็อตมือ = ขยับมือเบาๆ, flat-lay = ดันกล้องนิดเดียว (กันภาพ morph เพี้ยน)
const MOTION_PROMPT: Record<string, string> = {
  product_closeup: "gentle natural hand motion, slight turn of the product toward the camera, subtle background bokeh, cinematic",
  product_angle: "very subtle slow camera push-in, slight parallax on the surrounding props, minimal motion, cinematic",
  presenter_talk: "the hand gently lifts and presents the product toward the camera, soft natural human motion, cinematic UGC feel",
};

// pull first media url (image/mp4) จาก json — ข้าม input
function findMediaUrl(x: any, ext: RegExp): string | null {
  if (!x) return null;
  if (typeof x === "string") return ext.test(x) ? x : null;
  if (Array.isArray(x)) { for (const v of x) { const r = findMediaUrl(v, ext); if (r) return r; } return null; }
  if (typeof x === "object") {
    for (const [k, v] of Object.entries(x)) {
      if (k === "input_images" || k === "input_image" || k === "medias") continue; // skip source media
      const r = findMediaUrl(v, ext);
      if (r) return r;
    }
  }
  return null;
}
const jobId = (parsed: any): string | null =>
  (Array.isArray(parsed) ? parsed[0]?.id : parsed?.id) ?? null;

async function uploadImage(path: string): Promise<string> {
  const r = await $`${HF} upload create ${path} --json`.quiet();
  const id = JSON.parse(r.stdout.toString())?.id;
  if (!id) throw new Error(`upload รูปไม่สำเร็จ: ${r.stderr.toString() || r.stdout.toString()}`);
  return id;
}

// gen รูปมุม → คืน job id (ใช้เป็น start image ของ seedance ได้เลย ไม่ต้อง upload ซ้ำ)
async function genAngleImage(imageId: string, type: string, i: number): Promise<string> {
  const prompt = SHOT_PROMPT[type] ?? SHOT_PROMPT.product_closeup;
  const r = await $`${HF} generate create nano_banana_2 --prompt ${prompt} --image ${imageId} --aspect_ratio 9:16 --wait --wait-timeout 5m --wait-interval 5s --json`.quiet();
  const id = jobId(JSON.parse(r.stdout.toString()));
  if (!id) throw new Error(`nano_banana ไม่คืน job id สำหรับช็อต ${i} (${type})`);
  return id;
}

// gen คลิปจากรูปมุม (seedance i2v) → download เป็น clip{i}.mp4 คืนชื่อไฟล์
async function genShotClip(startImageRef: string, type: string, i: number): Promise<string> {
  const prompt = MOTION_PROMPT[type] ?? MOTION_PROMPT.product_closeup;
  const r = await $`${HF} generate create seedance1_5 --prompt ${prompt} --image ${startImageRef} --aspect_ratio 9:16 --duration 4 --resolution 720p --generate_audio false --wait --wait-timeout 8m --wait-interval 5s --json`.quiet();
  const url = findMediaUrl(JSON.parse(r.stdout.toString()), /\.mp4/);
  if (!url) throw new Error(`seedance ไม่คืน mp4 สำหรับช็อต ${i} (${type})`);
  const name = `clip${i}.mp4`;
  await Bun.write(PUBLIC_DIR + "/" + name, await (await fetch(url)).arrayBuffer());
  return name;
}

// ── 5. Render via Remotion ───────────────────────────────────────────────────
export type Clip = { src: string; startMs: number; endMs: number; startFromMs?: number; transition?: boolean };
export type RenderProps = {
  clips: Clip[]; // visual timeline
  captions: Caption[]; // keyword overlay (audio-synced)
  audioSrc?: string;
  hook: string;
  durationInSeconds: number;
  sfx?: boolean;
};

export async function renderVideo(props: RenderProps, outName = "final.mp4"): Promise<string> {
  await Bun.write(REMOTION_DIR + "/props.json", JSON.stringify(props, null, 2));
  const out = `out/${outName}`;
  await $`bunx remotion render UgcVideo ${out} --props=./props.json`.cwd(REMOTION_DIR);
  return `${REMOTION_DIR}/${out}`;
}

// ── Plan-driven orchestrator (AI Director) ───────────────────────────────────
// brief + รูปสินค้า
//   → OpenAI shot plan
//   → (ขนาน) Higgsfield แตกรูปต่อช็อต  +  ElevenLabs เสียง+timestamp
//   → ผูก timing ของช็อต/keyword เข้ากับช่วงที่ประโยคนั้นถูกพูด (sync อัตโนมัติ)
//   → Remotion ตัดสลับช็อต + keyword เด้ง → mp4
import { planShots, type ShotPlan } from "./orchestrator";

export async function runFromPlan(
  brief: string,
  opts: {
    productImage?: string; // path รูปสินค้าที่ user อัป
    totalDurationS?: number;
    voiceId?: string;
    outName?: string;
    noPerson?: boolean; // "ไม่เห็นคน" template — แผนช็อตเลี่ยง presenter_talk
  } = {},
): Promise<{ plan: ShotPlan; out: string }> {
  const productImage = opts.productImage ?? "ugc-review/assets/product.png";

  const plan = await planShots(brief, { totalDurationS: opts.totalDurationS, noPerson: opts.noPerson });
  await Bun.write(REMOTION_DIR + "/plan.json", JSON.stringify(plan, null, 2)); // เก็บสคริปต์เต็มไว้ดูภายหลัง
  const lines = plan.shots.map((s) => fixThaiPron(s.line)); // บทพูดแก้คำอ่าน (timing อิงตัวนี้)
  const keywords = plan.shots.map((s) => s.keyword); // keyword บนจอ = ต้นฉบับ

  // upload รูปครั้งเดียว แล้วต่อช็อต: รูปมุม → คลิป i2v (ขนานทุกช็อต) + เสียง พร้อมกัน
  const imageId = await uploadImage(productImage);
  const [clipFiles, voice] = await Promise.all([
    Promise.all(
      plan.shots.map(async (s, i) => {
        const angleId = await genAngleImage(imageId, s.type, i);
        return genShotClip(angleId, s.type, i);
      }),
    ),
    synthesizeVoice(linesToTtsText(lines), opts.voiceId),
  ]);
  await Bun.write(PUBLIC_DIR + "/voice.mp3", voice.audio);

  const cap = buildCaptions(lines, voice.alignment, Infinity, keywords);
  const captions = cap.captions;
  // ใช้ความยาวเสียงจริง (เผื่อคำท้ายลากเสียงเกิน timestamp) + tail กันโดนตัด
  const audioMs = await audioDurationMs(PUBLIC_DIR + "/voice.mp3");
  const durationMs = Math.max(cap.durationMs, audioMs) + TAIL_MS;
  if (captions.length) captions[captions.length - 1].endMs = durationMs; // keyword ท้ายค้างจนจบเสียง

  // v1: clips 1:1 กับ caption (seedance ต่อช็อต) — transition แบบประหยัดเฉพาะคู่
  // TODO: presenter-spine arrangement (demo.mp4 แบบ marketing_studio_video เป็นแกน + b-roll สลับ)
  const timeline: Clip[] = captions.map((c, i) => ({
    src: clipFiles[i],
    startMs: c.startMs,
    endMs: i + 1 < captions.length ? captions[i + 1].startMs : durationMs,
    transition: i > 0 && i % 2 === 0,
  }));

  const out = await renderVideo(
    { clips: timeline, captions, audioSrc: "voice.mp3", hook: plan.hook, durationInSeconds: durationMs / 1000, sfx: true },
    opts.outName,
  );
  return { plan, out };
}

// ── CLI (only when run directly, never on import) ────────────────────────────
if (import.meta.main) {
  const brief = process.argv[2];
  if (!brief) {
    console.error('usage: bun --env-file=../.env pipeline.ts "<product brief>" [productImage]');
    process.exit(1);
  }
  const { plan, out } = await runFromPlan(brief, { productImage: process.argv[3] });
  console.log("hook:", plan.hook);
  console.log("shots:", plan.shots.map((s) => `${s.type} "${s.keyword}"`).join("\n       "));
  console.log("rendered →", out);
}
