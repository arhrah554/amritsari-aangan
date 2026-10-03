# Frame packet: 08-built-for-both

## Project inputs

- Project: /home/user/amritsari-aangan/videos/coachx-launch
- Design tokens: /home/user/amritsari-aangan/videos/coachx-launch/frame.md
- RULES_DIR: /root/.claude/skills/hyperframes-animation/rules

## Assigned storyboard block

## Frame 8 — Built for both
- scene: Two photo cards stack top and bottom: the athlete with dumbbells (FOR ATHLETES) above, the coach in the COACH X tee (FOR COACHES) below; one value line types into each; a chrome "ONE PLATFORM" pill lands on the seam
- voiceover: "For athletes: today's session, loaded. For coaches: build once, deploy to all. One platform."
- duration: 7.723s
- poster: 5.2s
- transition_in: squeeze
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

## Selected blueprint: comparison-split

# comparison-split — Comparison Split-Cards

**intent**: Two paired items of equal weight shown side-by-side with mirrored 3D "book-open" tilts — the eye reads them as a balanced comparison, then a pill badge lands at each card's inner edge to punctuate. The motion IS the symmetry: two cards arriving from opposite wings into a held spread.

**roles served**

- Key_Feature (from `comparison-split-cards`): when two complementary features / capabilities of equal weight should be presented **simultaneously, not sequentially** — an A/B, a "X + Y together," paired concepts the viewer must weigh side-by-side. Not for >2 items (use `grid-card-assemble`) or sequential steps.

**duration**: 4–6s

**shot structure** (a `[bg]` canvas carrying two faint ambient glow blooms — `[accent A]` near 30%, `[accent B]` near 70% — so each side owns a color identity across a 50% symmetry axis; equal-width cards under one shared perspective parent)

- **Scene 1 (0.0–~0.8s) — title sets the concept.** A centered `[title line]` with an `[accent keyword]` slides DOWN into place from just above (a short smooth settle). The downward arrival is deliberate: it forms a non-conflicting T-shape against the cards, which arrive from the sides next.
- **Scene 2 (~0.4–1.9s) — the split-tilt entry (signature move).** Two equal-width feature cards arrive from opposite wings — `[left card]` from the left, `[right card]` from the right ~0.2s behind — each carrying a **mirrored 3D `rotateY` tilt** (left faces right, right faces left, opening like a book) and scaling ~0.85→1 as it lands. The entry overlaps the title's tail so the whole thing reads as ONE arrival, not two beats. Each card holds `[image / label / subtitle]`; box-shadows fall **outward** from the tilt (left shadow right, right shadow left).
- **Scene 3 (~1.9–end) — badges punctuate, then hold.** A pill `[badge]` lands at each card's **inner edge** (left then right, ~0.3s apart), overlapping its card ~15% so it reads as attached, not orbiting. This is the lone overshoot in the shot — it earns the punctuation. Settles and holds.

**motion vocabulary**: title slide-down from above; mirrored opposite-wing card entry; static book-open `rotateY` tilt (`+tilt` left, `−tilt` right); tilt-matched outward box-shadow; inner-edge badge spring-pop; gentle phase-opposed idle float (left vs right, never synchronized) registered as subtle jitter; dual side-glow ambient.

**rule mapping**

- two cards entering from opposite wings with mirrored `rotateY` tilts + tilt-matched shadow → `split-tilt-cards` (the signature; keep the two-layer split so the entry `x`/`scale` and the idle never collide on one alias)
- title slide-down settle → `gsap-effects` (translate + opacity on a long-tail `power3`)
- inner-edge pill badge pop (the one overshoot) → `spring-pop-entrance` (overshoot register — earns the punctuation)
- phase-opposed idle float on the pair → `sine-wave-loop` (low-amplitude register — subtle jitter, NOT lazy breathing; left `sin(t)`, right `sin(t+π)` so they never conveyor-belt)
- the two faint side glows behind the cards → `ambient-glow-bloom` (un-triggered soft bloom, one per accent)

**camera modifier**: camera-static by default — the symmetry is the subject and a move would break the balance.
