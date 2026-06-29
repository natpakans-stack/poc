// Storyboard engine — assembles the system+user prompt from the user's picks, then parses the result.
// Ported from 1click1story generateGeminiStoryboard() prep logic; model call lives in server.ts (OpenAI).
import { narrativeStyles, moodKeywords, visualStyles } from "./data";
import { buildGeminiSystemPrompt } from "./prompts";
import { parseGeminiResponse } from "./parse";

export type PromptMode = "storytelling" | "review";
export type PlatformMode = "flow" | "grok" | "supergrok";

export type StoryboardOptions = {
  object: string;            // หัวข้อ / ชื่อสินค้า / ตัวละคร
  styleNums: number[];       // เลือกได้หลายบุคลิก (0 = ไม่เลือก → Auto)
  moodId: string;            // moodKeywords[].id
  visualStyleId: string;     // visualStyles[].id
  sceneCount: number;        // 1–40
  promptMode: PromptMode;
  platformMode: PlatformMode;
  includeTextOverlay: boolean;
  glassSkin: boolean;
  noPerson?: boolean;        // template "ไม่เห็นคน" → image/video prompts must be product-only (no model/face)
};

export type Scene = {
  scene_number: number;
  scene_name: string;
  picture_ref: string;
  tag: string;
  speaker: string;
  dialogue: string;
  action: string;
  image_prompt: string;
  video_prompt: string;
};

export type StoryboardResult = {
  scenes: Scene[];
  caption: string;
  hashtags: string;
  storyboardOverview: string;
  rawText: string;
};

