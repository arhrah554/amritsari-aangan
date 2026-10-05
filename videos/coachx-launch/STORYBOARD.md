---
format: 1080x1920
duration: 57s
message: "Your training lives in one app now: CoachX puts coach and athlete on the same side of every rep."
arc: PAS with feature-benefit progression — hook → pain → turn → product intro → thesis → feature → feature → benefit → proof → climax → brand
audience: personal trainers and the athletes they coach
mode: autonomous
music: dark cinematic trailer — low pulsing heartbeat drone and ticking build, a hard silence drop, then a huge sub-bass impact and driving hybrid orchestral percussion with braams, ending on a final hit and ring-out
---

## Video direction

**v2 (current).** The first cut moved like a highlight reel and read as busy and distorted. This version takes its grammar from the client's reference trailer. Frames are generated from one shared kit by `tools/build_frames.py`, which is the source of truth for every shot below.

**Canvas:** 1080×1920, 9:16 Reel. Ground is the website's pure black `#000`, with a ~3.5% static film grain. Key content stays in the top ~83%.

**Palette:** `#F4F4F5` for type; chrome silver `#C9CDD3` as the only accent, used as a material: the gradient on one line per headline, hairlines, checks. `#A1A1AA` and `#8B8F97` (the site's greys) for body and labels. No other hue. Photography is black-and-white, graded dark.

**Type:** title cards are Outfit 300, uppercase, tracked 0.32em, the logo wordmark's own typeface. Headlines are Outfit 600 with a chrome second line. Body is Inter.

**Background X:** the logo's own blade X (`assets/x-mark.png`), faint behind frames 5, 9 and 11. On the reveal (frame 4) the real logo layers resolve in place.

**Motion grammar:** one reveal for everything, fading up through blur with a small rise (~1.1s, `power2.out`), landing on the word that names it. UI cards sit in 3D perspective and ease slowly flatter for the whole shot, with a soft silver glow behind. Lines that have been said step back to ~45% when the next one lands. No white flashes, camera shake, strobes, slams or bounce. The reveal (frame 4) and the end card get a soft projector bloom.

**Transitions:** dissolves throughout (0.6–0.9s). Frame 4 enters on a cut because its bloom carries the change.

**Rhythm:** frames 1–2 build quietly; frame 3 is the held breath; frame 4 is the one big moment; frames 5–9 move at an even, unhurried pace; frame 10 is a single photograph and two lines; frame 11 settles and fades to black.

**Audio:** the narration per frame and the score (`tools/make_score.py`) are mixed at the root. The score is sustained pad harmony with a soft half-time pulse; frames carry no audio.

**Never:** colours other than black, white and silver; drop shadows with colour; bouncy easing; hard flashes; distortion transitions (squeeze, zoom-through, push); everything entering at once; many elements drifting independently.

## Frame 1 — Cold open
- scene: Out of total black, the athlete turns slowly into hard light; "YOU PUT IN THE REPS." stamps in word by word
- voiceover: "You put in the reps. Every. Single. Day."
- duration: 4.758s
- poster: 3.4s
- transition_in: cut
- status: outline
- src: compositions/frames/01-cold-open.html
- type: hook
- persuasion: Identity mirroring — the viewer sees their own grind first
- beat: tension + pride
- asset_candidates: assets/train-open.mp4 — [video] 1080x1920, 5.5s, pre-graded B&W: athlete turns from shadow into light, rises out of black in its first second; burnt-in captions sit at ~92–98% height
- blueprint: kinetic-type-beats (Adapt)
- focal: assets/train-open.mp4
- roles: train-open.mp4 = background (APPROVED frame video: declare it as `<video data-frame-video="approved" src="assets/train-open.mp4" muted playsinline data-start="0" data-duration="5.4" data-track-index="2" data-frame-video-x="0" data-frame-video-y="0" data-frame-video-width="1080" data-frame-video-height="1920" data-frame-video-fit="cover">`; already graded, cropped and faded — no filters needed)
- sfx: none (baked into score)

narrativeRole: open on the viewer's own effort, so the problem that follows feels unfair.
keyMessage: you already do the hard part.

Adapt: keep the in-place beat swap; the word beats sit OVER footage instead of a solid field.
LAYERING (important): this frame has NO ground/background clip — its root stays transparent so the hoisted video shows through underneath (the orchestrator stacks this frame above the video after assembly). The frame's own layers: a full-bleed gradient (transparent 0–52% height → `rgba(10,10,12,0.85)` at 70% → solid `#0A0A0C` from 80% down) that hides the clip's burnt-in captions; a light grain overlay; the type.
Scene 1 (0.0–0.6s): the clip rises out of black on its own (nothing to animate). No text yet.
Scene 2 (0.6–2.0s): on "You put in the reps." the line slams in, two lines, centred at ~66% height over the gradient: "YOU PUT IN" flat ink, "THE REPS." chrome — scale 1.12→1 with a blur-to-sharp, word by word on the spoken words.
Scene 3 (2.07–4.76s): the line cuts away and ONE huge word replaces it in place on each cue — "EVERY." (2.07) → "SINGLE." (2.91) → "DAY." (3.74) — hard-cut flash swaps, each ~180px, the last one chrome and slightly larger; each swap fires a 1-frame white flash at 15% opacity. "DAY." holds to the end.

## Frame 2 — Buried in a chat
- scene: Chat bubbles and spreadsheet screenshots pile in from every edge and bury the frame; the headline cuts through: "YOUR PROGRAM IS BURIED IN A CHAT."
- voiceover: "But your program? Buried in a chat. Spreadsheet screenshots. 'Did you do Day three?' Progress nobody tracks."
- duration: 8s
- poster: 5.0s
- transition_in: crossfade 0.8s
- status: outline
- src: compositions/frames/02-buried.html
- type: pain_point
- persuasion: Pain agitation — the three exact failures from the deck, named out loud
- beat: frustration → overwhelm
- asset_candidates: assets/deck/slide-2.jpeg — style reference only (the problem slide copy)
- blueprint: overwhelm-surround (Adapt)
- focal: (typography + built UI fragments — no captured asset)
- roles: deck/slide-2.jpeg = reference only, not placed
- sfx: none (baked into score)

narrativeRole: name the real, specific pain every PT client knows.
keyMessage: the way coaching works today is chaos.

Adapt: keep the close-in-from-all-sides claustrophobia (signature); the "avatar" is the headline itself, and the invaders are chat bubbles and spreadsheet screenshots built in HTML (WhatsApp-style dark bubbles, a grey grid "screenshot" card with a blurred 4×6 table of numbers, a "Day 3??" bubble, a red-less greyed "seen 9:41" receipt). Grey/white only.
Scene 1 (0.0–1.5s): on "But your program?" a small label "— THE PROBLEM" and one clean chat bubble "here's this week's program" carrying a file chip "program_v7_FINAL.xlsx" appear at centre.
Scene 2 (1.5–2.75s): on "Buried in a chat." the headline "YOUR PROGRAM IS BURIED IN A CHAT." lands centre (Archivo 900, "BURIED" in chrome), and 6–8 bubbles start sliding in from all four edges around it (radial staggered entry).
Scene 3 (2.75–4.4s): on "Spreadsheet screenshots." 3 tilted spreadsheet-screenshot cards pile in from the corners, overlapping the bubbles, each landing with a tiny impact shake.
Scene 4 (4.42–5.9s): on "Did you do Day three?" a large bubble "did you do day 3??" slams in front, slightly rotated, then two smaller "??" / "hello?" bubbles stack under it.
Scene 5 (5.92–8.0s): on "Progress nobody tracks." a hairline-outlined progress bar reading "PROGRESS — 0%" flickers in; the pile keeps closing in until the headline is nearly covered (≥70% of the canvas filled), the whole stack slowly desaturates and dims 30% over the last second. Hold the crowded state.

## Frame 3 — Not anymore
- scene: Everything freezes and shatters to black on a silence drop; two words slam in alone: "NOT ANYMORE."
- voiceover: "Not anymore."
- duration: 1.643s
- poster: 1.2s
- transition_in: crossfade 0.6s
- status: outline
- src: compositions/frames/03-not-anymore.html
- type: pain_point
- persuasion: Negative contrast — the hard stop before the reveal
- beat: tension → release
- asset_candidates:
- blueprint: kinetic-type-beats (Reproduce — the held breath)
- focal: (typography)
- roles: —
- sfx: none (baked into score — near-silence)

narrativeRole: the trailer drop — music dies, the turn lands in silence.
keyMessage: this ends now.

Scene 1 (0.0–0.3s): pure black, nothing. (The previous frame cuts hard into this.)
Scene 2 (0.3–1.64s): on "Not anymore." the two words appear centred, stacked — "NOT" flat ink, "ANYMORE." chrome — in a hard-cut flash (no scale), ~150px. A single thin hairline draws left→right under them over 0.6s. Then absolute stillness — the held breath before the hit.

## Frame 4 — Introducing CoachX
- scene: Two chrome blades slash across black and lock into the X; COACH tracks in beside it; a white light sweep rakes the chrome
- voiceover: "Introducing CoachX."
- duration: 2.803s
- poster: 2.8s
- transition_in: cut
- status: outline
- src: compositions/frames/04-introducing.html
- type: product_intro
- persuasion: Authority by spectacle — the product arrives like a film title
- beat: awe
- asset_candidates: assets/logo.png — the CoachX lockup (COACH wordmark + chrome X blade)
- blueprint: logo-assemble-lockup (Adapt)
- focal: assets/logo.png
- roles: logo.png = cutout (the lockup; split visually into the X blades and the COACH wordmark with clip-path masks on two copies of the PNG)
- sfx: none (baked into score — the impact lands at t=0)

narrativeRole: the reveal — the impact hit after the silence.
keyMessage: CoachX is here.

Adapt: keep the parts-assemble-around-a-fixed-mark signature; the "parts" are the two chrome blades of the X and the tracked-in wordmark.
Scene 1 (0.0–0.35s): IMPACT at t=0 — a white flash frame (full-screen white → black over 0.12s), a radial shockwave ring of light expands from centre and fades, and a camera shake (≤10px, decaying in 0.4s).
Scene 2 (0.0–0.7s): the X region of the logo (right ~45% of the PNG, clip-path) slashes in: it enters from oversized (scale 2.4, motion-blurred, rotated −8°) and slams to its final size and position at centre-right, landing on a long-tail settle; a bright specular sweep runs along the blade as it lands.
Scene 3 (0.7–2.2s): on "Introducing CoachX." the COACH wordmark (left ~55% of the PNG) tracks in from the left — letter-spacing feel via a mask wipe left→right with a soft leading edge — completing the lockup centred at ~45% height, width ~860px. A soft silver bloom glows behind the lockup (12% opacity). Small label "— INTRODUCING" fades up above it on "Introducing" (0.7s).
Scene 4 (2.2–2.8s): hold the lockup dead still; one slow specular streak crosses the whole lockup left→right.

## Frame 5 — Both sides of the rep
- scene: "ONE APP." punches in; "BOTH SIDES" in hairline-outline chrome; "OF THE REP." lands; below, COACHES BUILD · ATHLETES TRAIN · EVERYTHING SYNCS ticks across a hairline
- voiceover: "One app. Both sides of the rep. Coaches build. Athletes train. Everything syncs."
- duration: 6.861s
- poster: 4.8s
- transition_in: crossfade 0.8s
- status: outline
- src: compositions/frames/05-both-sides.html
- type: benefit_highlight
- persuasion: Rule of three — build / train / sync
- beat: clarity + confidence
- asset_candidates: assets/deck/slide-3.jpeg — style reference for the outline word treatment
- blueprint: kinetic-type-beats (Adapt — stacked build)
- focal: (typography)
- roles: deck/slide-3.jpeg = reference only (outline-word treatment)
- sfx: none (baked into score)

narrativeRole: land the promise (message) in beat 2 of the product story.
keyMessage: one app for coach and athlete, always in sync.

Adapt: instead of replacing in place, the headline STACKS line by line (the deck's slide-3 layout), then a three-beat strip ticks underneath.
Scene 1 (0.0–1.16s): label "— THE FIX" at top-left of the type block. On "One app." "ONE APP." slams in (flat ink, ~170px) at ~30% height.
Scene 2 (1.16–2.79s): on "Both sides of the rep." "BOTH SIDES" lands beneath as a hairline OUTLINE word (2px silver stroke, transparent fill) and "OF THE REP." beneath that in chrome; each line slides up 40px into place with a blur-to-sharp, on its words.
Scene 3 (2.79–5.37s): a 1px hairline draws across under the headline; then on each cue a tracked label appears on the strip, left→right: "COACHES BUILD" (2.79) · "ATHLETES TRAIN" (4.04), each preceded by a silver dot.
Scene 4 (5.37–6.86s): on "Everything syncs." a third item "EVERYTHING SYNCS" lands and a thin silver pulse travels along the hairline connecting all three dots, ending in a soft glow. Hold.

## Frame 6 — Live program delivery
- scene: A glass phone card rises; "PUSH DAY · WEEK 04" header; four exercise rows drop in one by one with weights; two silver checks tick; a "DELIVERED · AUTO-PROGRESSED" chip pulses
- voiceover: "Your coach builds it. It lands on your dashboard. Already loaded. Already weighted."
- duration: 5.904s
- poster: 4.4s
- transition_in: crossfade 0.7s
- status: outline
- src: compositions/frames/06-delivery.html
- type: feature_showcase
- persuasion: Show-don't-tell proof — the real session from the deck, populating live
- beat: ease + control
- asset_candidates: assets/deck/slide-4.jpeg — UI reference: the PUSH DAY workout card (Bench 4×8 60kg, Incline DB 3×10 22.5kg, Cable fly 3×12 RPE 8, OHP 4×8 35kg)
- blueprint: device-surface-showcase (Adapt)
- focal: (built UI — a glass phone card)
- roles: deck/slide-4.jpeg = UI reference only (rebuild the card in HTML, do not place the JPEG)
- sfx: none (baked into score)

narrativeRole: feature 1 — the program arrives, no more screenshots.
keyMessage: your session is already waiting for you.

Adapt: keep the surface-operated-on-its-own-face signature — the card fills itself row by row; no cursor.
Scene 1 (0.0–1.56s): label "— 01 / DELIVERY" top; headline "LIVE PROGRAM DELIVERY" (two lines, "DELIVERY" chrome, ~110px) lands on "Your coach builds it." at ~14% height.
Scene 2 (1.56–3.31s): on "It lands on your dashboard." a glass phone card (rounded 48px, 760×980, `rgba(255,255,255,0.04)` fill, hairline border, subtle silver top-edge highlight) rises from below into the middle of the frame with a long-tail settle; its header reads "PUSH DAY · WEEK 04" with "NEXT 08:12" right-aligned and a small "DELIVERED" chip.
Scene 3 (3.31–4.52s): on "Already loaded." four exercise rows drop into the card one by one (0.12s apart): BENCH PRESS 4×8 · 60 KG / INCLINE DB PRESS 3×10 · 22.5 KG / CABLE FLY 3×12 · RPE 8 / OVERHEAD PRESS 4×8 · 35 KG — Inter, name left, sets and load right.
Scene 4 (4.52–5.9s): on "Already weighted." the weights on each row flash white once in sequence, then two silver checkmarks draw in on the first two rows, and a footer line "AUTO-PROGRESSED ✓ +2.5 KG" fades up. Hold.

## Frame 7 — Two-way tracking
- scene: Weekly volume bars climb MON→SUN, the Sunday bar flares white; "+12.5%" counts up; a check-in chip slides in, then "COACH REPLIED · 2 MIN" pops beneath it
- voiceover: "Log the set. Drop the check-in. Get a reply. Your coach sees every rep."
- duration: 5.998s
- poster: 4.4s
- transition_in: crossfade 0.7s
- status: outline
- src: compositions/frames/07-tracking.html
- type: feature_showcase
- persuasion: Feature-to-benefit translation — logging becomes a conversation
- beat: accountability + belonging
- asset_candidates: assets/deck/slide-5.jpeg — UI reference: WEEKLY VOLUME bars (+12.5% vs last), check-in submitted · Sun, coach replied · 2 min
- blueprint: dataviz-countup (Adapt)
- focal: (built UI — weekly volume chart + check-in thread)
- roles: deck/slide-5.jpeg = UI reference only
- sfx: none (baked into score)

narrativeRole: feature 2 — progress is finally seen, and answered.
keyMessage: nothing you do goes unnoticed.

Adapt: keep the count-up/bars signature; the chart is the deck's WEEKLY VOLUME, then the payoff is the reply.
Scene 1 (0.0–1.38s): label "— 02 / FEEDBACK"; headline "TWO-WAY TRACKING" ("TRACKING" chrome) at ~14% height lands on "Log the set."; at the same cue a glass card with "WEEKLY VOLUME" appears in the middle with seven empty bar slots MON–SUN.
Scene 2 (1.38–2.75s): on "Drop the check-in." the seven bars grow up in sequence left→right (grey, rising heights), the SUN bar tallest and pure white with a soft glow; "+12.5% VS LAST WEEK" counts up 0.0→12.5 top-right of the card.
Scene 3 (2.75–3.96s): on "Get a reply." below the chart a check-in bubble "CHECK-IN · SUN — legs felt heavy on set 3" slides in from the right, then a coach reply bubble "Drop to 3×8 next week. Great work. — COACH" slides in from the left with a "REPLIED · 2 MIN" stamp.
Scene 4 (3.96–6.0s): on "Your coach sees every rep." a small "SEEN ✓✓" receipt ticks in under the athlete's bubble and the SUN bar's glow blooms once. Hold.

## Frame 8 — Built for both
- scene: Two photo cards stack top and bottom: the athlete with dumbbells (FOR ATHLETES) above, the coach in the COACH X tee (FOR COACHES) below; one value line types into each; a chrome "ONE PLATFORM" pill lands on the seam
- voiceover: "For athletes: today's session, loaded. For coaches: build once, deploy to all. One platform."
- duration: 7.723s
- poster: 5.2s
- transition_in: crossfade 0.7s
- status: outline
- src: compositions/frames/08-built-for-both.html
- type: benefit_highlight
- persuasion: Value stacking across both audiences
- beat: belonging + power
- asset_candidates: assets/divider.jpg — athlete in COACH X tank with dumbbells, staring into lens; assets/about.jpg — coach portrait in black COACH X tee, head bowed
- blueprint: comparison-split (Reproduce)
- focal: assets/divider.jpg
- roles: divider.jpg = cutout-in-card (FOR ATHLETES, top card); about.jpg = supporting (FOR COACHES, bottom card)
- sfx: none (baked into score)

narrativeRole: widen the promise to both buyers — PTs and athletes.
keyMessage: it's built for both sides.

Vertical canvas: the split is TOP / BOTTOM, not left/right. Two equal photo cards (each ~960×640, 24px radius, hairline border, B&W photos, dark gradient at the card bottom for its label).
Scene 1 (0.0–1.34s): label "— 03 / BUILT FOR BOTH" at top. On "For athletes:" the TOP card (divider.jpg, framed on his face + COACH X tank + dumbbells) arrives from the left with a mirrored rotateY tilt opening like a book, scaling 0.85→1; its label "FOR ATHLETES" sits on the card bottom-left.
Scene 2 (1.34–3.06s): on "today's session, loaded." a line types under the label inside the card: "Today's session, already loaded." (Inter, white).
Scene 3 (3.06–4.21s): on "For coaches:" the BOTTOM card (about.jpg, framed chest-up in the COACH X tee) arrives from the right with the opposite tilt; label "FOR COACHES".
Scene 4 (4.21–6.1s): on "build once, deploy to all." its line types: "Build once. Deploy to every client."
Scene 5 (6.1–7.72s): on "One platform." a chrome pill "ONE PLATFORM" lands on the seam between the two cards (the lone punctuation), with a thin silver line drawing out from it to both card edges. Hold.

## Frame 9 — The math
- scene: Three numbers slam in on beats, each with a label: 00 SPREADSHEETS → 01 DASHBOARD → 24/7 ACCOUNTABILITY; the digits are chrome and roll like a counter
- voiceover: "Zero spreadsheets. One dashboard. Twenty-four seven accountability."
- duration: 5.689s
- poster: 4.2s
- transition_in: crossfade 0.7s
- status: outline
- src: compositions/frames/09-the-math.html
- type: social_proof
- persuasion: Statistical proof — the deck's own "math is simple"
- beat: certainty
- asset_candidates: assets/deck/slide-7.jpeg — style reference for the 00 / 01 / 24/7 stack
- blueprint: dataviz-countup (Adapt — stacked stat slam)
- focal: (typography)
- roles: deck/slide-7.jpeg = reference only
- sfx: none (baked into score)

narrativeRole: compress the whole value into three numbers.
keyMessage: less admin, more accountability.

Adapt: keep the counter-roll signature on the numbers; three rows stack like the deck's "THE MATH IS SIMPLE".
Scene 1 (0.0–1.74s): label "— THE MATH" at top; faint chrome X behind. On "Zero spreadsheets." row 1 slams in at ~28% height: big chrome numeral "00" (~230px, digits roll from 99→00 in 0.35s) with "SPREADSHEETS" and a muted line "Nothing to maintain. Ever." to its right; a hairline under the row.
Scene 2 (1.74–3.17s): on "One dashboard." row 2 at ~46%: "01" rolls 00→01, "DASHBOARD" / "Every program, log and check-in."
Scene 3 (3.17–5.69s): on "Twenty-four seven accountability." row 3 at ~64%: "24/7" slams in larger than the others (it's the climax of the three), "ACCOUNTABILITY" / "Your coach, one tap away." A white glow blooms behind "24/7". Hold.

## Frame 10 — Stop guessing
- scene: Rapid strobe-cut montage of the B&W gym photos (hero curl, dumbbells, portrait) behind huge type: "STOP GUESSING." then "START TRAINING." in chrome
- voiceover: "Stop guessing. Start training."
- duration: 2.743s
- poster: 2.8s
- transition_in: crossfade 0.6s
- status: outline
- src: compositions/frames/10-start-training.html
- type: cta
- persuasion: Urgency to act — imperative call over peak-energy imagery
- beat: urgency-to-act
- asset_candidates: assets/hero.jpg — barbell curl, hard window light; assets/divider.jpg — dumbbells, staring into lens; assets/about.jpg — portrait, head bowed
- blueprint: kinetic-type-beats (Adapt — strobe montage)
- focal: assets/hero.jpg
- roles: hero.jpg, divider.jpg, about.jpg = background (full-bleed, high-contrast B&W, ~55% brightness, each punched in 1.08→1.0)
- sfx: none (baked into score — two hits)

narrativeRole: the climax — peak music, peak imagery, the command.
keyMessage: start now.

Adapt: the beats replace each other in place over a hard-cut photo strobe.
Scene 1 (0.0–1.31s): hard cut in on hero.jpg (barbell curl) full-bleed. On "Stop guessing." (0.1s — the first hit) a white flash frame, then "STOP" / "GUESSING." slams in centred (~190px, flat ink). The photo strobes: hero → divider at 0.55s → about at 0.95s (hard cuts, each with a tiny scale punch).
Scene 2 (1.31–2.74s): on "Start training." (the second hit) another white flash; the words swap in place to "START" / "TRAINING." with "TRAINING." in chrome and 10% larger; the photo cuts back to divider.jpg (staring into the lens) and holds; a fast specular streak crosses "TRAINING.". Hold to the end.

## Frame 11 — CoachX. Train smarter.
- scene: Everything clears to black; the CoachX lockup settles center with a specular sweep; "TRAIN SMARTER. PUSH HARDER." beneath; a JOIN COACHX pill and "LINK IN BIO · FREE TO START" fade up; final hit and ring-out
- voiceover: "CoachX. Train smarter. Push harder."
- duration: 5.095s
- poster: 3.8s
- transition_in: crossfade 0.9s
- status: outline
- src: compositions/frames/11-end-card.html
- type: branding
- persuasion: Brand anchoring + a free, low-risk CTA
- beat: triumph + motivation
- asset_candidates: assets/logo.png — the CoachX lockup
- blueprint: logo-assemble-lockup (Adapt — settled reveal + CTA)
- focal: assets/logo.png
- roles: logo.png = cutout (full lockup)
- sfx: none (baked into score — final impact at t=0, then ring-out)

narrativeRole: brand sting and the action — where to go next.
keyMessage: CoachX — free to start, link in bio.

Scene 1 (0.0–0.45s): black with the faint chrome X. A white flash at t=0 (the final impact) decays.
Scene 2 (0.45–1.51s): on "CoachX." the full logo lockup resolves at ~38% height (width ~880px): blur 20px→0 and scale 1.06→1 on a long-tail settle; a silver bloom glows behind it.
Scene 3 (1.51–2.74s): on "Train smarter." "TRAIN SMARTER." appears under the logo (~84px, flat ink) with a short upward settle.
Scene 4 (2.74–3.7s): on "Push harder." "PUSH HARDER." appears beneath it in chrome.
Scene 5 (3.7–5.1s): a pill button "JOIN COACHX →" (white fill, black text, Archivo 700 tracked) fades/rises in at ~66% height, then "LINK IN BIO · FREE TO START" (label style) under it; one last specular streak crosses the logo. Final 0.6s: everything holds; this is the only frame with an exit — fade the whole frame to black over the last 0.5s.

