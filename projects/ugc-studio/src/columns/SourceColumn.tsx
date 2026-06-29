import { useEffect, useState, useMemo } from "react";
import { Accordion } from "../components/Accordion";
import { AvatarGrid } from "../components/AvatarGrid";
import { fetchAvatars, type Avatar, type Template } from "../lib/api";

// §1 in the studio is read-only on everything decided upstream (product image came from ตั้งโจทย์, baked into prompts).
// the ONLY genuine studio input is the Avatar — and only when the clip actually has a preset presenter (template "avatar").
export function SourceColumn({
  images, avatarId, setAvatarId, onZoom, template, personaHint, onBack,
}: {
  images: File[];
  avatarId: string | null;
  setAvatarId: (id: string) => void;
  onZoom: (a: Avatar) => void;
  template: Template;
  personaHint?: string;        // storyboard speaker → guide the avatar choice toward the written persona
  onBack: () => void;          // jump back to ตั้งโจทย์ to change the product
}) {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAvatars().then(setAvatars).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  const previews = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const needsAvatar = template === "avatar"; // full/no_person generate the person from the prompt — no preset

  return (
    <>
      <Accordion title="รูปสินค้า" subtitle="(จากตั้งโจทย์)">
        {images.length > 0 ? (
          <>
            <div className="hint">reference ที่ใช้ในทุก scene — แก้ได้ที่ “ตั้งโจทย์”</div>
            <div className="thumbs">
              {images.map((_, i) => (
                <div className="t" key={i}><img src={previews[i]} alt="" /></div>
              ))}
            </div>
          </>
        ) : (
          <div className="src-empty">
            ยังไม่มีรูปสินค้า
            <button className="link-btn" onClick={onBack}>＋ เพิ่มที่ตั้งโจทย์ →</button>
          </div>
        )}
      </Accordion>

      <Accordion title="เลือก Avatar" subtitle={needsAvatar ? "(พรีเซนเตอร์)" : "(ไม่ต้องสำหรับทรงนี้)"}>
        {needsAvatar ? (
          <>
            <div className="hint">หน้าตาพรีเซนเตอร์ที่จะมาพูดขายของ{personaHint ? <> · บทเขียนไว้สำหรับ <b style={{ color: "var(--accent)" }}>{personaHint}</b> เลือกให้เข้าโทน</> : null}</div>
            <AvatarGrid avatars={avatars} loading={loading} error={error} selected={avatarId} onSelect={setAvatarId} onZoom={onZoom} />
          </>
        ) : (
          <div className="src-empty">พรีเซนเตอร์จะถูก<b style={{ color: "var(--text)" }}> สร้างจาก prompt</b> อัตโนมัติ — ไม่ต้องเลือก avatar สำหรับทรง “{template === "no_person" ? "ไม่เห็นคน" : "Full pipeline"}”</div>
        )}
      </Accordion>
    </>
  );
}
