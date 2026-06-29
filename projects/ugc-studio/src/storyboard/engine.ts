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
    o.includeTextOverlay,
    o.glassSkin,
  );
  return { system, user };
}

// parse raw model text → structured scenes (re-export of the ported parser, typed)
export function parseStoryboard(rawText: string): StoryboardResult {
  const r = parseGeminiResponse(rawText) as any;
  return {
    scenes: r.scenes ?? [],
    caption: r.caption ?? "",
    hashtags: r.hashtags ?? "",
    storyboardOverview: r.storyboardOverview ?? "",
    rawText: r.rawText ?? rawText,
  };
}
