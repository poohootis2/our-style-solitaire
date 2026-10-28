from __future__ import annotations

import wave
from pathlib import Path

sound_dir = Path(__file__).resolve().parents[1] / "assets" / "sounds"
expected = [
    "card-select.wav",
    "card-move.wav",
    "card-shuffle.wav",
    "companion-attack.wav",
    "foundation-attack.wav",
]

for name in expected:
    path = sound_dir / name
    with wave.open(str(path), "rb") as wav:
        duration = wav.getnframes() / wav.getframerate()
    if duration > 1.0:
        raise SystemExit(f"{name} is too long: {duration:.3f}s")
    print(f"{name}: {duration:.3f}s")

long_effect = sound_dir / "card-attack.mp3"
if long_effect.exists():
    raise SystemExit("The obsolete long card-attack.mp3 still exists")
print("All short SFX checks passed")
