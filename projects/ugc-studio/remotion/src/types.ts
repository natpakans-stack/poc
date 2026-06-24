// Props the upstream pipeline (OpenAI plan → Higgsfield presenter/angle clips → ElevenLabs) feeds in.
// Timings are in ms so ElevenLabs word/segment timestamps drop in directly.
//
// VISUAL timeline (clips) is decoupled from the KEYWORD overlay (captions): a presenter clip
// can span several keyword windows, and keywords stay synced to the voiceover independently.

export type Clip = {
  src: string; // video clip: public/ filename (staticFile) or an http(s) URL
  startMs: number; // when it appears on the timeline
  endMs: number; // when the next clip takes over
  startFromMs?: number; // play the source from this offset (reuse long footage at different parts)
  playbackRate?: number; // <1 = slow-mo to savor a money shot, >1 = speed up (default 1)
  transition?: boolean; // crossfade from the previous clip (use sparingly — most cuts are hard)
};

export type Caption = {
  text: string; // keyword that pops on screen
  startMs: number;
  endMs: number;
};

export type UgcVideoProps = {
  clips: Clip[]; // visual timeline
  captions: Caption[]; // keyword overlay, synced to the voiceover
  audioSrc?: string; // ElevenLabs voice track
  hook: string;
  durationInSeconds: number;
  sfx?: boolean; // pop on keyword + whoosh on transitions
};
