"""Rebuild the CoachX lockup with the wordmark from the carousel deck.

The X is the brand mark and is carried over from the existing logo untouched,
sitting exactly where it always sat. Only the wordmark changes: the site set
COACH in a serif, the deck sets it in a geometric sans, so that is what gets
rendered here.

Type proportions come off the deck slides, averaged over all 8 so JPEG noise
does not move the edges:

    cap height / X height   12/75    = 0.160   (the old logo ran 0.133)
    letter advance          23.5/12  = 1.958 cap heights

Those two land the wordmark within a few percent of the old one's footprint --
the deck simply sets bigger letters on tighter tracking -- so the new wordmark
is hung off the old one's right edge and cap-band centre. That keeps its
relationship to the X, and the typeface is the only thing that moves.
"""
import base64
import io
import re

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = "/mnt/skills/examples/canvas-design/canvas-fonts/Outfit-Regular.ttf"
SRC = "/home/user/amritsari-aangan/coachx.html"

CAP_RATIO = 0.160
ADVANCE = 1.958
H = 301          # the X keeps the height it already had, so it is carried over
SS = 4           # supersampling for the type

html = open(SRC, encoding="utf-8").read()
old = re.search(r"data:image/png;base64,([A-Za-z0-9+/=]+)", html).group(1)
logo = Image.open(io.BytesIO(base64.b64decode(old))).convert("RGBA")

# The old wordmark and the X share columns -- the X's tail sweeps left beneath
# the type -- so they can only be told apart by row *and* column. The type sits
# entirely inside this box; the X has no ink in it.
BOX = (slice(0, 170), slice(0, 450))
a = np.array(logo)
wm_only = np.zeros(a.shape[:2], np.uint8)
wm_only[BOX] = a[BOX][..., 3]
ys, xs = np.where(wm_only > 25)
right, mid = xs.max(), (ys.min() + ys.max()) / 2

a[BOX] = 0
scale = H / logo.height
xmark = Image.fromarray(a).resize(
    (round(logo.width * scale), H), Image.LANCZOS)

# ---------------------------------------------------------------- wordmark
cap = CAP_RATIO * H
# Outfit's caps are ~0.7 em; measure rather than assume, so the cap height is
# exact whatever the font's own metrics turn out to be.
probe = ImageFont.truetype(FONT, 200).getbbox("H")
font = ImageFont.truetype(FONT, round(cap * 200 / (probe[3] - probe[1]) * SS))

letters = "COACH"
advance = ADVANCE * cap * SS
pad = round(cap * SS)
layer = Image.new("L", (round(advance * len(letters)) + 2 * pad, pad * 3), 0)
draw = ImageDraw.Draw(layer)
for i, ch in enumerate(letters):
    bb = font.getbbox(ch)
    draw.text((pad + advance * i - bb[0], pad - bb[1]), ch, font=font, fill=255)

m = np.asarray(layer).astype(np.float32)
ys, xs = np.where(m > 8)
m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

# Soft vertical silver, brightest just under the cap line -- the treatment the
# old wordmark used, at the deck's brightness (its letters peak in the low 230s).
h_, w_ = m.shape
ramp = (232 - 64 * np.linspace(0, 1, h_, dtype=np.float32))[:, None]
word = np.zeros((h_, w_, 4), np.uint8)
word[..., :3] = np.repeat(ramp, w_, axis=1).astype(np.uint8)[..., None]
word[..., 3] = m.astype(np.uint8)
word = Image.fromarray(word).resize(
    (round(w_ / SS), round(h_ / SS)), Image.LANCZOS)

# ---------------------------------------------------------------- compose
canvas = Image.new("RGBA", xmark.size, (0, 0, 0, 0))
canvas.alpha_composite(xmark, (0, 0))
canvas.alpha_composite(word, (round((right + 1) * scale) - word.width,
                              round(mid * scale - word.height / 2)))

# The old file clipped its leading C against the left edge; crop to the ink so
# the lockup carries even margins instead.
bb = canvas.getbbox()
canvas = canvas.crop(bb)

buf = io.BytesIO()
canvas.save(buf, "PNG", optimize=True)
open("new_logo.png", "wb").write(buf.getvalue())
print("wordmark %dx%d (cap %.0f, advance %.0f)"
      % (word.width, word.height, cap, advance / SS))
print("lockup   %dx%d (aspect %.2f), %.0f KB"
      % (canvas.width, canvas.height, canvas.width / canvas.height,
         len(buf.getvalue()) / 1024))
