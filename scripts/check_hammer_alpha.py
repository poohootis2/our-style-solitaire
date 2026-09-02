from PIL import Image
from pathlib import Path

path = Path('/home/ubuntu/webdev-static-assets/card-breaker-shark-hammer-transparent-enhanced.png')
image = Image.open(path).convert('RGBA')
print('size=', image.size)
print('corner_pixels=', [image.getpixel(p) for p in [(0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1)]])
print('alpha_extrema=', image.getchannel('A').getextrema())
print('mode=', image.mode)

project = Path('/home/ubuntu/our-style-solitaire/assets/images/card-breaker-shark-hammer.png')
if project.exists():
    p = Image.open(project).convert('RGBA')
    print('project_size=', p.size)
    print('project_corner_pixels=', [p.getpixel(q) for q in [(0, 0), (p.width - 1, 0), (0, p.height - 1), (p.width - 1, p.height - 1)]])
    print('project_alpha_extrema=', p.getchannel('A').getextrema())
