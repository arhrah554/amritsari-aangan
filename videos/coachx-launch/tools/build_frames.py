"""Build all 11 frame compositions for the CoachX trailer from one shared kit.

v2 of the film. The first cut moved like a highlight reel — white flashes,
camera shake, a strobe montage, push / squeeze / zoom transitions and 0.3s
slams — and read as busy and distorted. This version takes its grammar from
the reference trailer the client supplied:

  * the site's pure black ground (#000), the brand's silver greys untouched;
  * title cards set wide-tracked in Outfit — the typeface of the logo's
    COACH wordmark — with the chrome gradient on the line that matters;
  * one reveal for everything: a slow fade up through blur with a small
    rise (~1.1s, power2.out), each piece landing on the word that names it;
  * UI cards held in 3D perspective, drifting slowly flatter across the shot
    with a soft silver glow behind them;
  * the background X is the logo's own blade X (assets/x-mark.png);
  * a soft projector bloom, never a white flash, on the reveal and the end;
  * dissolves between frames (set in STORYBOARD.md, injected by the
    workflow's transitions script).

Cue times come from assets/voice/cues.json (the real narration), so every
reveal is written against the word it belongs to. Run from the project root:

    python3 tools/build_frames.py

Frame 1 declares the opening clip as an approved frame video; the assembler
hoists it to the root and strips it from the frame file, so rebuild before
every re-assembly (see tools/stack_open.py).
"""
import json
import os

CUES = json.load(open('assets/voice/cues.json'))
OUT = 'compositions/frames'

FONTS = '''@font-face{font-family:"Outfit";src:url("assets/fonts/Outfit-Variable-latin.woff2") format("woff2");font-weight:100 900;font-display:block}
@font-face{font-family:"Inter";src:url("assets/fonts/Inter-Variable-latin.woff2") format("woff2");font-weight:100 900;font-display:block}'''

# Shared look. $P is the frame's class/id prefix (f01 … f11) so every frame's
# rules stay scoped even though the runtime mounts them in one document.
KIT_CSS = '''
#root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden}
.$P-layer{position:absolute;left:0;top:0;width:1080px;height:1920px}
.$P-ground{background:#000}
.$P-grain{opacity:.035;pointer-events:none}
.$P-grain svg{display:block;width:1080px;height:1920px}
.$P-abs{position:absolute}
.$P-xmark{position:absolute;left:-110px;top:431px;width:1300px;height:1058px;opacity:.055;filter:blur(1.5px)}
.$P-title{font-family:"Outfit",sans-serif;font-weight:300;text-transform:uppercase;letter-spacing:.32em;color:#F4F4F5;white-space:nowrap;text-align:center;padding-left:.32em;line-height:1.15}
.$P-head{font-family:"Outfit",sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.03em;line-height:1.02;color:#F4F4F5;white-space:nowrap}
.$P-kicker{font-family:"Outfit",sans-serif;font-weight:400;font-size:22px;letter-spacing:.34em;text-transform:uppercase;color:#8B8F97;white-space:nowrap;display:flex;align-items:center;gap:22px}
.$P-kicker i{display:block;width:40px;height:1px;background:#8B8F97}
.$P-chrome{background:linear-gradient(180deg,#FFFFFF 0%,#D9DCE1 38%,#7C818A 62%,#E9EBEE 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.$P-body{font-family:"Inter",sans-serif;font-weight:400;font-size:30px;line-height:1.45;color:#A1A1AA}
.$P-rule{height:2px;width:84px;background:linear-gradient(90deg,#C9CDD3,rgba(201,205,211,0));transform-origin:0 50%}
.$P-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.10);border-radius:30px;box-shadow:0 60px 160px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.08)}
.$P-glow{position:absolute;border-radius:50%;background:radial-gradient(closest-side,rgba(201,205,211,.12),rgba(201,205,211,0))}
.$P-bloom{background:radial-gradient(ellipse 80% 55% at 50% 46%,rgba(220,223,228,.95) 0%,rgba(150,154,160,.42) 42%,rgba(0,0,0,0) 100%);opacity:0}
'''

KIT_JS = '''
  var D = $D, ID = "$ID";
  var root = document.querySelector('[data-composition-id="' + ID + '"]') || document;
  var q = function (s) { return root.querySelector(s); };
  var qa = function (s) { return Array.prototype.slice.call(root.querySelectorAll(s)); };
  var tl = gsap.timeline({ paused: true });
  tl.to({}, { duration: D }, 0);
  // The one reveal: up through blur, a small rise, a long settle.
  function rise(el, t, o) {
    o = o || {};
    tl.fromTo(el,
      { opacity: 0, y: o.y == null ? 22 : o.y, filter: "blur(" + (o.blur == null ? 12 : o.blur) + "px)" },
      { opacity: o.to == null ? 1 : o.to, y: 0, filter: "blur(0px)", duration: o.d || 1.1, ease: o.ease || "power2.out" }, t);
  }
  // A full-shot drift that starts at t=0 and eases out by the end.
  function drift(el, from, to) {
    var a = { duration: D, ease: "sine.inOut" };
    for (var k in to) a[k] = to[k];
    tl.fromTo(el, from, a, 0);
  }
'''

GRAIN = '''<div id="$P-grain" class="clip $P-layer $P-grain" data-start="0" data-duration="$D" data-track-index="9"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="none"><filter id="$P-noise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="1080" height="1920" filter="url(#$P-noise)"/></svg></div>'''


def cue(frame, i):
    return CUES[str(frame)]['phrases'][i]['start']


