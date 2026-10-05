#!/usr/bin/env bash
# Grade the opening clip for frame 1 (assets/train-open.mp4) from the site's
# training clip. Black-and-white, contrast up, graded down to sit on the
# site's pure-black ground, vignette, zoomed so the clip's
# burnt-in captions sit at the very bottom, then a black fade baked over that
# band: frame 1's own gradient hides them, but it fades out during the
# transition into frame 2 while the clip is still playing, so the clip has to
# hide them itself. Fades to black from 4.85s.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PY'
import numpy as np
from PIL import Image
h, w = 1920, 1080
a = np.clip((np.arange(h) - 1480) / (1700 - 1480), 0, 1)
img = np.zeros((h, w, 4), np.uint8); img[..., :3] = (0, 0, 0)
img[..., 3] = ((a ** 1.6) * 255).astype(np.uint8)[:, None]
Image.fromarray(img, 'RGBA').save('/tmp/bottom_fade.png')
PY
ffmpeg -v error -y -i capture/assets/train.mp4 -loop 1 -i /tmp/bottom_fade.png -t 5.5 -an \
  -filter_complex "[0:v]crop=600:1067:60:0,scale=1080:1920:flags=lanczos,hue=s=0,eq=contrast=1.22:brightness=-0.07:gamma=0.82,vignette=PI/4[v];[v][1:v]overlay=0:0:shortest=1,fade=t=out:st=4.85:d=0.6,format=yuv420p" \
  -c:v libx264 -preset slow -crf 18 -r 30 -movflags +faststart assets/train-open.mp4
cp assets/train-open.mp4 capture/assets/train-open.mp4
