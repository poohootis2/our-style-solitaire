#!/bin/sh
set -eu

mkdir -p assets/sounds

# Short, original UI effects for the game. They contain no sampled third-party audio.
ffmpeg -y -f lavfi -i "sine=frequency=660:sample_rate=44100:duration=0.10" \
  -af "volume=0.11,afade=t=out:st=0.055:d=0.045" \
  assets/sounds/card-select.wav >/dev/null 2>&1

ffmpeg -y -f lavfi -i "sine=frequency=460:sample_rate=44100:duration=0.17" \
  -af "volume=0.13,afade=t=in:st=0:d=0.02,afade=t=out:st=0.09:d=0.08" \
  assets/sounds/card-move.wav >/dev/null 2>&1
