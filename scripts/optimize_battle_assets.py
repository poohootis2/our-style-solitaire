from pathlib import Path
import wave
from PIL import Image

root = Path(__file__).resolve().parents[1]
monster_dir = root / "assets" / "images" / "monsters"
keep = monster_dir / "boss_coral_golem_king.png"
for path in monster_dir.glob("*.png"):
    if path != keep:
        path.unlink()

image = Image.open(keep).convert("RGBA")
image.thumbnail((768, 768), Image.Resampling.LANCZOS)
image.save(keep, optimize=True)

source = root / "assets" / "sounds" / "card-attack.wav"
tmp = source.with_suffix(".tmp.wav")
with wave.open(str(source), "rb") as inp:
    frames = inp.readframes(inp.getnframes())
    channels = inp.getnchannels()
    rate = inp.getframerate()
    width = inp.getsampwidth()

if channels > 1:
    sample_width = width
    samples = [int.from_bytes(frames[i:i+sample_width], "little", signed=True) for i in range(0, len(frames), sample_width)]
    mono = []
    for i in range(0, len(samples), channels):
        mono.append(int(sum(samples[i:i+channels]) / min(channels, len(samples[i:i+channels]))))
    frames = b"".join(max(-32768, min(32767, s)).to_bytes(2, "little", signed=True) for s in mono)
    channels = 1
    width = 2
with wave.open(str(tmp), "wb") as out:
    out.setnchannels(channels)
    out.setsampwidth(width)
    out.setframerate(min(rate, 22050))
    out.writeframes(frames)
tmp.replace(source)
print(f"monster={keep.stat().st_size} bytes")
print(f"attack={source.stat().st_size} bytes")
