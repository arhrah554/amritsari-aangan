"""Widen the hero photo to a cinematic canvas.

The source is nearly square (1100x1143). With background-size:cover on a wide
viewport it scales to fit the WIDTH, which blows his face up to more than half
the screen and leaves no room for the copy underneath. Extending the canvas to
~16:9 makes cover scale to the HEIGHT instead, so the subject reads at a
natural size and the headline can sit below his face.

The added space is filled with a mirrored, heavily blurred continuation of the
gym background, darkened so it sits behind the existing edge vignette.
"""
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

src = Image.open('hero.jpg').convert('RGB')
w, h = src.size                      # 1100 x 1143
W = 2032                             # 16:9 against the source height
X = 470                              # subject lands slightly left of centre

canvas = Image.new('RGB', (W, h))

def wing(strip, width, flip):
    """Mirror + blur an edge slice out to `width`, then sink it into shadow."""
    s = strip.transpose(Image.FLIP_LEFT_RIGHT) if flip else strip
    s = s.resize((width, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(38))
    s = ImageEnhance.Brightness(s).enhance(0.55)
    return ImageEnhance.Contrast(s).enhance(0.85)

canvas.paste(wing(src.crop((0, 0, 150, h)), X, True), (0, 0))
canvas.paste(wing(src.crop((w - 150, 0, w, h)), W - X - w, False), (X + w, 0))
canvas.paste(src, (X, 0))

# feather the two seams so the joins are invisible
a = np.asarray(canvas).astype(np.float32)
blur = np.asarray(canvas.filter(ImageFilter.GaussianBlur(16))).astype(np.float32)
xs = np.arange(W, dtype=np.float32)
seam = np.zeros(W, dtype=np.float32)
for edge in (X, X + w):
    seam = np.maximum(seam, np.clip(1.0 - np.abs(xs - edge) / 46.0, 0, 1))
a = a * (1 - seam[None, :, None]) + blur * seam[None, :, None]

Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(
    'hero_wide.jpg', quality=88, optimize=True)

out = Image.open('hero_wide.jpg')
print('hero_wide:', out.size, 'aspect %.2f' % (out.size[0] / out.size[1]),
      '| %d KB' % (len(open('hero_wide.jpg','rb').read()) // 1024))
out.resize((out.width // 3, out.height // 3)).save('hero_wide_view.png')