// build the two chat messages (OpenAI: system + user) from the picks
export function buildMessages(o: StoryboardOptions): { system: string; user: string } {
  const sceneNums = Array.from({ length: o.sceneCount }, (_, i) => i + 1);
  const sceneList = sceneNums.join(", ");
  const mood = moodKeywords.find((m) => m.id === o.moodId) ?? moodKeywords[0];
  const visual = visualStyles.find((v) => v.id === o.visualStyleId) ?? visualStyles[0];
  const styles = o.styleNums.filter((n) => n > 0);

  const stylePersonalities = styles
    .map((n) => narrativeStyles.find((x) => x.num === n))
    .filter(Boolean)
    .map((s) => `• ${s!.personality}`)
    .join("\n");
  const styleNums = styles.length ? styles.join("+") : "";

  const head = `Mood: ${mood.name} / Art: ${visual.name} / ${o.sceneCount} ฉาก (Scene ${sceneList})`;
  let user: string;
  if (o.promptMode === "review") {
    user = `สินค้า: ${o.object} / ${head}`;
    if (o.noPerson) {
      user += `

⛔ โหมด "ไม่เห็นคน": ทุก Image Prompt และ Video Prompt ต้องแสดง **เฉพาะตัวสินค้า** เท่านั้น — product close-up, สินค้าวางบนพื้นผิว/โต๊ะ, สินค้าหมุน, หรือ "มือ" หยิบ/สวมใส่สินค้า (เห็นแค่มือ). ❌ ห้ามมีใบหน้า/นางแบบ/นายแบบ/คนเต็มตัว/พรีเซนเตอร์ในเฟรมเด็ดขาด! ห้ามเขียน "The model walks/stands/poses/smiles". Speaker ยังเป็นเสียงพากย์นอกจอได้.`;
    }
    // gpt-4o จะขี้เกียจเขียนแค่ 2 ซีนแล้วบอก "replicate for the rest" — บังคับให้เขียนครบทุกซีนจริง
    user += `

⚠️ กฎบังคับ (ละเมิดไม่ได้!):
1. เขียน SCENE block ให้ครบทั้ง ${o.sceneCount} ฉาก (Scene ${sceneList}) แบบเต็มทุกซีน — แต่ละซีนต้องมี Speaker + Dialogue + Action + GEN IMAGE + GEN VIDEO ครบ
2. ⛔ ห้ามเขียนแค่บางซีนแล้วสั่งให้ทำซ้ำเด็ดขาด! ห้ามใช้คำว่า "Replicate", "similar structure", "ทำซ้ำ", "เช่นเดิม", "(ต่อ...)", "Scene X to Scene Y" หรือ placeholder ใดๆ แทนซีนจริง — ทุกซีนต้องเขียนออกมาเต็ม
3. Output ต้องมี "=== SCENE ===" ครบ ${o.sceneCount} บล็อกเป๊ะ Dialogue แต่ละซีนต้องต่างกัน
4. ⛔ เจนครบ Scene สุดท้ายแล้วหยุดทันที ห้ามมี DIRECTOR'S TIPS หรือคำอธิบายเพิ่ม`;
  } else {
    user = styleNums ? `${o.object} / ${styleNums} / ${head}` : `${o.object} / ${head}`;
    // กฎบังคับ (ห้าม N/A / ต้องมี OVERVIEW / หยุดหลัง scene สุดท้าย) — ตรงกับ original
    user += `

⚠️ กฎบังคับ (ต้องทำทุกข้อ!):
1. ต้องส่ง STORYBOARD OVERVIEW ครบถ้วน:
   - ชื่อเรื่อง (Title): อ่านหัวข้อที่ฉันพิมพ์ แล้วตั้งชื่อเรื่องภาษาไทยที่จับใจจากหัวข้อนั้น! ห้ามว่าง!
   - นักแสดงนำ (Cast): คิดชื่อตัวละครไทยน่ารักๆ ขึ้นมาเอง พร้อมลักษณะที่ตรงกับ Prompt! ห้ามว่าง!
2. ทุก Scene ต้องมี Dialogue จริงๆ ภาษาไทย 20-25 คำ - ห้ามใส่ "N/A" เด็ดขาด!
3. ทุก Scene ต้องมี Action จริงๆ - ห้ามใส่ "N/A" เด็ดขาด!
4. ถ้าไม่รู้จะเขียนอะไร ให้คิดขึ้นมาเอง!
5. ⛔ เมื่อเจนครบทุกซีนแล้ว ให้หยุดทันที! ห้ามส่ง DIRECTOR'S TIPS, ห้ามส่งแคปชั่นไวรัล, ห้ามส่ง Mood & Tone Options, ห้ามส่งคำแนะนำเพิ่มเติมใดๆ! Output ต้องจบที่ Scene สุดท้ายเท่านั้น!`;
  }

  const system = buildGeminiSystemPrompt(
    o.sceneCount,
    sceneNums,
    false, // hasImage — initial step is text-driven (images live in the Source column)
    o.promptMode,
    stylePersonalities,
    visual.prompt,
    o.platformMode,
    false, // baked text OFF permanently — image stays clean, Remotion owns all on-video text (controllable font/position)
    o.glassSkin,
  );
  return { system, user };
}

// parse raw model text → structured scenes (re-export of the ported parser, typed)
export function parseStoryboard(rawText: string): StoryboardResult {
  const r = parseGeminiResponse(rawText) as any;
  // drop malformed scenes the model left as the literal template placeholder ("[บทพูด...]") + strip stray "===" dividers
  const clean = (s: string) => (s ?? "").replace(/=+/g, "").trim();
  const scenes = ((r.scenes ?? []) as Scene[])
    .filter((s) => { const d = (s.dialogue ?? "").trim(); return d && !d.startsWith("["); })
    .map((s, i) => ({ ...s, scene_number: i + 1, scene_name: clean(s.scene_name), tag: i === 0 ? "HOOK" : s.tag }));
  return {
    scenes,
    caption: r.caption ?? "",
    hashtags: r.hashtags ?? "",
    storyboardOverview: r.storyboardOverview ?? "",
    rawText: r.rawText ?? rawText,
  };
}
