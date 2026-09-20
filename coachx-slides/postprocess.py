"""Downsample the @2x renders to exact Instagram pixel sizes and build a contact sheet."""
import sys, os, glob
from PIL import Image

ratio = sys.argv[1] if len(sys.argv) > 1 else '4x5'
W, H = (1080, 1080) if ratio == '1x1' else (1080, 1350)
out = os.path.join('out', ratio)
hi = os.path.join(out, '2x')
os.makedirs(hi, exist_ok=True)

files = sorted(f for f in glob.glob(os.path.join(out, '*.png')))
shots = []
for f in files:
    im = Image.open(f)
    if im.size != (W, H):                      # a fresh @2x render
        im.save(os.path.join(hi, os.path.basename(f)))
        im = im.resize((W, H), Image.LANCZOS)
        im.save(f, optimize=True)
    shots.append((os.path.basename(f), im.convert('RGB')))

cols, tw = 4, 420
th = int(tw * H / W)
gap, pad = 18, 24
rows = (len(shots) + cols - 1) // cols
sheet = Image.new('RGB', (pad*2 + cols*tw + (cols-1)*gap, pad*2 + rows*th + (rows-1)*gap), (11, 11, 12))
for i, (_, im) in enumerate(shots):
    x = pad + (i % cols) * (tw + gap)
    y = pad + (i // cols) * (th + gap)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
sheet.save(os.path.join('out', f'contact-sheet-{ratio}.png'), optimize=True)
print(f'{len(shots)} slides → {W}x{H} (2x masters in {hi})')
print('contact sheet:', f'out/contact-sheet-{ratio}.png')
