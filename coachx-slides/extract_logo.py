"""Cut the supplied CoachX wordmark out of assets/logo-source.png.

Produces two screen-blend-ready assets:
  assets/logo.png    full COACH + X lockup (slide header)
  assets/logo-x.png  the X alone (oversized watermark)

Both are upscaled with Lanczos + a light unsharp pass so the browser is never
the thing doing the scaling at render time.
"""
from PIL import Image, ImageFilter

SRC = 'assets/logo-source.png'
SCALE = 4

im = Image.open(SRC).convert('RGB')
px = im.load()
W, H = im.size


# The source has a stray 1px horizontal line at y=162 (peak value 18) that is not
# part of the mark — the real artwork ends at y=144. Ignore anything below it.
ARTWORK_BOTTOM = 155


def bbox(x0, threshold=12, pad=4):
    """Tight box around artwork brighter than `threshold`, from column x0 rightwards."""
    minx, miny, maxx, maxy = W, H, -1, -1
    for y in range(min(H, ARTWORK_BOTTOM)):
        for x in range(x0, W):
            if sum(px[x, y]) / 3 > threshold:
                minx, maxx = min(minx, x), max(maxx, x)
                miny, maxy = min(miny, y), max(maxy, y)
    return (max(0, minx - pad), max(0, miny - pad),
            min(W, maxx + 1 + pad), min(H, maxy + 1 + pad))


# The mark was drawn as bright chrome on a black plate, so the plate is recoverable
# as transparency: alpha = brightness above the black floor, colour un-multiplied back
# out of it. Without this the plate screen-blends into a visible rectangle.
BLACK_FLOOR = 9


def unmultiply(crop):
    out = Image.new('RGBA', crop.size)
    src, dst = crop.load(), out.load()
    for y in range(crop.height):
        for x in range(crop.width):
            r, g, b = src[x, y]
            peak = max(r, g, b)
            a = 0 if peak <= BLACK_FLOOR else min(255, round((peak - BLACK_FLOOR) * 255 / (255 - BLACK_FLOOR)))
            if a == 0:
                dst[x, y] = (0, 0, 0, 0)
            else:
                k = 255 / peak
                dst[x, y] = (min(255, round(r * k)), min(255, round(g * k)), min(255, round(b * k)), a)
    return out


def emit(box, path):
    crop = im.crop(box)
    big = unmultiply(crop).resize((crop.width * SCALE, crop.height * SCALE), Image.LANCZOS)
    rgb = big.convert('RGB').filter(ImageFilter.UnsharpMask(radius=2.2, percent=68, threshold=2))
    big = Image.merge('RGBA', (*rgb.split(), big.split()[3]))
    big.save(path, optimize=True)
    print(f'{path}: {crop.size} → {big.size}')


emit(bbox(0), 'assets/logo.png')        # full lockup
emit(bbox(146), 'assets/logo-x.png')    # X only (COACH ends ~x150)
