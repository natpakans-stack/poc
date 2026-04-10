#!/usr/bin/env python3
"""Speech-to-Text: อัดเสียงจากไมค์แล้วแปลงเป็นข้อความด้วย Whisper"""

import sys
import tempfile
import sounddevice as sd
import soundfile as sf
import whisper
import numpy as np

# ตั้งค่า
MODEL_NAME = "turbo"       # เปลี่ยนเป็น "base", "small", "medium", "large" ได้
SAMPLE_RATE = 16000        # Whisper ใช้ 16kHz
LANGUAGE = "th"            # ภาษาไทย (เปลี่ยนเป็น "en" สำหรับอังกฤษ, None สำหรับ auto-detect)


def record_audio(duration: int = None) -> np.ndarray:
    """อัดเสียงจากไมค์ — กด Enter เพื่อหยุด หรือกำหนดจำนวนวินาที"""
    if duration:
        print(f"\n🎙️  กำลังอัดเสียง {duration} วินาที...")
        audio = sd.rec(int(duration * SAMPLE_RATE), samplerate=SAMPLE_RATE, channels=1, dtype="float32")
        sd.wait()
    else:
        print("\n🎙️  กำลังอัดเสียง... กด Enter เพื่อหยุด")
        frames = []
        recording = True

        def callback(indata, frame_count, time_info, status):
            if recording:
                frames.append(indata.copy())

        stream = sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype="float32", callback=callback)
        stream.start()
        input()  # รอกด Enter
        recording = False
        stream.stop()
        stream.close()
        audio = np.concatenate(frames, axis=0) if frames else np.array([])

    print("✅ อัดเสียงเสร็จแล้ว")
    return audio.flatten()


def transcribe(audio: np.ndarray, model) -> dict:
    """แปลงเสียงเป็นข้อความ"""
    print("⏳ กำลังแปลงเสียงเป็นข้อความ...")

    # บันทึกเป็นไฟล์ชั่วคราว
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        sf.write(f.name, audio, SAMPLE_RATE)
        result = model.transcribe(f.name, language=LANGUAGE, fp16=False)

    return result


def main():
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else None

    print("=" * 50)
    print("  Speech-to-Text (Whisper)")
    print("=" * 50)
    print(f"  Model: {MODEL_NAME}")
    print(f"  Language: {LANGUAGE or 'auto-detect'}")
    print(f"  Duration: {f'{duration}s' if duration else 'กด Enter เพื่อหยุด'}")
    print("=" * 50)

    # โหลด model (ครั้งแรกจะ download)
    print(f"\n📦 กำลังโหลด model '{MODEL_NAME}'...")
    model = whisper.load_model(MODEL_NAME)
    print("✅ โหลด model เสร็จแล้ว")

    while True:
        audio = record_audio(duration)

        if len(audio) < SAMPLE_RATE * 0.5:
            print("⚠️  เสียงสั้นเกินไป ลองใหม่")
            continue

        result = transcribe(audio, model)

        print("\n" + "─" * 50)
        print("📝 ผลลัพธ์:")
        print(result["text"])
        print("─" * 50)

        again = input("\n🔄 อัดเสียงอีกครั้ง? (Enter = ใช่ / q = ออก): ").strip().lower()
        if again == "q":
            print("👋 ลาก่อน!")
            break


if __name__ == "__main__":
    main()