def frame(n, fid, css, body, js, ground=True, pre=''):
    D = CUES[str(n)]['duration_s']
    P = 'f%02d' % n
    sub = lambda s: s.replace('$P', P).replace('$ID', fid).replace('$D', '%.3f' % D)
    ground_div = ('<div id="$P-ground" class="clip $P-layer $P-ground" data-start="0" '
                  'data-duration="$D" data-track-index="0"></div>') if ground else ''
    html = f'''<template>
  <style>
    {FONTS}
    {KIT_CSS}
    {css}
  </style>

  <div id="root" data-composition-id="$ID" data-width="1080" data-height="1920">
    {pre}
    {ground_div}
    <div id="$P-stage" class="clip $P-layer" data-start="0" data-duration="$D" data-track-index="1">
{body}
    </div>
    {GRAIN}
  </div>

  <script src="assets/vendor/gsap.min.js"></script>
  <script>
    (function () {{
{KIT_JS}
{js}
      window.__timelines = window.__timelines || {{}};
      window.__timelines[ID] = tl;
    }})();
  </script>
</template>
'''
    os.makedirs(OUT, exist_ok=True)
    open(f'{OUT}/{fid}.html', 'w').write(sub(html))
    return D


# ─────────────────────────────────────────────────────────────── 01 cold open
c = [cue(1, i) for i in range(4)]          # You put in the reps | Every | Single | Day
frame(1, '01-cold-open', css='''
#$P-scrim{background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0) 44%,rgba(0,0,0,.72) 62%,#000 80%)}
#$P-a{left:0;top:1150px;width:1080px;font-size:44px}
#$P-b{left:0;top:1236px;width:1080px;display:flex;justify-content:center;gap:40px}
#$P-b span{font-family:"Outfit",sans-serif;font-weight:500;font-size:60px;letter-spacing:.16em;text-transform:uppercase;color:#F4F4F5;white-space:nowrap}
''', body='''
      <div id="$P-scrim" class="$P-layer"></div>
      <div id="$P-a" class="$P-abs $P-title">You put in the reps.</div>
      <div id="$P-b" class="$P-abs"><span id="$P-w1">Every.</span><span id="$P-w2">Single.</span><span id="$P-w3" class="$P-chrome">Day.</span></div>
''', js=f'''
      // The clip rises out of black on its own; nothing moves until the voice.
      rise(q("#$P-a"), {c[0] - 0.05:.2f}, {{ d: 1.3 }});
      // Each beat fades up on its word; the line above steps back.
      rise(q("#$P-w1"), {c[1] - 0.05:.2f}, {{ d: 0.9, y: 14 }});
      rise(q("#$P-w2"), {c[2] - 0.05:.2f}, {{ d: 0.9, y: 14 }});
      rise(q("#$P-w3"), {c[3] - 0.05:.2f}, {{ d: 1.0, y: 14 }});
      tl.to(q("#$P-a"), {{ opacity: 0.45, duration: 1.2, ease: "power1.inOut" }}, {c[1]:.2f});
''', ground=False, pre='<video data-frame-video="approved" src="assets/train-open.mp4" muted playsinline data-start="0" data-duration="5.5" data-track-index="2" data-frame-video-x="0" data-frame-video-y="0" data-frame-video-width="1080" data-frame-video-height="1920" data-frame-video-fit="cover"></video>')

