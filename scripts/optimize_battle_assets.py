from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets/images"

for path in sorted((ROOT / "monsters").glob("*.png")):
    with Image.open(path) as image:
        image = image.convert("RGBA")
        image.thumbnail((768, 768), Image.Resampling.LANCZOS)
        image.save(path, format="PNG", optimize=True, compress_level=9)

for folder, size in ((ROOT / "backgrounds" / "landscape", (1280, 720)), (ROOT / "backgrounds" / "portrait", (900, 1600))):
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg"}:
            continue
        with Image.open(path) as source:
            source = source.convert("RGBA")
            source.thumbnail(size, Image.Resampling.LANCZOS)
            if source.size != size:
                canvas = Image.new("RGBA", size, "#101522")
                left = (size[0] - source.width) // 2
                top = (size[1] - source.height) // 2
                canvas.alpha_composite(source, (left, top))
                source = canvas
            target = path.with_suffix(".jpg")
            source.convert("RGB").save(target, format="JPEG", quality=80, optimize=True, progressive=True)
        if target != path:
            path.unlink()

print("optimized battle assets")
