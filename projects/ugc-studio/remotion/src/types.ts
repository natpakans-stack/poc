// Props the upstream pipeline (OpenAI script → ElevenLabs TTS → Higgsfield lip-sync) feeds in.
// Caption timings are in ms so ElevenLabs word/segment timestamps drop in directly.
export type Caption = { text: string; startMs: number; endMs: number };

export type UgcVideoProps = {
  videoSrc: string; // public/ filename (staticFile) or an http(s) URL
  hook: string;
  captions: Caption[];
  videoDurationInSeconds: number;
};
