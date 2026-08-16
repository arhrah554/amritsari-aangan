"""Even out how the two arms read on the About portrait.

Measured first: the skin on both arms is almost the same brightness
(94.8 vs 86.9 of 255). The arms don't differ in exposure — what differs is
how much of the shadowed arm is *separable* from the background. Its outer
edge falls off into black, so the silhouette gets eaten and the arm reads
thinner (lit-flesh coverage 70% vs 56%).

So the fix is not to brighten the arm. An earlier attempt masked a region and
lifted everything dark inside it, which also lifted his black t-shirt and the
gym background into grey and left a visible mask edge — the uncanny result.

Instead this is a gentle GLOBAL shadow lift: no spatial mask, so there is no
patch and no seam anywhere. It raises only the deepest tones, which pulls the
background just far enough off black for the arm's edge to separate. Mid-tones
and highlights are untouched, so the grade still reads as the original photo.
"""
import os

import numpy as np
from PIL import Image

STRENGTH = float(os.environ.get("STR", "0.10"))

src = Image.open('about.jpg').convert('RGB')
a = np.asarray(src).astype(np.float32) / 255.0
lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)


def smooth(t, lo, hi):
    t = np.clip((t - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


lift = STRENGTH * (1.0 - smooth(lum, 0.02, 0.30))
out = np.clip(a + lift[..., None] * (1.0 - a), 0, 1)
Image.fromarray((out * 255).astype(np.uint8)).save(
    'about_fixed.jpg', quality=92, optimize=True)


def coverage(path, x0, x1, y0, y1):
    g = np.asarray(Image.open(path).convert('L')).astype(np.float32) / 255.0
    h, w = g.shape
    r = g[int(h * y0):int(h * y1), int(w * x0):int(w * x1)]
    return 100 * ((r > 0.13) & (r < 0.85)).mean()


KEYED = (0.12, 0.23, 0.42, 0.92)
SHADOW = (0.77, 0.93, 0.48, 0.98)
print("lit-flesh coverage    his right arm   his left arm")
print("  before                 %5.1f%%         %5.1f%%" % (
    coverage('about.jpg', *KEYED), coverage('about.jpg', *SHADOW)))
print("  after                  %5.1f%%         %5.1f%%" % (
    coverage('about_fixed.jpg', *KEYED), coverage('about_fixed.jpg', *SHADOW)))
