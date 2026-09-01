from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44_100
OUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "sounds"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def envelope(t: float, duration: float, attack: float = 0.006, release: float = 0.06) -> float:
    attack_part = min(1.0, t / max(attack, 1e-6))
    release_start = max(0.0, duration - release)
    release_part = 1.0 if t < release_start else max(0.0, (duration - t) / max(release, 1e-6))
    return attack_part * release_part


def tone(t: float, frequency: float, decay: float, phase: float = 0.0) -> float:
    return math.sin(2.0 * math.pi * frequency * t + phase) * math.exp(-decay * t)


def noise(rng: random.Random) -> float:
    return rng.uniform(-1.0, 1.0)


def make_effect(name: str, duration: float, sample_fn) -> None:
    count = int(SAMPLE_RATE * duration)
    frames: list[bytes] = []
    for index in range(count):
        t = index / SAMPLE_RATE
        value = max(-1.0, min(1.0, sample_fn(t, duration)))
        sample = int(value * 0.78 * 32767)
        frames.append(struct.pack("<h", sample))
    path = OUT_DIR / name
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(b"".join(frames))


# A dry tap with a tiny bright confirmation ping.
def card_select(t: float, duration: float) -> float:
    return envelope(t, duration, 0.001, 0.055) * (
        0.72 * tone(t, 920, 32) + 0.28 * tone(t, 1680, 25)
    )


# A short card slide: filtered noise followed by a paper-like click.
def card_move(t: float, duration: float) -> float:
    rng = random.Random(17 + int(t * SAMPLE_RATE))
    whoosh = noise(rng) * (1.0 - t / duration) * 0.28
    click = 0.68 * tone(max(0.0, t - 0.13), 520, 20) if t >= 0.13 else 0.0
    return envelope(t, duration, 0.004, 0.08) * (whoosh + click)


# Three compact flutter taps for a stock shuffle/draw.
def card_shuffle(t: float, duration: float) -> float:
    taps = 0.0
    for start, freq in ((0.035, 620), (0.13, 760), (0.225, 980)):
        if t >= start:
            local = t - start
            taps += 0.32 * tone(local, freq, 35)
    return envelope(t, duration, 0.002, 0.08) * taps


# Friendly companion launch: rising magical sweep with a crisp sparkle.
def companion_attack(t: float, duration: float) -> float:
    rng = random.Random(29 + int(t * SAMPLE_RATE))
    sweep_freq = 360.0 + 1320.0 * min(1.0, t / duration)
    sweep = 0.42 * math.sin(2.0 * math.pi * sweep_freq * t) * (1.0 - 0.55 * t / duration)
    air = noise(rng) * 0.13 * (1.0 - t / duration)
    sparkle = 0.3 * tone(max(0.0, t - 0.22), 1880, 28) if t >= 0.22 else 0.0
    return envelope(t, duration, 0.004, 0.09) * (sweep + air + sparkle)


# Noble Ace/foundation strike: two-note chime and a compact burst.
def foundation_attack(t: float, duration: float) -> float:
    first = 0.42 * tone(t, 740, 7)
    second = 0.32 * tone(max(0.0, t - 0.12), 1180, 10) if t >= 0.12 else 0.0
    burst = 0.22 * tone(max(0.0, t - 0.25), 2050, 24) if t >= 0.25 else 0.0
    return envelope(t, duration, 0.004, 0.12) * (first + second + burst)


make_effect("card-select.wav", 0.18, card_select)
make_effect("card-move.wav", 0.30, card_move)
make_effect("card-shuffle.wav", 0.34, card_shuffle)
make_effect("companion-attack.wav", 0.46, companion_attack)
make_effect("foundation-attack.wav", 0.48, foundation_attack)
print(f"Created 5 short SFX in {OUT_DIR}")
