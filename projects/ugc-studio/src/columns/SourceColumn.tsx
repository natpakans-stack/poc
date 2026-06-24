import { useEffect, useState, useMemo } from "react";
import { Accordion } from "../components/Accordion";
import { AvatarGrid } from "../components/AvatarGrid";
import { fetchAvatars, type Avatar } from "../lib/api";

export function SourceColumn({
  images, setImages, refVideo, setRefVideo, avatarId, setAvatarId, onZoom,
}: {
  images: File[];
  setImages: (f: File[]) => void;
  refVideo: File | null;
  setRefVideo: (f: File | null) => void;
  avatarId: string | null;
  setAvatarId: (id: string) => void;
  onZoom: (a: Avatar) => void;
}) {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAvatars()
      .then(setAvatars)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // object URLs for product thumbnails — revoked when the file list changes
  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  const refUrl = useMemo(() => (refVideo ? URL.createObjectURL(refVideo) : null), [refVideo]);
  useEffect(() => () => { if (refUrl) URL.revokeObjectURL(refUrl); }, [refUrl]);

  return (
    <>
      <Accordion title="รูปสินค้า" subtitle="(4–5 มุม)">
        <div className="hint">หลายมุม — ใช้เป็น reference ให้วิดีโอ</div>
        <label className="drop" htmlFor="imgInput">＋ ลากวาง หรือคลิกเพื่อเลือกรูป</label>
        <input
          type="file" id="imgInput" accept="image/*" multiple
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = "";
            setImages([...images, ...files]);
          }}
        />
        <div className="thumbs">
          {images.map((_, i) => (
            <div className="t" key={i}>
              <img src={previews[i]} alt="" />
              <button onClick={() => setImages(images.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
      </Accordion>

      <Accordion title="Reference video" subtitle="(ไม่บังคับ · beta)">
        <div className="hint">สไตล์ที่อยากได้ — ใช้เป็น ad-reference</div>
        <label className="drop" htmlFor="refInput">＋ เลือกวิดีโออ้างอิง</label>
        <input
          type="file" id="refInput" accept="video/*"
          onChange={(e) => setRefVideo(e.target.files?.[0] ?? null)}
        />
        {refUrl && (
          <div className="thumbs">
            <div className="t">
              <video src={refUrl} muted />
              <button onClick={() => setRefVideo(null)}>✕</button>
            </div>
          </div>
        )}
      </Accordion>

      <Accordion title="เลือก Avatar" subtitle="(พรีเซนเตอร์)">
        <div className="hint">หน้าตาพรีเซนเตอร์ที่จะมาพูดขายของ</div>
        <AvatarGrid
          avatars={avatars} loading={loading} error={error}
          selected={avatarId} onSelect={setAvatarId} onZoom={onZoom}
        />
      </Accordion>
    </>
  );
}
