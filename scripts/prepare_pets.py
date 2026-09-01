from pathlib import Path
from PIL import Image
import re

root = Path('.pet-assets/펫도감')
out = Path('assets/images/characters/pets')
out.mkdir(parents=True, exist_ok=True)
entries = []
for source in sorted(root.glob('*.png')):
    match = re.match(r'(\d+)_', source.stem)
    if not match:
        continue
    pet_id = int(match.group(1))
    name = source.stem.split('_', 1)[1]
    safe = re.sub(r'[^a-zA-Z0-9]+', '-', name).strip('-').lower() or f'pet-{pet_id}'
    target = out / f'{pet_id:03d}-{safe}.png'
    with Image.open(source) as image:
        image = image.convert('RGBA')
        image.thumbnail((160, 160), Image.Resampling.LANCZOS)
        image.save(target, 'PNG', optimize=True)
    rel = target.as_posix().replace('assets/images/', '')
    entries.append((pet_id, name, rel))

lines = [
    'import type { BattleAsset } from "./battle-content";',
    '',
    'export const PET_ROSTER: BattleAsset[] = [',
]
for pet_id, name, rel in entries:
    lines.append(f'  {{ id: "pet-{pet_id:03d}", name: {name!r}, image: require("../assets/images/{rel}"), attackStyle: "white" }},')
lines.extend(['];', '', 'export const PET_IDS = PET_ROSTER.map((pet) => pet.id);', ''])
Path('lib/pet-content.ts').write_text('\n'.join(lines), encoding='utf-8')
print(f'prepared {len(entries)} pets')
print(f'total bytes: {sum(p.stat().st_size for p in out.glob("*.png"))}')
