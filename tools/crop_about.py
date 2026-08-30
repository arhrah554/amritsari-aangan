"""Reframe the About portrait to face, chest and his lit arm only.

The source has his left arm (x 78-92%) sitting in deep shadow, which made the
two arms read as mismatched. Rather than regrade it, the frame simply ends
before that arm. Crop bounds measured off a gridded copy of the source.
"""
from PIL import Image

im = Image.open('about.jpg').convert('RGB')          # 900x1200 ungraded original
w, h = im.size
L, R, T, B = 0.00, 0.745, 0.00, 0.88
out = im.crop((int(w*L), int(h*T), int(w*R), int(h*B)))
out.save('about_crop.jpg', quality=93, optimize=True)
print('%dx%d  aspect %.3f' % (out.width, out.height, out.width / out.height))
