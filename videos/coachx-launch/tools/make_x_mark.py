"""Cut the chrome X out of the CoachX logo as its own asset (assets/x-mark.png).

The background X watermark has to be the logo's own blade X, not a drawn
stand-in. In logo.png the X is the single largest connected shape; each
wordmark letter is a separate small shape, so the X separates cleanly. Its
antialiased rim is kept by growing the mask 2px into the soft edge pixels.
Upscaled 4x (Lanczos) for full-frame use; at watermark opacity the
softening is invisible.

Also writes assets/logo-x.png and assets/logo-word.png: the logo split into
its X and its wordmark on the logo's own canvas, so the two can be animated
separately and still land in the exact lockup.
"""
import numpy as np
from PIL import Image
from scipy import ndimage

im = Image.open('assets/logo.png').convert('RGBA')
a = np.array(im)
lab, n = ndimage.label(a[..., 3] > 8)
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
x_id = int(np.argmax(sizes)) + 1
mask = ndimage.binary_dilation(lab == x_id, iterations=2) & (a[..., 3] > 0)
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
