"""Cut the chrome X out of the CoachX logo as its own asset (assets/x-mark.png).

assets/logo.png is the CoachX lockup exactly as supplied: the site's original
logo PNG (713x301, high-contrast wide COACH wordmark + chrome X).

The background X watermark has to be the logo's own blade X, not a drawn
stand-in. In logo.png the X is the single largest connected shape; each
wordmark letter is a separate small shape, so the X separates cleanly. Its
antialiased rim is kept by growing the mask 2px into the soft edge pixels.
Upscaled 4x (Lanczos) for full-frame use; at watermark opacity the
softening is invisible.

Also writes the logo split into layers on the logo's own canvas, so the parts
can be animated separately and still land in the exact lockup (every pixel
belongs to exactly one layer, so the stacked layers are the logo itself):
  assets/logo-x.png        the X
  assets/logo-word.png     the COACH wordmark
  assets/logo-blade-a.png  the "\\" blade (pixel centres inside its parallelogram)
  assets/logo-blade-b.png  the "/" blade (the rest of the X)
"""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('assets/logo.png').convert('RGBA')
a = np.array(im)
lab, n = ndimage.label(a[..., 3] > 8)
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
x_id = int(np.argmax(sizes)) + 1
# The wordmark is the letter-sized shapes (each COACH letter) grown 2px into
# their own soft rims. Everything else that has any alpha is the X: the big
# blade shape plus the few detached pixels at its tips (the tail of the "/"
# blade breaks into specks at the bottom-left).
letters = [i + 1 for i in range(n) if i + 1 != x_id and sizes[i] > 50]
word = (ndimage.binary_dilation(np.isin(lab, letters), iterations=2)
        & ~ndimage.binary_dilation(lab == x_id, iterations=2))
mask = (a[..., 3] > 0) & ~word
out = a.copy()
out[..., 3] = np.where(mask, a[..., 3], 0)
ys, xs = np.where(out[..., 3] > 0)
crop = Image.fromarray(out).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
big = crop.resize((crop.width * 4, crop.height * 4), Image.LANCZOS)
big.save('assets/x-mark.png', optimize=True)
print('x-mark', big.size)

# The same split at the logo's own size, for the reveal: two full-canvas
# layers that stack back into the exact lockup.
x_layer = a.copy(); x_layer[..., 3] = np.where(mask, a[..., 3], 0)
w_layer = a.copy(); w_layer[..., 3] = np.where(mask, 0, a[..., 3])
Image.fromarray(x_layer).save('assets/logo-x.png', optimize=True)
Image.fromarray(w_layer).save('assets/logo-word.png', optimize=True)
print('logo layers', im.size)

# The two blades of the X. Blade A is the "\" stroke: the parallelogram
# whose top edge spans x 457..539 and bottom edge x 692..774 (logo pixels).
# Where the strokes cross, blade A is the one on top, so it owns the crossing.
ax0, ax1, bx0, bx1 = 456.98, 539.03, 692.01, 773.99
h, w = a.shape[:2]
yy, xx = np.mgrid[0:h, 0:w] + 0.5
t = yy / h
in_a = (xx >= ax0 + (bx0 - ax0) * t) & (xx <= ax1 + (bx1 - ax1) * t)
blade_a = mask & in_a
blade_b = mask & ~in_a
for name, m in (('a', blade_a), ('b', blade_b)):
    layer = a.copy(); layer[..., 3] = np.where(m, a[..., 3], 0)
    Image.fromarray(layer).save(f'assets/logo-blade-{name}.png', optimize=True)
print('blades', int(blade_a.sum()), int(blade_b.sum()))
