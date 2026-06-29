// thin fetch wrappers over server.ts /api endpoints (contract unchanged from the old single-file UI)

export type Avatar = { id: string; name: string; preview_url: string };

export async function fetchAvatars(): Promise<Avatar[]> {
  const r = await fetch("/api/avatars");
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error(data?.error || "โหลด avatar ไม่ได้");
  return data;
}

export type Template = "avatar" | "full" | "no_person";
export type Engine = "higgsfield" | "flow"; // where the video gets built (Higgsfield pipeline vs Google Flow)
export type Kind = "hf" | "pipeline";

// per-scene prompts from the storyboard — drive the render (Gap 4) instead of being copy-only
export type GenScene = { scene_name: string; speaker: string; dialogue: string; image_prompt: string; video_prompt: string };

export type GenParams = {
  images: File[];
  refVideo: File | null;
  script: string;
  avatarId: string;
  template: Template;
  mode: string;
  aspect: string;
  duration: string;
  resolution: string;
  scenes?: GenScene[]; // optional — present when a storyboard was used
};

export async function startGenerate(p: GenParams): Promise<{ jobId: string; refNote?: string; kind: Kind }> {
  const fd = new FormData();
  p.images.forEach((f) => fd.append("images", f));
  if (p.refVideo) fd.append("refVideo", p.refVideo);
  fd.append("script", p.script);
  fd.append("avatarId", p.avatarId);
  fd.append("template", p.template);
  fd.append("mode", p.mode);
  fd.append("aspect", p.aspect);
  fd.append("duration", p.duration);
  fd.append("resolution", p.resolution);
  if (p.scenes?.length) fd.append("scenes", JSON.stringify(p.scenes));
  const res = await fetch("/api/generate", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

export async function getStatus(id: string, kind?: Kind): Promise<{ status: string; url: string | null }> {
  const r = await fetch(`/api/status?id=${encodeURIComponent(id)}${kind ? `&kind=${kind}` : ""}`);
  return r.json();
}

// draft a full Thai live-selling voiceover from a brief, sized to the clip length (OpenAI)
export async function draftScript(brief: string, durationSec = 15): Promise<string> {
  const res = await fetch("/api/script", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief, duration: durationSec }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "ร่างสคริปต์ไม่สำเร็จ");
  return data.script as string;
}

// initial flow: generate a full per-scene storyboard from the picks (OpenAI, server-side engine)
import type { StoryboardOptions, StoryboardResult } from "../storyboard/engine";
export type { StoryboardOptions, StoryboardResult, Scene } from "../storyboard/engine";

export async function generateStoryboard(opts: StoryboardOptions): Promise<StoryboardResult> {
  const res = await fetch("/api/storyboard", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "สร้าง storyboard ไม่สำเร็จ");
  if (!data.scenes?.length) throw new Error("แตก scene ไม่ได้ — ลองใหม่อีกครั้ง");
  return data as StoryboardResult;
}

// launch Remotion Studio (timeline + props edit), returns its url
export async function openEditor(): Promise<string> {
  const res = await fetch("/api/edit", { method: "POST" });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "เปิด editor ไม่สำเร็จ");
  return data.url as string;
}
