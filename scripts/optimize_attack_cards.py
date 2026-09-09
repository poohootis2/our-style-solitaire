from pathlib import Path
from PIL import Image

source_dir = Path('/home/ubuntu/webdev-static-assets')
target_dir = Path('/home/ubuntu/our-style-solitaire/assets/images/attack-cards')
target_dir.mkdir(parents=True, exist_ok=True)

for name in ('fire', 'ice', 'lightning', 'shadow'):
    source = source_dir / f'attack-{name}-card.png'
    target = target_dir / f'attack-{name}-card.webp'
    image = Image.open(source).convert('RGBA')
    image.thumbnail((768, 768), Image.Resampling.LANCZOS)
    image.save(target, 'WEBP', lossless=False, quality=88, method=6)
    print(f'{target}: {target.stat().st_size} bytes')
