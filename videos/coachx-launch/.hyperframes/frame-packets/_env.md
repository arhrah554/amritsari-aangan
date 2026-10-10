## Environment notes for every frame worker (read after your packet)

- **Canvas** 1080×1920 (9:16). `#root` `data-width="1080" data-height="1920"`. Captions are DISABLED, but keep all important content inside the top ~83% (y < 1594px).
- **GSAP** — the CDN is blocked on this machine. Load it from the project: `<script src="assets/vendor/gsap.min.js"></script>` (inside your `<template>`). Never reference jsdelivr / cdnjs / unpkg.
- **Fonts** ship as files — declare both inside your file and use nothing else:
  ```css
  @font-face{font-family:"Archivo";src:url("assets/fonts/Archivo-Variable-latin.woff2") format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:block}
  @font-face{font-family:"Inter";src:url("assets/fonts/Inter-Variable-latin.woff2") format("woff2");font-weight:100 900;font-display:block}
  ```
  Display type: `font-family:"Archivo"; font-weight:900; font-stretch:125%; text-transform:uppercase; line-height:.9`.
- **Chrome word** (one per headline): `background:linear-gradient(180deg,#FFFFFF 0%,#D9DCE1 38%,#7C818A 62%,#E9EBEE 100%); -webkit-background-clip:text; background-clip:text; color:transparent;`. **Outline word:** `color:transparent; -webkit-text-stroke:2px #C9CDD3`.
- **Look reference** — the brand's launch carousel is at `assets/deck/slide-1.jpeg` … `slide-8.jpeg` (1080×1350). Open the ones your packet names (and slide-1 for the overall look) with your image reader before you design; match their type, hairlines, labels, cards, chrome X. Never place these JPEGs in the frame.
- **The giant faint chrome X** motif, when your frame uses it: it is the logo's own X, never a drawn stand-in — an inline SVG (~1400px box, opacity .05–.07, `filter:blur(2px)`, centred behind the type) holding `<image href="assets/x-mark.png">` (1480×1204, cut from assets/logo.png by tools/make_x_mark.py) at ~92% of the viewBox width, centred.
- **Grain**: an SVG `feTurbulence` noise rect at ~6% opacity over everything, static (no animation needed). Deterministic: no `Math.random`, no `Date.now`, no `repeat:-1`.
- **No `<audio>`** anywhere — narration, score, whooshes and impacts are already mixed at the root.
- **Timing**: the cue times in your Scene lines are seconds from YOUR frame's start, taken from the real narration — land each reveal within ±0.05s of its cue. Your timeline must be exactly your frame's `duration` long (add a `tl.to({}, {duration: D}, 0)` anchor).
- When done, run `npx hyperframes lint` from PROJECT_DIR is NOT required (the index isn't assembled yet); instead re-read your file against the self-check list in the role, and render a quick check if you can: `cd PROJECT_DIR && npx hyperframes snapshot` is also not available yet — so self-review carefully. Report the file path and a two-line summary of what each Scene does.
