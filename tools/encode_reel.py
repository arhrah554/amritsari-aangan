"""Transcode the training clip for the web.

The source is straight off an iPhone: HEVC (hvc1), 10-bit, HLG HDR in BT.2020,
1512x2686 portrait, 13.4 MB. Two things break if you just drop that in a page:

  1. HEVC does not play in Chrome or Firefox — only Safari. It must become H.264.
  2. Converting HDR to SDR without tone mapping crushes it to a flat, washed-out
     grey. The zscale/tonemap chain below maps HLG BT.2020 -> SDR BT.709 properly
     (measured: saturation 17.6 -> 24.1, with visibly deeper blacks).

Output is 720x1280 H.264, no audio (the source has none, and muted autoplay
needs none), faststart, ~731 KB for 10.5s.
"""
import subprocess, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else "IMG_7122.MP4"
TONEMAP = ("zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,"
           "tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")

import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()

subprocess.run([FF, "-y", "-v", "error", "-i", SRC,
                "-vf", f"scale=720:-2,{TONEMAP}",
                "-c:v", "libx264", "-profile:v", "high", "-level", "4.0",
                "-preset", "slow", "-crf", "26", "-an",
                "-movflags", "+faststart", "train_26.mp4"], check=True)

subprocess.run([FF, "-y", "-v", "error", "-ss", "0.6", "-i", SRC,
                "-vf", f"scale=720:-2,{TONEMAP}", "-frames:v", "1",
                "-q:v", "4", "train_poster.jpg"], check=True)
print("wrote train_26.mp4 + train_poster.jpg")
