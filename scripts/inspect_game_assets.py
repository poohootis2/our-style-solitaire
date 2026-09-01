from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "assets/images"
for folder in (ROOT / "monsters", ROOT / "characters", ROOT / "backgrounds" / "landscape", ROOT / "backgrounds" / "portrait"):
    print(f"[{folder.relative_to(ROOT)}]")
    for path in sorted(folder.iterdir()):
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
            continue
        with Image.open(path) as image:
            has_alpha = image.mode in {"RGBA", "LA"} or "transparency" in image.info
            print(f"{path.name}\t{image.width}x{image.height}\tmode={image.mode}\talpha={has_alpha}")
