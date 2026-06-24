// thin fetch wrappers over server.ts /api endpoints (contract unchanged from the old single-file UI)

export type Avatar = { id: string; name: string; preview_url: string };

export async function fetchAvatars(): Promise<Avatar[]> {
  const r = await fetch("/api/avatars");
  const data = await r.json();
  if (!Array.isArray(data)) throw new Error(data?.error || "โหลด avatar ไม่ได้");
  return data;
}

export type Template = "avatar" | "full" | "no_person";
export type Kind = "hf" | "pipeline";

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
  const res = await fetch("/api/generate", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "เกิดข้อผิดพลาด");
  return data;
}

export async function getStatus(id: string, kind?: Kind): Promise<{ status: string; url: string | null }> {
  const r = await fetch(`/api/status?id=${encodeURIComponent(id)}${kind ? `&kind=${kind}` : ""}`);
  return r.json();
}

// draft a Thai live-selling script from a short brief (OpenAI)
export async function draftScript(brief: string): Promise<string> {
  const res = await fetch("/api/script", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "ร่างสคริปต์ไม่สำเร็จ");
  return data.script as string;
}

// launch Remotion Studio (timeline + props edit), returns its url
export async function openEditor(): Promise<string> {
  const res = await fetch("/api/edit", { method: "POST" });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "เปิด editor ไม่สำเร็จ");
  return data.url as string;
}
