from PIL import Image
from pathlib import Path

source = Path('/home/ubuntu/our-style-solitaire/assets/images/royal-card-sprite.png')
target = source.with_name('royal-card-sprite-optimized.png')
image = Image.open(source).convert('RGB')
# Keep the 4:3 sprite geometry while reducing the native asset size for APK inclusion.
for width in (1600, 1400, 1200, 1000, 896, 800):
    height = round(width * image.height / image.width)
    candidate = image.resize((width, height), Image.Resampling.LANCZOS)
    candidate.save(target, 'PNG', optimize=True, compress_level=9)
    if target.stat().st_size <= 950_000:
        break
source.unlink()
target.replace(source)
print(f'{source}: {image.size} -> {Image.open(source).size}, {source.stat().st_size} bytes')
