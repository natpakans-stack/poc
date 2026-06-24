import { Composition } from "remotion";
import { UgcVideo } from "./UgcVideo";
import type { UgcVideoProps } from "./types";

const FPS = 30;

// Demo props — replaced at render time by the pipeline (--props). AURA serum live-selling sample.
const demoProps: UgcVideoProps = {
  durationInSeconds: 11.76,
  hook: "เซรั่มหน้าใส แค่ทาก็ออร่า!",
  sfx: true,
  clips: [
    { src: "demo.mp4", startFromMs: 0, startMs: 0, endMs: 4300 },
    { src: "clip0.mp4", startMs: 4300, endMs: 6000 },
    { src: "demo.mp4", startFromMs: 11000, startMs: 6000, endMs: 9700, transition: true },
    { src: "clip3.mp4", startMs: 9700, endMs: 11760, transition: true },
  ],
  captions: [
    { text: "หน้าใสออร่า", startMs: 0, endMs: 2080 },
    { text: "ทาแล้วออร่า", startMs: 2240, endMs: 5320 },
    { text: "ซึมไวมาก", startMs: 5387, endMs: 7280 },
    { text: "ลดจุดด่างดำ", startMs: 7400, endMs: 9680 },
    { text: "ราคาพิเศษ", startMs: 9740, endMs: 11760 },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="UgcVideo"
      component={UgcVideo}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={demoProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round(props.durationInSeconds * FPS),
      })}
    />
  );
};
