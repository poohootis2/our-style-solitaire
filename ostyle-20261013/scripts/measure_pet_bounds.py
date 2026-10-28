from pathlib import Path
from PIL import Image
import re

ROOT = Path('/home/ubuntu/our-style-solitaire')
PETS = ROOT / 'assets/images/characters/pets'
CHARS = ROOT / 'assets/images/characters'
BURST = ROOT / 'assets/images/shuffle-burst.png'
OUT = ROOT / 'lib/pet-visible-anchor.ts'

entries: list[tuple[str, Path]] = []
for image_path in sorted(PETS.glob('*.png')):
    match = re.match(r'(\d+)-pet', image_path.stem)
    if match:
        entries.append((f'pet-{match.group(1)}', image_path))

entries.extend([
    ('cloud-tiger', CHARS / '029_구름 호랑이.png'),
    ('gumiho-tail', CHARS / '042_구미호 꼬리.png'),
    ('mochi-rabbit', CHARS / '051_모찌 토끼.png'),
])

def visible_anchor(image_path: Path) -> tuple[float, float, float]:
    image = Image.open(image_path).convert('RGBA')
    alpha = image.getchannel('A')
    # Ignore nearly transparent antialias pixels when deriving the visual center.
    mask = alpha.point(lambda value: 255 if value >= 24 else 0)
    bounds = mask.getbbox()
    if not bounds:
        return (0.5, 0.5, 1.0)
    left, top, right, bottom = bounds
    width, height = image.size
    center_x = round(((left + right) / 2) / width, 4)
    center_y = round(((top + bottom) / 2) / height, 4)
    visual_span = round(max(right - left, bottom - top) / max(width, height), 4)
    return (center_x, center_y, visual_span)

lines = [
    '/** Generated from each PNG alpha channel; do not edit by hand. */',
    'export type PetVisibleAnchor = { centerX: number; centerY: number; span: number };',
    '',
    'const DEFAULT_ANCHOR: PetVisibleAnchor = { centerX: 0.5, centerY: 0.5, span: 0.9 };',
    'const PET_VISIBLE_ANCHORS: Record<string, PetVisibleAnchor> = {',
]
for pet_id, image_path in entries:
    center_x, center_y, span = visible_anchor(image_path)
    lines.append(f'  "{pet_id}": {{ centerX: {center_x}, centerY: {center_y}, span: {span} }},')
burst_x, burst_y, burst_span = visible_anchor(BURST)
lines.extend([
    '};',
    '',
    f'export const SHUFFLE_BURST_VISIBLE_ANCHOR: PetVisibleAnchor = {{ centerX: {burst_x}, centerY: {burst_y}, span: {burst_span} }};',
    '',
    'export function getPetVisibleAnchor(petId: string): PetVisibleAnchor {',
    '  return PET_VISIBLE_ANCHORS[petId] ?? DEFAULT_ANCHOR;',
    '}',
    '',
])
OUT.write_text('\n'.join(lines), encoding='utf-8')
print(f'Wrote {OUT} with {len(entries)} visual anchors')
