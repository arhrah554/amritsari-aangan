"""Stack frame 1 above its hoisted opening clip in the assembled index.html.

assemble-index.mjs hoists a frame's approved <video> to the host root AFTER
the frame clips, so by CSS order the video paints over frame 1's type. Frame 1
is deliberately transparent (the clip is its picture), so the frames go above
and the video below. Run after every assemble-index.

Note: assemble-index removes the <video> from the frame file when it hoists
it, so restore the frame first (`cp tools/01-cold-open.pristine.html compositions/frames/01-cold-open.html`)
before re-assembling, or the clip silently drops out of the video.
"""
import re
p = 'index.html'
s = open(p, encoding='utf-8').read()
if 'z-index: 1; /* frames above hoisted video */' not in s:
    s = s.replace('      .scene {\n        position: absolute;',
                  '      .scene {\n        z-index: 1; /* frames above hoisted video */\n        position: absolute;', 1)
s = re.sub(r'(<video id="el-01-cold-open-video-0"[^>]*?style=")(?!z-index)', r'\1z-index:0;', s)
# The CDN GSAP the assembler writes is blocked on this machine; use the vendored copy.
s = re.sub(r'<script src="https://cdn\.jsdelivr\.net/npm/gsap@[^"]+"[^>]*></script>',
           '<script src="assets/vendor/gsap.min.js"></script>', s)
open(p, 'w', encoding='utf-8').write(s)
print('gsap local:', 'assets/vendor/gsap.min.js' in s, '| stacked:', 'z-index: 1; /* frames' in s, 'video z0:', 'style="z-index:0;' in s)