# ─────────────────────────────────────────────────────────────── 02 buried
c = [cue(2, i) for i in range(5)]          # But your program | Buried | Spreadsheet | Day three | Progress
frame(2, '02-buried', css='''
#$P-k{left:90px;top:236px}
#$P-h1{left:90px;top:290px;font-size:70px}
#$P-h2{left:90px;top:364px;font-size:70px}
#$P-r{left:92px;top:468px}
#$P-persp{left:110px;top:560px;width:860px;height:920px;perspective:1900px}
#$P-drift{position:absolute;inset:0;transform-style:preserve-3d}
#$P-chat{position:absolute;inset:0;overflow:hidden}
#$P-top{position:absolute;left:0;top:0;right:0;height:108px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:22px;padding:0 40px}
#$P-top b{display:block;width:52px;height:52px;border-radius:50%;background:linear-gradient(180deg,#3a3c40,#1c1d20);border:1px solid rgba(255,255,255,.14)}
#$P-top div{font-family:"Outfit",sans-serif;font-weight:500;font-size:28px;letter-spacing:.14em;color:#E4E4E7}
#$P-top small{display:block;font-family:"Inter",sans-serif;font-size:19px;letter-spacing:0;color:#8B8F97;margin-top:4px}
#$P-view{position:absolute;left:0;right:0;top:110px;bottom:0;overflow:hidden;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 90px,#000 100%);mask-image:linear-gradient(180deg,transparent 0,#000 90px,#000 100%)}
#$P-col{position:absolute;left:40px;right:40px;top:36px}
.$P-m{position:absolute;left:0;max-width:600px;border-radius:26px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.06);padding:22px 26px;font-family:"Inter",sans-serif;font-size:27px;line-height:1.35;color:#E4E4E7}
.$P-m em{display:block;font-style:normal;font-size:17px;color:#8B8F97;text-align:right;margin-top:6px}
.$P-file{display:flex;align-items:center;gap:18px;padding:16px 18px;margin-bottom:14px;border-radius:16px;background:rgba(0,0,0,.35)}
.$P-file b{display:block;width:44px;height:54px;border-radius:6px;background:linear-gradient(180deg,#5b5e64,#33353a)}
.$P-file span{font-size:23px;color:#D4D4D8}
.$P-file small{display:block;font-size:16px;letter-spacing:.2em;color:#8B8F97}
.$P-shot{width:430px;height:230px;border-radius:14px;background:#d9dadc;padding:14px;display:grid;grid-template-columns:repeat(5,1fr);grid-auto-rows:1fr;gap:4px;filter:blur(.6px) contrast(.9);margin-bottom:10px}
.$P-shot i{display:block;background:#c3c5c9;border-radius:2px}
.$P-shot i:nth-child(5n+1){background:#aeb1b6}
#$P-m1{top:0}
#$P-m2{top:226px}
#$P-m3{top:590px}
#$P-m4{top:954px}
#$P-m5{top:1084px}
#$P-p{left:110px;top:1510px;width:860px;display:flex;align-items:center;gap:26px}
#$P-p span{font-family:"Outfit",sans-serif;font-size:22px;letter-spacing:.34em;color:#8B8F97;white-space:nowrap}
#$P-p b{display:block;flex:1;height:2px;background:rgba(255,255,255,.12)}
''', body='''
      <div id="$P-k" class="$P-abs $P-kicker"><i></i>The problem</div>
      <div id="$P-h1" class="$P-abs $P-head">Your program,</div>
      <div id="$P-h2" class="$P-abs $P-head $P-chrome">buried in a chat.</div>
      <div id="$P-r" class="$P-abs $P-rule"></div>
      <div id="$P-persp" class="$P-abs">
        <div id="$P-drift">
          <div id="$P-chat" class="$P-card">
            <div id="$P-top"><b></b><div>COACH<small>last seen today at 9:41</small></div></div>
            <div id="$P-view"><div id="$P-col">
              <div id="$P-m1" class="$P-m"><div class="$P-file"><b></b><div><span>program_v7_FINAL.xlsx</span><small>SPREADSHEET</small></div></div>here's this week's program<em>9:12</em></div>
              <div id="$P-m2" class="$P-m"><div class="$P-shot">$CELLS</div>IMG_2291.jpg<em>9:14</em></div>
              <div id="$P-m3" class="$P-m"><div class="$P-shot">$CELLS</div>IMG_2292.jpg<em>9:14</em></div>
              <div id="$P-m4" class="$P-m">did you do day 3??<em>11:02</em></div>
              <div id="$P-m5" class="$P-m">hello?<em>11:40</em></div>
            </div></div>
          </div>
        </div>
      </div>
      <div id="$P-p" class="$P-abs"><span>PROGRESS — 0%</span><b></b></div>
'''.replace('$CELLS', '<i></i>' * 30), js=f'''
      rise(q("#$P-k"), {c[0]:.2f}, {{ y: 10, d: 1.0 }});
      rise(q("#$P-h1"), {c[0]:.2f}, {{ d: 1.2 }});
      rise(q("#$P-h2"), {c[1] - 0.05:.2f}, {{ d: 1.2 }});
      tl.fromTo(q("#$P-r"), {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.2, ease: "power2.inOut" }}, {c[1] + 0.3:.2f});
      // The thread, held in perspective and drifting slowly flatter.
      rise(q("#$P-persp"), 0.35, {{ y: 50, d: 1.4, blur: 10 }});
      drift(q("#$P-drift"), {{ rotationY: -13, rotationX: 7 }}, {{ rotationY: -5, rotationX: 2.5 }});
      // Messages arrive one by one and the thread scrolls up under them.
      rise(q("#$P-m1"), 0.55, {{ y: 26, d: 0.9, blur: 8 }});
      rise(q("#$P-m2"), {c[2]:.2f}, {{ y: 26, d: 0.9, blur: 8 }});
      rise(q("#$P-m3"), {c[2] + 0.75:.2f}, {{ y: 26, d: 0.9, blur: 8 }});
      tl.to(q("#$P-col"), {{ y: -190, duration: 1.0, ease: "power2.inOut" }}, {c[2] + 0.65:.2f});
      rise(q("#$P-m4"), {c[3]:.2f}, {{ y: 26, d: 0.9, blur: 8 }});
      tl.to(q("#$P-col"), {{ y: -310, duration: 1.0, ease: "power2.inOut" }}, {c[3] - 0.1:.2f});
      rise(q("#$P-m5"), {c[3] + 0.8:.2f}, {{ y: 26, d: 0.9, blur: 8 }});
      tl.to(q("#$P-col"), {{ y: -440, duration: 1.0, ease: "power2.inOut" }}, {c[3] + 0.7:.2f});
      rise(q("#$P-p"), {c[4]:.2f}, {{ y: 10, d: 1.0 }});
      // Buried: the whole thread sinks back as the line ends.
      tl.to(q("#$P-persp"), {{ opacity: 0.45, filter: "blur(3px)", duration: 1.4, ease: "power1.inOut" }}, {c[4] + 0.4:.2f});
''')

# ─────────────────────────────────────────────────────────────── 03 not anymore
c = [cue(3, 0)]
frame(3, '03-not-anymore', css='''
#$P-t{left:0;top:860px;width:1080px;font-size:62px}
#$P-r{left:360px;top:968px;width:360px;height:1px;background:linear-gradient(90deg,rgba(201,205,211,0),#C9CDD3,rgba(201,205,211,0));transform-origin:50% 50%}
''', body='''
      <div id="$P-t" class="$P-abs $P-title">Not anymore.</div>
      <div id="$P-r" class="$P-abs"></div>
''', js=f'''
      rise(q("#$P-t"), {c[0] - 0.1:.2f}, {{ y: 0, d: 1.0, blur: 14 }});
      tl.fromTo(q("#$P-r"), {{ scaleX: 0, opacity: 0 }}, {{ scaleX: 1, opacity: 1, duration: 1.1, ease: "power2.inOut" }}, {c[0] + 0.2:.2f});
''')

