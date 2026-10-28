from collections import deque
from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/webdev-static-assets/card-breaker-shark-hammer-transparent-enhanced.png')
output = Path('/home/ubuntu/our-style-solitaire/assets/images/card-breaker-shark-hammer.png')
image = Image.open(source).convert('RGBA')
width, height = image.size
pixels = image.load()

# Remove only bright neutral pixels connected to the image border.
# This preserves white teeth/highlights enclosed by the dark character outline.
def removable(x: int, y: int) -> bool:
    r, g, b, _ = pixels[x, y]
    return min(r, g, b) >= 218 and max(r, g, b) - min(r, g, b) <= 20

visited = bytearray(width * height)
queue = deque()
for x in range(width):
    queue.append((x, 0)); queue.append((x, height - 1))
for y in range(height):
    queue.append((0, y)); queue.append((width - 1, y))

while queue:
    x, y = queue.popleft()
    index = y * width + x
    if visited[index] or not removable(x, y):
        continue
    visited[index] = 1
    r, g, b, _ = pixels[x, y]
    pixels[x, y] = (r, g, b, 0)
    if x > 0: queue.append((x - 1, y))
    if x + 1 < width: queue.append((x + 1, y))
    if y > 0: queue.append((x, y - 1))
    if y + 1 < height: queue.append((x, y + 1))

# Keep the full subject while reducing the asset for mobile use.
image.thumbnail((768, 768), Image.Resampling.LANCZOS)
image.save(output, 'PNG', optimize=True)
print(f'written={output} size={output.stat().st_size} dimensions={image.size}')
