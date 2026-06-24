import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Audio,
  staticFile,
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Mali";
import type { UgcVideoProps } from "./types";

// Mali = rounded "puffy" Thai+Latin — sticker-caption look (replaces sharp Kanit).
const { fontFamily } = loadFont("normal", { weights: ["700"], subsets: ["thai", "latin"] });

const FADE = 8; // crossfade length (frames) — short & subtle
const PREROLL = 10; // mount each clip early so it decodes before showing → no flash on hard cuts
const INK = "#2a1220"; // dark outline color

const asset = (s: string) => (s.startsWith("http") ? s : staticFile(s));
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// sticker text: rounded font, colored fill, thick crisp outline behind the fill
const sticker = (fontSize: number, fill: string, strokeW: number): React.CSSProperties => ({
  fontFamily,
  fontWeight: 700,
  fontSize,
  lineHeight: 1.08,
  textAlign: "center",
  color: fill,
  WebkitTextStroke: `${strokeW}px ${INK}`,
  paintOrder: "stroke",
  textShadow: "0 5px 0 rgba(0,0,0,0.16)",
});

// rounded sticker bubble (white keyline + soft shadow) — like the colored blobs in the refs
const bubble = (bg: string, rotate: number): React.CSSProperties => ({
  background: bg,
  border: "7px solid #fff",
  borderRadius: 44,
  padding: "8px 38px",
  boxShadow: "0 14px 34px rgba(0,0,0,0.32)",
  transform: `rotate(${rotate}deg)`,
});

const KW_COLORS = ["#ff3d8a", "#ffce2b", "#41b6ff", "#8b6bff"]; // cycle per keyword

export const UgcVideo: React.FC<UgcVideoProps> = ({ clips, captions, audioSrc, hook, sfx, durationInSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const f2 = (msv: number) => Math.round((msv / 1000) * fps);
  const endOfVideoF = f2(durationInSeconds * 1000);

  // Hook: bouncy pop-in (spring overshoot), gentle float while held, scale-down fade-out.
  const hookIn = spring({ frame, fps, config: { damping: 9, mass: 0.7, stiffness: 120 }, durationInFrames: 22 });
  const hookScale = interpolate(hookIn, [0, 1], [0.55, 1]);
  const hookFloat = Math.sin((frame / fps) * Math.PI * 1.3) * 5;
  const hookFadeIn = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookOut = interpolate(frame, [fps * 2.5, fps * 3], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookExitScale = interpolate(frame, [fps * 2.5, fps * 3], [1, 0.85], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const hookOpacity = hookFadeIn * hookOut;

  // active keyword caption; in a gap hold the most recent one that started (no wrong flash)
  const containing = captions.findIndex((c) => ms >= c.startMs && ms < c.endMs);
  const capIdx = containing >= 0 ? containing : captions.reduce((acc, c, i) => (ms >= c.startMs ? i : acc), 0);
  const cap = captions[capIdx];
  const kwPop = cap
    ? spring({ frame: frame - f2(cap.startMs), fps, config: { damping: 16, mass: 0.6 }, durationInFrames: 12 })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily }}>
      {/* Stacked clip layers — previous stays opaque under the new one until covered (no black). */}
      {clips.map((clip, i) => {
        const startF = f2(clip.startMs);
        const next = clips[i + 1];
        const nextStartF = next ? f2(next.startMs) : null;
        const mountFrom = Math.max(0, startF - PREROLL);
        const mountUntil = nextStartF !== null ? nextStartF + (next!.transition ? FADE : 0) : endOfVideoF;
        const opacity = clip.transition ? clamp01((frame - startF) / FADE) : frame >= startF ? 1 : 0;

        return (
          <Sequence key={i} from={mountFrom} durationInFrames={Math.max(1, mountUntil - mountFrom)}>
            <AbsoluteFill style={{ opacity, transform: "scale(1.02)" }}>
              <OffthreadVideo
                src={asset(clip.src)}
                muted
                startFrom={Math.round(((clip.startFromMs ?? 0) / 1000) * fps)}
                playbackRate={clip.playbackRate ?? 1}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Voice track */}
      {audioSrc ? <Audio src={asset(audioSrc)} /> : null}

      {/* SFX — pop on each keyword onset; whoosh only on clip transitions */}
      {sfx
        ? captions.map((c, i) => (
            <Sequence key={`pop${i}`} from={f2(c.startMs)} durationInFrames={fps}>
              <Audio src={staticFile("pop.wav")} />
            </Sequence>
          ))
        : null}
      {sfx
        ? clips
            .filter((c) => c.transition)
            .map((c, i) => (
              <Sequence key={`wh${i}`} from={Math.max(0, f2(c.startMs) - 2)} durationInFrames={fps}>
                <Audio src={staticFile("whoosh.wav")} />
              </Sequence>
            ))
        : null}

      {/* Hook — top · white cloud bubble + magenta puffy text */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: 150, paddingInline: 56, opacity: hookOpacity }}>
        <div
          style={{
            ...bubble("#ffffff", -2),
            transform: `scale(${hookScale * hookExitScale}) translateY(${hookFloat}px) rotate(-2deg)`,
            maxWidth: 900,
          }}
        >
          <div style={sticker(82, "#ff2d77", 8)}>{hook}</div>
        </div>
      </AbsoluteFill>

      {/* Keyword — bottom third · colored bubble + white puffy text (color cycles) */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 360, paddingInline: 70 }}>
        {cap ? (
          <div
            key={capIdx}
            style={{
              ...bubble(KW_COLORS[capIdx % KW_COLORS.length], -2),
              transform: `scale(${0.9 + kwPop * 0.1}) rotate(-2deg)`,
              opacity: kwPop,
            }}
          >
            <div style={sticker(74, "#ffffff", 7)}>{cap.text}</div>
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