# ─────────────────────────────────────────────────────────────── 04 introducing
c = [cue(4, 0)]                              # Introducing CoachX.
frame(4, '04-introducing', css='''
#$P-bloom{}
#$P-lab{left:0;top:690px;width:1080px;font-size:24px;letter-spacing:.5em;padding-left:.5em;color:#8B8F97}
#$P-lock{left:110px;top:760px;width:860px;height:377px}
#$P-lock img{position:absolute;left:0;top:0;width:860px;height:377px}
#$P-x{transform-origin:76% 50%}
#$P-sheen{left:110px;top:760px;width:860px;height:377px;overflow:hidden;-webkit-mask-image:url("assets/logo-x.png");-webkit-mask-size:860px 377px;mask-image:url("assets/logo-x.png");mask-size:860px 377px}
#$P-band{position:absolute;top:-80px;left:0;width:180px;height:540px}
#$P-band i{display:block;width:100%;height:100%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.85),rgba(255,255,255,0));transform:rotate(18deg)}
#$P-halo{left:140px;top:640px;width:800px;height:620px}
''', body='''
      <div id="$P-bloom" class="$P-layer $P-bloom"></div>
      <div id="$P-halo" class="$P-glow"></div>
      <div id="$P-lab" class="$P-abs $P-title">Introducing</div>
      <div id="$P-lock" class="$P-abs">
        <img id="$P-x" src="assets/logo-x.png" alt="">
        <img id="$P-w" src="assets/logo-word.png" alt="">
      </div>
      <div id="$P-sheen" class="$P-abs"><div id="$P-band"><i></i></div></div>
''', js=f'''
      // A soft projector bloom carries the impact — light, not a flash.
      tl.fromTo(q("#$P-bloom"), {{ opacity: 0 }}, {{ opacity: 0.30, duration: 0.14, ease: "power1.out" }}, 0);
      tl.to(q("#$P-bloom"), {{ opacity: 0, duration: 1.3, ease: "power2.out" }}, 0.14);
      // The X resolves out of the light, then the name joins it.
      tl.fromTo(q("#$P-x"), {{ opacity: 0, scale: 1.07, filter: "blur(18px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.5, ease: "power3.out" }}, 0.05);
      tl.fromTo(q("#$P-halo"), {{ opacity: 0 }}, {{ opacity: 1, duration: 1.6, ease: "power1.out" }}, 0.2);
      rise(q("#$P-lab"), {c[0] - 0.05:.2f}, {{ y: 10, d: 1.0 }});
      tl.fromTo(q("#$P-w"), {{ opacity: 0, x: -22, filter: "blur(12px)" }}, {{ opacity: 1, x: 0, filter: "blur(0px)", duration: 1.3, ease: "power2.out" }}, {c[0] + 0.05:.2f});
      // One slow glint along the blade.
      tl.fromTo(q("#$P-band"), {{ x: 80 }}, {{ x: 900, duration: 1.4, ease: "power1.inOut" }}, 1.25);
''')

# ─────────────────────────────────────────────────────────────── 05 both sides
c = [cue(5, i) for i in range(5)]          # One app | Both sides | Coaches build | Athletes train | Everything syncs
frame(5, '05-both-sides', css='''
#$P-one{left:0;top:540px;width:1080px;font-size:68px}
#$P-both{left:0;top:690px;width:1080px;font-size:56px;font-weight:400}
#$P-rep{left:0;top:772px;width:1080px;font-size:56px}
#$P-list{left:150px;top:1010px;width:780px}
.$P-row{position:relative;height:118px;display:flex;align-items:center;justify-content:center}
.$P-row span{font-family:"Outfit",sans-serif;font-weight:400;font-size:34px;letter-spacing:.28em;padding-left:.28em;text-transform:uppercase;color:#E4E4E7;white-space:nowrap}
.$P-row i{position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.16),rgba(255,255,255,0))}
''', body='''
      <img id="$P-xm" class="$P-xmark" src="assets/x-mark.png" alt="">
      <div id="$P-one" class="$P-abs $P-title">One app.</div>
      <div id="$P-both" class="$P-abs $P-title $P-chrome">Both sides</div>
      <div id="$P-rep" class="$P-abs $P-title">of the rep.</div>
      <div id="$P-list" class="$P-abs">
        <div id="$P-r1" class="$P-row"><span>Coaches build.</span><i></i></div>
        <div id="$P-r2" class="$P-row"><span>Athletes train.</span><i></i></div>
        <div id="$P-r3" class="$P-row"><span class="$P-chrome">Everything syncs.</span><i></i></div>
      </div>
''', js=f'''
      drift(q("#$P-xm"), {{ scale: 1.0 }}, {{ scale: 1.05 }});
      rise(q("#$P-one"), {c[0] - 0.05:.2f}, {{ d: 1.2 }});
      rise(q("#$P-both"), {c[1] - 0.05:.2f}, {{ d: 1.2 }});
      rise(q("#$P-rep"), {c[1] + 0.4:.2f}, {{ d: 1.2 }});
      rise(q("#$P-r1"), {c[2] - 0.05:.2f}, {{ y: 16, d: 1.0 }});
      rise(q("#$P-r2"), {c[3] - 0.05:.2f}, {{ y: 16, d: 1.0 }});
      tl.to(q("#$P-r1"), {{ opacity: 0.45, duration: 1.0, ease: "power1.inOut" }}, {c[3]:.2f});
      rise(q("#$P-r3"), {c[4] - 0.05:.2f}, {{ y: 16, d: 1.0 }});
      tl.to(q("#$P-r2"), {{ opacity: 0.45, duration: 1.0, ease: "power1.inOut" }}, {c[4]:.2f});
''')

# ─────────────────────────────────────────────────────────────── 06 delivery
c = [cue(6, i) for i in range(4)]          # builds it | lands on dashboard | loaded | weighted
ROWS = [('Bench press', '4 × 8', '60 kg'), ('Incline DB press', '3 × 10', '22.5 kg'),
        ('Cable fly', '3 × 12', 'RPE 8'), ('Overhead press', '4 × 6', '35 kg')]
rows = ''.join(f'''
              <div class="$P-row" id="$P-row{i}"><div class="$P-name">{n}</div><div class="$P-sets">{s}</div><div class="$P-load" id="$P-load{i}">{l}</div><div class="$P-box"><b id="$P-chk{i}"></b></div></div>'''
               for i, (n, s, l) in enumerate(ROWS))
