# CoachX — Instagram carousel

An 8-slide carousel built from the CoachX reference frames: same monochrome, chrome-on-black
aesthetic, rebuilt as a proper design system so every slide can be re-typed and re-rendered.

## What's here

```
slides.html          the whole deck (content + design system in one file)
render.mjs           headless-Chromium exporter  →  PNGs
postprocess.py       downsamples the 2x masters to exact IG pixel sizes + contact sheet
extract_logo.py      cuts the supplied logo out of its black plate → transparent PNGs
assets/logo-source.png  the supplied CoachX logo, untouched
assets/logo.png         COACH + X lockup, plate removed (slide header)
assets/logo-x.png       the X alone (oversized watermark)
assets/              Archivo + Inter variable fonts, light-flare textures
photos/              drop your own gym shots here (optional)
out/4x5/             1080×1350 — recommended for feed
out/1x1/             1080×1080 — square variant
out/*/2x/            2160-wide masters
out/contact-sheet-*  all 8 slides at a glance
```

## The arc

| # | Slide | Job |
|---|-------|-----|
| 01 | Train smarter. Push harder. | Hook + brand |
| 02 | Your program is buried in a chat. | Name the pain |
| 03 | One app. Both sides of the rep. | The turn |
| 04 | Live program delivery | Feature + product proof |
| 05 | Two-way progress tracking | Feature + product proof |
| 06 | PTs & athletes. One platform. | Who it's for |
| 07 | The math is simple. | Payoff |
| 08 | Stop guessing. Start training. | CTA |

## Editing

All copy lives in the `SLIDES` array near the bottom of `slides.html` — edit the strings,
re-render. Design tokens (colour, margins, chrome gradient) are CSS variables in `:root`.

Per-slide knobs:

- `atm: 'full' | 'soft'` — `full` adds the light shaft pulled from the original CoachX photo
- `ghost: {…}` — position/size of the oversized X watermark
- `align: 'center' | 'end' | 'top'` — vertical anchor of the content block
- `photo: 'photos/x.jpg'` — background photo, auto desaturated + scrimmed

## Rendering

```bash
npm install                 # playwright-core only
node render.mjs 4x5 && python3 postprocess.py 4x5
node render.mjs 1x1 && python3 postprocess.py 1x1
```

Open `slides.html` in a browser to preview the whole deck as one scroll.

## Notes

- The wordmark is the supplied CoachX artwork, not a redraw. `extract_logo.py` crops it,
  converts the black plate to real transparency (alpha = brightness above a black floor,
  colour un-multiplied back out) and upscales 4x with Lanczos + unsharp so the browser
  isn't the thing scaling it at render time.
- **Logo resolution is the one limit here.** The supplied file has only 185x81px of actual
  artwork, so the header lockup is capped at 176px wide to stay acceptably sharp. A vector
  (SVG/AI/EPS) or a larger export would let the mark run bigger and crisper.
- Type is Archivo (variable, width axis at 116 for the wide display setting) + Inter for body.
- The light streak and tube glow are lifted from the original brand photo, so the atmosphere
  is the shoot's own light rather than stock texture.
- Everything is one flat colour space — pure black `#060606`, chrome gradient for accents,
  no colour anywhere. That's what holds the grid together across 8 slides.

## Caption starter

> Your program shouldn't live in a group chat.
>
> CoachX puts the whole coaching relationship in one place — programs delivered live,
> every set logged, check-ins your PT actually replies to. Built for both sides of the rep.
>
> Link in bio.
