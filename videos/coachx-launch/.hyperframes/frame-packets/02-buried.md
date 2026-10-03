# Frame packet: 02-buried

## Project inputs

- Project: /home/user/amritsari-aangan/videos/coachx-launch
- Design tokens: /home/user/amritsari-aangan/videos/coachx-launch/frame.md
- RULES_DIR: /root/.claude/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 2 — Buried in a chat
- scene: Chat bubbles and spreadsheet screenshots pile in from every edge and bury the frame; the headline cuts through: "YOUR PROGRAM IS BURIED IN A CHAT."
- voiceover: "But your program? Buried in a chat. Spreadsheet screenshots. 'Did you do Day three?' Progress nobody tracks."
- duration: 8s
- poster: 5.0s
- transition_in: blur-crossfade
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

## Selected blueprint: overwhelm-surround

# overwhelm-surround — Overwhelm / Close-In

**intent**: Convey overwhelm by accumulation. Recognizable subjects assemble, density markers scatter in to amplify "look how much," then the central subject morphs into the viewer's own avatar and elements close in from ALL sides — the frame feels surrounded, not zoomed-into. The emotional arc is recognition → claustrophobia.

**roles served**

- Problem (from `problem-mockup-overwhelm`): when the problem beat must first show "too many tools / too much surface area" and then put **the viewer inside it** — a literal swap of subject (product → person) followed by a closing-in that feels invasive. Reach for it when the pain is "you're buried," not "this metric is bad" (that's `dataviz-countup`).
- Problem (from `desktop-clutter-accumulation`): when the overwhelm is a **workspace**, not a tool
  count — live windows, stickies, and alert toasts pile up until the frame is chaotically full, and
  the beat resolves not by closing in but by shoving the clutter aside and asking the question.
  Reach for this variant when the pain lands on words ("how can you X… when you spend months on
  Y?"), not on a surrounded avatar.

**duration**: 6–9s (clutter-shove-to-question variant ~10s)

**shot structure** (a `[bg]` canvas; recognizable surfaces first, the viewer's avatar revealed underneath, then a radial crowd)

- **Scene 1 (0.0–~1.6s) — recognizable assembly.** Three `[product mockups / surfaces]` assemble into something the viewer knows — staggered scale-in, the **center** one full-size, the two flanks smaller (~0.86). Each rides a low-amplitude float so they feel like live context, not a static collage. Camera static.
- **Scene 2 (~1.6–3.0s) — density amplifies.** `[platform icons / logos]` scatter in around the mockups (staggered), used purely as **density markers** — "look how much surface area," not animated dials.
- **Scene 3 (~3.0–4.6s) — the morph (signature move).** The CENTER mockup MORPHS: its content fades out, the container reshapes, and the viewer's `[avatar]` is revealed **underneath** — a literal swap of subject, product → person.
- **Scene 4 (~4.6–end) — close-in.** `[task bubbles / demands]` close in from ALL sides toward the avatar (radial staggered entry). The avatar **stays put** while the bubbles invade — the claustrophobia comes from being surrounded, never from a camera push. Holds on the crowded state.
- **Variant — clutter-shove-to-question** (replaces Scenes 3–4 and
  inverts the camera contract — see modifier): accumulation runs under a **slow steady zoom-out** —
  `[sticky notes]` bounce in springy, `[dashboard / editor windows]` pop and slide up, a stack of
  `[alert toasts]` slides in at one edge, inner content keeps typing / log-scrolling as live density,
  windows overlap until the frame is chaotically full. The camera then REVERSES into a quick
  push-in that **shoves the clutter to the frame edges**, opening central negative space where a
  `[two-part serif question]` builds word-by-word (line 1 swaps in place to line 2); a `[cursor]`
  glides in from off-frame and comes to rest under the text; a very slow forward creep and hold.
  No morph, no avatar — the question is the payoff.

**motion vocabulary**: staggered scale-in assembly; resting-scale-preserving low float; density-marker icon scatter; content-fade → container-reshape → reveal-anchor-beneath morph; radial close-in entry from all compass points; held crowded end-state. Clutter-shove variant: slow steady zoom-out under accumulation; reverse quick push-in; clutter
shoved to frame edges opening center negative space; continuous live typing / log scroll inside
windows as ambient density; toast-stack slide-in; word-by-word serif build with in-place line swap;
cursor glide-to-rest; very slow forward creep + hold.

**rule mapping**

- staggered mockup + icon entries (smooth settle onto their resting scale) → `spring-pop-entrance` (smooth-settle register) backed by `gsap-effects`
- platform icons as density markers (positions pre-baked, scale/opacity only — NOT internal-parts animation) → `svg-icon-enrichment` (its DOM contract only)
- center mockup → avatar morph (HF forbids `width`/`height` tweens → drive the reshape on `scaleX`/`scaleY`, anchor = the avatar layer rendered beneath) → `card-morph-anchor`
- radial bubble close-in (positions baked once via `cos`/`sin`, staggered entry) → `gsap-effects` (radial layout) + `spring-pop-entrance` (per-bubble arrival)
- low-amplitude float on background mockups/icons → `sine-wave-loop` (low-amplitude register — subtle jitter that composes onto each element's resting scale, never a `fromTo` yoyo that re-tweens to its start)
- (variant) zoom-out under accumulation → quick push-in → slow forward creep → `multi-phase-camera`
  (pull-back / push / drift as sequential phases on one world wrapper; counter-translate math in
  `viewport-change`)
- (variant) clutter shoved to the edges as the push-in lands → `center-outward-expansion` (outward
  vectors to edge resting positions), fired at the same timeline position as the camera push so the
  shove reads as CAUSED by it (`reactive-displacement` register)
- (variant) word-by-word serif question build → `gsap-effects` (staggered word reveal); the
  in-place line-1 → line-2 swap → `discrete-text-sequence`
- (variant) live typing inside windows → `gsap-effects` (typewriter); the continuous inner
  log-scroll — composition: looping content translateY via `gsap-effects` (masked)
- (variant) cursor glide-in coming to rest → `cursor-click-ripple` (approach portion only — no click)

**camera modifier**: camera-static — the close-in must read as the world crowding the subject, so the frame holds; a push-in would convert "surrounded" into "zoomed-into" and kill the claustrophobia. The clutter-shove-to-question variant is the sanctioned exception: there the camera IS the
storyteller (zoom-out ↔ push-in via `multi-phase-camera`), and the claustrophobia comes from
accumulation, not surround — never mix the two resolutions in one shot.