frame(6, '06-delivery', css='''
#$P-k{left:90px;top:200px}
#$P-h1{left:90px;top:252px;font-size:76px}
#$P-h2{left:90px;top:332px;font-size:76px}
#$P-r{left:92px;top:446px}
#$P-halo{left:40px;top:640px;width:1000px;height:900px}
#$P-persp{left:160px;top:560px;width:760px;height:900px;perspective:1900px}
#$P-drift{position:absolute;inset:0;transform-style:preserve-3d}
#$P-card{position:absolute;inset:0;padding:46px 48px}
#$P-hd{display:flex;justify-content:space-between;align-items:baseline}
#$P-hd div{font-family:"Outfit",sans-serif;font-weight:600;font-size:30px;letter-spacing:.14em;color:#F4F4F5}
#$P-hd span{font-family:"Inter",sans-serif;font-size:20px;letter-spacing:.12em;color:#8B8F97}
#$P-chip{display:inline-flex;align-items:center;gap:10px;margin-top:18px;padding:8px 18px;border:1px solid rgba(255,255,255,.18);border-radius:999px;font-family:"Outfit",sans-serif;font-size:17px;letter-spacing:.3em;color:#C9CDD3}
#$P-chip b{display:block;width:8px;height:8px;border-radius:50%;background:#C9CDD3}
#$P-list{margin-top:34px;border-top:1px solid rgba(255,255,255,.08)}
.$P-row{display:flex;align-items:center;height:132px;border-bottom:1px solid rgba(255,255,255,.08)}
.$P-name{flex:1;font-family:"Outfit",sans-serif;font-weight:500;font-size:26px;letter-spacing:.1em;text-transform:uppercase;color:#E4E4E7}
.$P-sets{width:120px;font-family:"Inter",sans-serif;font-size:23px;color:#8B8F97}
.$P-load{width:130px;text-align:right;font-family:"Outfit",sans-serif;font-weight:600;font-size:27px;color:#F4F4F5;opacity:.35}
.$P-box{width:32px;height:32px;margin-left:30px;border:1.5px solid rgba(255,255,255,.28);border-radius:8px;position:relative}
.$P-box b{position:absolute;inset:5px;border-radius:4px;background:#C9CDD3;opacity:0}
#$P-ft{margin-top:30px;font-family:"Outfit",sans-serif;font-size:19px;letter-spacing:.32em;color:#8B8F97}
#$P-ft span{color:#E4E4E7;letter-spacing:.12em}
''', body=f'''
      <div id="$P-k" class="$P-abs $P-kicker"><i></i>01 &nbsp;/&nbsp; Delivery</div>
      <div id="$P-h1" class="$P-abs $P-head">Live program</div>
      <div id="$P-h2" class="$P-abs $P-head $P-chrome">delivery.</div>
      <div id="$P-r" class="$P-abs $P-rule"></div>
      <div id="$P-halo" class="$P-glow"></div>
      <div id="$P-persp" class="$P-abs">
        <div id="$P-drift">
          <div id="$P-card" class="$P-card">
            <div id="$P-hd"><div>PUSH DAY · WEEK 04</div><span>NEXT 08:12</span></div>
            <div id="$P-chip"><b></b>DELIVERED</div>
            <div id="$P-list">{rows}
            </div>
            <div id="$P-ft">AUTO-PROGRESSED &nbsp;<span>+2.5 KG</span></div>
          </div>
        </div>
      </div>
''', js=f'''
      rise(q("#$P-k"), {c[0]:.2f}, {{ y: 10, d: 1.0 }});
      rise(q("#$P-h1"), {c[0]:.2f}, {{ d: 1.2 }});
      rise(q("#$P-h2"), {c[0] + 0.35:.2f}, {{ d: 1.2 }});
      tl.fromTo(q("#$P-r"), {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.2, ease: "power2.inOut" }}, {c[0] + 0.7:.2f});
      // The session lands: the card rises into perspective and keeps easing flatter.
      drift(q("#$P-drift"), {{ rotationY: 17, rotationX: 7 }}, {{ rotationY: 6, rotationX: 2.5 }});
      rise(q("#$P-persp"), {c[1] - 0.1:.2f}, {{ y: 70, d: 1.4, blur: 12 }});
      tl.fromTo(q("#$P-halo"), {{ opacity: 0 }}, {{ opacity: 1, duration: 1.6, ease: "power1.out" }}, {c[1]:.2f});
      // Already loaded: the four lifts fill in.
      [0, 1, 2, 3].forEach(function (i) {{
        rise(q("#$P-row" + i), {c[2] - 0.1:.2f} + i * 0.16, {{ y: 14, d: 0.9, blur: 6 }});
      }});
      // Already weighted: the loads come up to full, two sets tick off.
      [0, 1, 2, 3].forEach(function (i) {{
        tl.to(q("#$P-load" + i), {{ opacity: 1, duration: 0.8, ease: "power1.inOut" }}, {c[3] - 0.05:.2f} + i * 0.12);
      }});
      tl.fromTo(q("#$P-chk0"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6, ease: "power1.out" }}, {c[3] + 0.3:.2f});
      tl.fromTo(q("#$P-chk1"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6, ease: "power1.out" }}, {c[3] + 0.5:.2f});
      rise(q("#$P-ft"), {c[3] + 0.55:.2f}, {{ y: 8, d: 0.9, blur: 6 }});
''')

# ─────────────────────────────────────────────────────────────── 07 tracking
c = [cue(7, i) for i in range(4)]          # Log the set | Drop the check-in | Get a reply | Coach sees every rep
H = [0.42, 0.55, 0.47, 0.66, 0.58, 0.78, 1.0]
DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
bars = ''.join(f'<div class="$P-col"><div class="$P-bar{" $P-sun" if i == 6 else ""}" id="$P-bar{i}" style="height:{int(250 * h)}px"></div><span>{d}</span></div>'
               for i, (h, d) in enumerate(zip(H, DAYS)))
