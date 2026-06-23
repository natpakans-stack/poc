import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Kanit";
import type { UgcVideoProps } from "./types";

// Kanit = Thai + Latin (Bebas Neue has no Thai glyphs — see session decisions).
const { fontFamily } = loadFont("normal", {
  weights: ["700", "900"],
  subsets: ["thai", "latin"],
});

const STROKE = "0 2px 6px rgba(0,0,0,0.55), 0 0 2px rgba(0,0,0,0.9)";

export const UgcVideo: React.FC<UgcVideoProps> = ({ videoSrc, hook, captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const src = videoSrc.startsWith("http") ? videoSrc : staticFile(videoSrc);
  const ms = (frame / fps) * 1000;

  // Hook: spring in over first ~0.5s, ease out over the last 0.4s of its 4s window.
  const hookIn = spring({ frame, fps, config: { damping: 14 }, durationInFrames: 16 });
  const hookOut = interpolate(frame, [fps * 3.6, fps * 4], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hookOpacity = hookIn * hookOut;

  const active = captions.find((c) => ms >= c.startMs && ms < c.endMs);
  const activeIndex = active ? captions.indexOf(active) : -1;
  const captionPop = active
    ? spring({
        frame: frame - Math.round((active.startMs / 1000) * fps),
        fps,
        config: { damping: 16, mass: 0.6 },
        durationInFrames: 12,
      })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily }}>
      <OffthreadVideo src={src} />

      {/* Hook overlay — top */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 140,
          opacity: hookOpacity,
        }}
      >
        <div
          style={{
            transform: `translateY(${(1 - hookIn) * -40}px)`,
            color: "#fff",
            fontWeight: 900,
            fontSize: 84,
            lineHeight: 1.1,
            textAlign: "center",
            padding: "16px 36px",
            background: "linear-gradient(180deg, rgba(228,30,90,0.92), rgba(176,16,72,0.92))",
            borderRadius: 28,
            textShadow: STROKE,
            maxWidth: 900,
          }}
        >
          {hook}
        </div>
      </AbsoluteFill>

      {/* Caption — bottom third */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 360,
          paddingInline: 70,
        }}
      >
        {active ? (
          <div
            key={activeIndex}
            style={{
              transform: `scale(${0.92 + captionPop * 0.08})`,
              opacity: captionPop,
              color: "#fff",
              fontWeight: 700,
              fontSize: 64,
              lineHeight: 1.25,
              textAlign: "center",
              textShadow: STROKE,
              WebkitTextStroke: "2px rgba(0,0,0,0.35)",
            }}
          >
            {active.text}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
