from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/upload/attack_effect_04.png')
target = Path('/home/ubuntu/our-style-solitaire/assets/images/shuffle-burst.png')
target.parent.mkdir(parents=True, exist_ok=True)
image = Image.open(source).convert('RGBA')
image.thumbnail((512, 512), Image.Resampling.LANCZOS)
image.save(target, format='PNG', optimize=True)
print(f'{target} {target.stat().st_size} bytes {image.size}')