frame(7, '07-tracking', css='''
#$P-k{left:90px;top:200px}
#$P-h1{left:90px;top:252px;font-size:76px}
#$P-h2{left:90px;top:332px;font-size:76px}
#$P-r{left:92px;top:446px}
#$P-halo{left:60px;top:470px;width:960px;height:700px}
#$P-persp{left:120px;top:540px;width:840px;height:500px;perspective:1900px}
#$P-drift{position:absolute;inset:0;transform-style:preserve-3d}
#$P-card{position:absolute;inset:0;padding:40px 46px}
#$P-hd{display:flex;justify-content:space-between;align-items:flex-start}
#$P-hd div{font-family:"Outfit",sans-serif;font-weight:600;font-size:24px;letter-spacing:.28em;color:#E4E4E7}
#$P-pct{text-align:right;font-family:"Outfit",sans-serif;font-weight:600;font-size:46px;line-height:1}
#$P-pct small{display:block;font-family:"Inter",sans-serif;font-weight:400;font-size:17px;letter-spacing:.18em;color:#8B8F97;margin-top:8px}
#$P-chart{position:absolute;left:46px;right:46px;bottom:40px;height:300px;display:flex;align-items:flex-end;gap:22px}
.$P-col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:300px}
.$P-bar{width:100%;border-radius:10px 10px 4px 4px;background:linear-gradient(180deg,rgba(255,255,255,.30),rgba(255,255,255,.08));transform-origin:50% 100%}
.$P-sun{background:linear-gradient(180deg,#FFFFFF,#C9CDD3);box-shadow:0 0 40px rgba(255,255,255,.28)}
.$P-col span{margin-top:14px;font-family:"Outfit",sans-serif;font-size:16px;letter-spacing:.24em;color:#8B8F97}
.$P-bub{position:absolute;max-width:640px;padding:24px 30px;border-radius:28px;font-family:"Inter",sans-serif;font-size:28px;line-height:1.38;color:#E4E4E7}
.$P-bub small{display:block;font-family:"Outfit",sans-serif;font-size:17px;letter-spacing:.3em;color:#8B8F97;margin-bottom:8px}
#$P-b1{right:120px;top:1120px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.08)}
#$P-b2{left:120px;top:1300px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.14)}
#$P-seen{right:126px;top:1252px;font-family:"Outfit",sans-serif;font-size:17px;letter-spacing:.32em;color:#8B8F97;display:flex;align-items:center;gap:10px}
''', body=f'''
      <div id="$P-k" class="$P-abs $P-kicker"><i></i>02 &nbsp;/&nbsp; Feedback</div>
      <div id="$P-h1" class="$P-abs $P-head">Two-way</div>
      <div id="$P-h2" class="$P-abs $P-head $P-chrome">tracking.</div>
      <div id="$P-r" class="$P-abs $P-rule"></div>
      <div id="$P-halo" class="$P-glow"></div>
      <div id="$P-persp" class="$P-abs">
        <div id="$P-drift">
          <div id="$P-card" class="$P-card">
            <div id="$P-hd"><div>WEEKLY VOLUME</div><div id="$P-pct"><span id="$P-num" class="$P-chrome">+0.0%</span><small>VS LAST WEEK</small></div></div>
            <div id="$P-chart">{bars}</div>
          </div>
        </div>
      </div>
      <div id="$P-b1" class="$P-bub"><small>CHECK-IN · SUN</small>Legs felt heavy on set 3.</div>
      <div id="$P-seen" class="$P-abs">SEEN <svg width="30" height="16" viewBox="0 0 30 16"><path d="M1 8l5 5L15 3M12 12l1 1L23 3" fill="none" stroke="#C9CDD3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div id="$P-b2" class="$P-bub"><small>COACH · REPLIED IN 2 MIN</small>Drop to 3×8 next week. <span style="color:#fff">Great work.</span></div>
''', js=f'''
      rise(q("#$P-k"), {c[0]:.2f}, {{ y: 10, d: 1.0 }});
      rise(q("#$P-h1"), {c[0]:.2f}, {{ d: 1.2 }});
      rise(q("#$P-h2"), {c[0] + 0.35:.2f}, {{ d: 1.2 }});
      tl.fromTo(q("#$P-r"), {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.2, ease: "power2.inOut" }}, {c[0] + 0.7:.2f});
      drift(q("#$P-drift"), {{ rotationY: -15, rotationX: 7 }}, {{ rotationY: -6, rotationX: 2.5 }});
      rise(q("#$P-persp"), {c[0] + 0.25:.2f}, {{ y: 60, d: 1.4, blur: 12 }});
      tl.fromTo(q("#$P-halo"), {{ opacity: 0 }}, {{ opacity: 1, duration: 1.6, ease: "power1.out" }}, {c[0] + 0.3:.2f});
      // Log the set: the week's volume climbs, Sunday tallest.
      [0, 1, 2, 3, 4, 5, 6].forEach(function (i) {{
        tl.fromTo(q("#$P-bar" + i), {{ scaleY: 0 }}, {{ scaleY: 1, duration: 1.2, ease: "power2.inOut" }}, {c[0] + 0.6:.2f} + i * 0.09);
      }});
      var n = {{ v: 0 }};
      tl.to(n, {{ v: 12.5, duration: 1.7, ease: "power2.out", onUpdate: function () {{
        q("#$P-num").textContent = "+" + n.v.toFixed(1) + "%";
      }} }}, {c[0] + 0.6:.2f});
      // Drop the check-in · get a reply · seen.
      rise(q("#$P-b1"), {c[1] - 0.05:.2f}, {{ y: 24, d: 1.0, blur: 8 }});
      rise(q("#$P-b2"), {c[2] - 0.05:.2f}, {{ y: 24, d: 1.0, blur: 8 }});
      rise(q("#$P-seen"), {c[3] - 0.05:.2f}, {{ y: 6, d: 0.9, blur: 6 }});
''')

