"""Even out the key light on the About portrait.

His left arm (frame right) sits in deep shadow while his right arm is fully
keyed, which makes the shadowed arm read thinner than it is. This lifts the
shadows in that region only, weighted so already-bright pixels (the light
strip behind him) are untouched.
"""
import numpy as np
from PIL import Image, ImageFilter

src = Image.open('about.jpg').convert('RGB')
w, h = src.size
a = np.asarray(src).astype(np.float32) / 255.0
lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)

xs = np.linspace(0, 1, w, dtype=np.float32)
ys = np.linspace(0, 1, h, dtype=np.float32)

def ramp(t, lo, hi):
    """smoothstep from 0 at lo to 1 at hi"""
    t = np.clip((t - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)

# horizontal: ride up over his left arm, taper off before the background clutter
mx = ramp(xs, 0.50, 0.66) * (1 - ramp(xs, 0.82, 0.94))
# vertical: shoulder down to the dumbbell, fading at both ends
my = ramp(ys, 0.20, 0.32) * (1 - ramp(ys, 0.88, 1.0))
spatial = np.outer(my, mx)

# feather the mask so the lift has no visible edge
spatial = np.asarray(
    Image.fromarray((spatial * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(42))
).astype(np.float32) / 255.0

# only lift shadows: full strength at black, nothing above mid-grey
shadow_w = np.clip(1.0 - lum / 0.42, 0, 1) ** 1.5

lift = float(__import__("os").environ.get("STR","0.26")) * spatial * shadow_w
out = a + lift[..., None] * (1.0 - a)          # screen-style lift, cannot clip

# restore a little local contrast so the arm keeps its definition
detail = lum - np.asarray(
    Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
).astype(np.float32) / 255.0
out += (detail * 0.55 * spatial)[..., None]

out = np.clip(out, 0, 1)
Image.fromarray((out * 255).astype(np.uint8)).save('about_fixed.jpg', quality=92, optimize=True)

# report
g = Image.open('about_fixed.jpg').convert('L')
old = Image.open('about.jpg').convert('L')
import PIL.ImageStat as S
def band(img, x0, x1):
    return S.Stat(img.crop((int(w*x0), int(h*0.32), int(w*x1), int(h*0.85)))).mean[0]
print("            his RIGHT arm (lit)   his LEFT arm (shadow)")
print("before:        %5.1f                 %5.1f" % (band(old, .08, .28), band(old, .58, .80)))
print("after:         %5.1f                 %5.1f" % (band(g, .08, .28), band(g, .58, .80)))
