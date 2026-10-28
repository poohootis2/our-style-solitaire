from pathlib import Path
from PIL import Image

src = Path("assets/images/card-breaker-shark-hammer.png")
tmp = Path("assets/images/card-breaker-shark-hammer.optimized.png")
max_dimension = 768

with Image.open(src) as image:
    image = image.convert("RGBA")
    scale = min(1.0, max_dimension / max(image.size))
    if scale < 1.0:
        size = (round(image.width * scale), round(image.height * scale))
        image = image.resize(size, Image.Resampling.LANCZOS)
    image.save(tmp, format="PNG", optimize=True, compress_level=9)

tmp.replace(src)
print(f"optimized={src} size={src.stat().st_size} bytes dimensions={image.size}")