# ─────────────────────────────────────────────────────────────── 08 built for both
c = [cue(8, i) for i in range(5)]          # For athletes | session loaded | For coaches | build once | One platform
frame(8, '08-built-for-both', css='''
#$P-k{left:90px;top:200px}
.$P-pc{position:absolute;left:70px;width:940px;height:560px;border-radius:30px;overflow:hidden;border:1px solid rgba(255,255,255,.10);box-shadow:0 60px 160px rgba(0,0,0,.9)}
.$P-pc img{position:absolute;left:0;top:0;width:940px;height:560px;object-fit:cover;filter:grayscale(1) brightness(.68) contrast(1.06)}
.$P-pc .$P-fade{position:absolute;left:0;right:0;bottom:0;height:300px;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.88))}
.$P-pc .$P-lbl{position:absolute;left:48px;bottom:44px}
.$P-lbl div{font-family:"Outfit",sans-serif;font-weight:400;font-size:30px;letter-spacing:.32em;text-transform:uppercase;color:#F4F4F5}
.$P-lbl p{margin:12px 0 0;font-family:"Inter",sans-serif;font-size:30px;color:#A1A1AA}
.$P-lbl p b{font-weight:500;color:#F4F4F5}
#$P-a{top:290px}
#$P-a img{object-position:50% 9%;transform-origin:50% 22%}
#$P-b{top:930px}
#$P-b img{object-position:50% 10%;transform-origin:50% 22%}
#$P-pill{left:330px;top:868px;width:420px;height:64px;border-radius:999px;background:#000;border:1px solid rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center}
#$P-pill span{font-family:"Outfit",sans-serif;font-weight:500;font-size:22px;letter-spacing:.42em;padding-left:.42em;text-transform:uppercase}
''', body='''
      <div id="$P-k" class="$P-abs $P-kicker"><i></i>03 &nbsp;/&nbsp; Built for both</div>
      <div id="$P-a" class="$P-pc"><img id="$P-ia" src="assets/divider.jpg" alt=""><div class="$P-fade"></div>
        <div class="$P-lbl"><div id="$P-la">For athletes</div><p id="$P-pa">Today's session, <b>already loaded.</b></p></div></div>
      <div id="$P-b" class="$P-pc"><img id="$P-ib" src="assets/about.jpg" alt=""><div class="$P-fade"></div>
        <div class="$P-lbl"><div id="$P-lb">For coaches</div><p id="$P-pb">Build once. <b>Deploy to every client.</b></p></div></div>
      <div id="$P-pill" class="$P-abs"><span class="$P-chrome">One platform</span></div>
''', js=f'''
      rise(q("#$P-k"), {c[0]:.2f}, {{ y: 10, d: 1.0 }});
      // Athletes: the card rises, the photo settles slowly the whole shot.
      rise(q("#$P-a"), {c[0]:.2f}, {{ y: 50, d: 1.4, blur: 12 }});
      drift(q("#$P-ia"), {{ scale: 1.09 }}, {{ scale: 1.0 }});
      rise(q("#$P-la"), {c[0] + 0.25:.2f}, {{ y: 12, d: 1.0 }});
      rise(q("#$P-pa"), {c[1] - 0.05:.2f}, {{ y: 12, d: 1.0 }});
      // Coaches.
      rise(q("#$P-b"), {c[2] - 0.1:.2f}, {{ y: 50, d: 1.4, blur: 12 }});
      drift(q("#$P-ib"), {{ scale: 1.09 }}, {{ scale: 1.0 }});
      rise(q("#$P-lb"), {c[2] + 0.15:.2f}, {{ y: 12, d: 1.0 }});
      rise(q("#$P-pb"), {c[3] - 0.05:.2f}, {{ y: 12, d: 1.0 }});
      // One platform — sealed on the seam between them.
      tl.fromTo(q("#$P-pill"), {{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.1, ease: "power2.out" }}, {c[4] - 0.05:.2f});
''')

# ─────────────────────────────────────────────────────────────── 09 the math
c = [cue(9, i) for i in range(3)]          # Zero spreadsheets | One dashboard | 24/7 accountability
MATH = [('00', 'Spreadsheets', 'Nothing to maintain. Ever.'),
        ('01', 'Dashboard', 'Every program, log and check-in.'),
        ('24/7', 'Accountability', 'Your coach, one tap away.')]
mrows = ''.join(f'''
      <div id="$P-row{i}" class="$P-abs $P-mrow" style="top:{430 + 330 * i}px">
        <div id="$P-n{i}" class="$P-num $P-chrome">{n}</div>
        <div id="$P-t{i}" class="$P-txt"><div>{l}</div><p>{d}</p></div>
        <i id="$P-ln{i}"></i>
      </div>''' for i, (n, l, d) in enumerate(MATH))
frame(9, '09-the-math', css='''
#$P-k{left:90px;top:250px}
.$P-mrow{left:90px;width:900px;height:300px}
.$P-num{position:absolute;left:0;top:30px;font-family:"Outfit",sans-serif;font-weight:200;font-size:180px;line-height:1;letter-spacing:-.01em}
.$P-txt{position:absolute;left:470px;top:72px;width:430px}
.$P-txt div{font-family:"Outfit",sans-serif;font-weight:500;font-size:30px;letter-spacing:.28em;text-transform:uppercase;color:#F4F4F5}
.$P-txt p{margin:14px 0 0;font-family:"Inter",sans-serif;font-size:27px;line-height:1.4;color:#A1A1AA}
.$P-mrow i{position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,rgba(255,255,255,.18),rgba(255,255,255,0));transform-origin:0 50%}
#$P-halo{left:-40px;top:1050px;width:620px;height:420px}
''', body=f'''
      <img id="$P-xm" class="$P-xmark" src="assets/x-mark.png" alt="">
      <div id="$P-halo" class="$P-glow"></div>
      <div id="$P-k" class="$P-abs $P-kicker"><i></i>The math</div>{mrows}
''', js=f'''
      drift(q("#$P-xm"), {{ scale: 1.05 }}, {{ scale: 1.0 }});
      rise(q("#$P-k"), {c[0]:.2f}, {{ y: 10, d: 1.0 }});
      var T = [{c[0]:.2f}, {c[1]:.2f}, {c[2]:.2f}];
      [0, 1, 2].forEach(function (i) {{
        rise(q("#$P-n" + i), T[i] - 0.05, {{ y: 26, d: 1.2, blur: 14 }});
        rise(q("#$P-t" + i), T[i] + 0.2, {{ y: 14, d: 1.1 }});
        tl.fromTo(q("#$P-ln" + i), {{ scaleX: 0 }}, {{ scaleX: 1, duration: 1.3, ease: "power2.inOut" }}, T[i] + 0.15);
      }});
      tl.fromTo(q("#$P-halo"), {{ opacity: 0 }}, {{ opacity: 1, duration: 1.8, ease: "power1.out" }}, T[2] + 0.3);
''')

