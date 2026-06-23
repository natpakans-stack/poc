import { Composition } from "remotion";
import { UgcVideo } from "./UgcVideo";
import type { UgcVideoProps } from "./types";

const FPS = 30;

// Demo props — replaced at render time by the pipeline (--props). AURA serum live-selling sample.
const demoProps: UgcVideoProps = {
  videoSrc: "demo.mp4",
  videoDurationInSeconds: 15.09,
  hook: "ฉ่ำวาวใน 7 วัน ✨",
  captions: [
    { text: "ผิวโทรมๆ แบบนี้ ฟื้นได้ใน 7 วัน", startMs: 0, endMs: 3000 },
    { text: "AURA เซรั่มเข้มข้น ซึมไว ไม่เหนียวเหนอะ", startMs: 3000, endMs: 6200 },
    { text: "วิตามินซี + ไฮยา ฉ่ำวาวตั้งแต่หยดแรก", startMs: 6200, endMs: 9500 },
    { text: "ลดเลือนจุดด่างดำ หน้าใสขึ้นเห็นชัด", startMs: 9500, endMs: 12500 },
    { text: "วันนี้ลด 50% เฉพาะไลฟ์ รีบกดสั่งเลย!", startMs: 12500, endMs: 15090 },
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
        durationInFrames: Math.round(props.videoDurationInSeconds * FPS),
      })}
    />
  );
};