# ─────────────────────────────────────────────────────────────── 10 start training
c = [cue(10, i) for i in range(2)]         # Stop guessing | Start training
frame(10, '10-start-training', css='''
#$P-ph{left:0;top:0;width:1080px;height:1920px;object-fit:cover;object-position:34% 30%;filter:grayscale(1) brightness(.6) contrast(1.1);transform-origin:40% 35%}
#$P-scrim{background:linear-gradient(180deg,#000 0%,rgba(0,0,0,.25) 22%,rgba(0,0,0,.2) 48%,rgba(0,0,0,.85) 68%,#000 86%)}
#$P-stop{left:0;top:1170px;width:1080px;font-size:56px}
#$P-start{left:0;top:1160px;width:1080px;font-size:68px;font-weight:500;letter-spacing:.2em;padding-left:.2em}
''', body='''
      <img id="$P-ph" class="$P-abs" src="assets/hero.jpg" alt="">
      <div id="$P-scrim" class="$P-layer"></div>
      <div id="$P-stop" class="$P-abs $P-title">Stop guessing.</div>
      <div id="$P-start" class="$P-abs $P-title $P-chrome">Start training.</div>
''', js=f'''
      // One photograph, rising out of black and settling in slowly.
      tl.fromTo(q("#$P-ph"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.9, ease: "power1.out" }}, 0);
      drift(q("#$P-ph"), {{ scale: 1.0 }}, {{ scale: 1.06 }});
      rise(q("#$P-stop"), {c[0] - 0.05:.2f}, {{ y: 0, d: 0.9, blur: 14 }});
      tl.to(q("#$P-stop"), {{ opacity: 0, filter: "blur(10px)", duration: 0.55, ease: "power1.in" }}, {c[1] - 0.3:.2f});
      rise(q("#$P-start"), {c[1] - 0.05:.2f}, {{ y: 0, d: 1.0, blur: 16 }});
''')

# ─────────────────────────────────────────────────────────────── 11 end card
c = [cue(11, i) for i in range(3)]         # CoachX | Train smarter | Push harder
frame(11, '11-end-card', css='''
#$P-logo{left:120px;top:640px;width:840px;height:369px}
#$P-sheen{left:120px;top:640px;width:840px;height:369px;overflow:hidden;-webkit-mask-image:url("assets/logo.png");-webkit-mask-size:840px 369px;mask-image:url("assets/logo.png");mask-size:840px 369px}
#$P-band{position:absolute;top:-80px;left:0;width:160px;height:530px}
#$P-band i{display:block;width:100%;height:100%;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.8),rgba(255,255,255,0));transform:rotate(18deg)}
#$P-halo{left:140px;top:520px;width:800px;height:620px}
#$P-t1{left:0;top:1090px;width:1080px;font-size:44px}
#$P-t2{left:0;top:1160px;width:1080px;font-size:44px}
#$P-cta{left:320px;top:1300px;width:440px;height:86px;border-radius:999px;background:#F4F4F5;display:flex;align-items:center;justify-content:center;gap:18px;font-family:"Outfit",sans-serif;font-weight:600;font-size:24px;letter-spacing:.32em;color:#000}
#$P-meta{left:0;top:1430px;width:1080px;font-size:21px;letter-spacing:.32em;color:#A1A1AA}
#$P-out{background:#000;opacity:0}
''', body='''
      <img id="$P-xm" class="$P-xmark" src="assets/x-mark.png" alt="">
      <div id="$P-bloom" class="$P-layer $P-bloom"></div>
      <div id="$P-halo" class="$P-glow"></div>
      <img id="$P-logo" class="$P-abs" src="assets/logo.png" alt="CoachX">
      <div id="$P-sheen" class="$P-abs"><div id="$P-band"><i></i></div></div>
      <div id="$P-t1" class="$P-abs $P-title">Train smarter.</div>
      <div id="$P-t2" class="$P-abs $P-title $P-chrome">Push harder.</div>
      <div id="$P-cta" class="$P-abs">JOIN COACHX <svg width="34" height="14" viewBox="0 0 34 14"><path d="M1 7h30M25 1l6 6-6 6" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div id="$P-meta" class="$P-abs $P-title">@coachx · link in bio · free to start</div>
      <div id="$P-out" class="$P-layer"></div>
''', js=f'''
      drift(q("#$P-xm"), {{ scale: 1.06 }}, {{ scale: 1.0 }});
      tl.fromTo(q("#$P-bloom"), {{ opacity: 0 }}, {{ opacity: 0.2, duration: 0.16, ease: "power1.out" }}, 0);
      tl.to(q("#$P-bloom"), {{ opacity: 0, duration: 1.4, ease: "power2.out" }}, 0.16);
      tl.fromTo(q("#$P-logo"), {{ opacity: 0, scale: 1.04, filter: "blur(16px)" }}, {{ opacity: 1, scale: 1, filter: "blur(0px)", duration: 1.5, ease: "power2.out" }}, {c[0] - 0.2:.2f});
      tl.fromTo(q("#$P-halo"), {{ opacity: 0 }}, {{ opacity: 1, duration: 1.8, ease: "power1.out" }}, {c[0]:.2f});
      rise(q("#$P-t1"), {c[1] - 0.05:.2f}, {{ y: 12, d: 1.1 }});
      rise(q("#$P-t2"), {c[2] - 0.05:.2f}, {{ y: 12, d: 1.1 }});
      tl.fromTo(q("#$P-band"), {{ x: 0 }}, {{ x: 900, duration: 1.5, ease: "power1.inOut" }}, {c[1] + 0.2:.2f});
      rise(q("#$P-cta"), {c[2] + 0.2:.2f}, {{ y: 16, d: 1.0, blur: 8 }});
      rise(q("#$P-meta"), {c[2] + 0.4:.2f}, {{ y: 8, d: 1.0, blur: 6 }});
      // The film's only exit: a slow fade to black.
      tl.fromTo(q("#$P-out"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.7, ease: "power1.inOut" }}, D - 0.7);
''')

print('built 11 frames')
