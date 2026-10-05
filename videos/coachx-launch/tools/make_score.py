"""Trailer score for the CoachX launch video, synthesised from scratch.

No music service can deliver into this machine (its egress policy blocks the
CDN hosts), so the bed is built here with numpy: a sound-designed trailer
score cut to the frame grid in assets/voice/cues.json.

    Act 1  (F1–F2)  low drone, a slow heartbeat, a steady clock, a long riser
    Drop   (F3)     near-silence: a thin high ring, then a reverse swell
    Reveal (F4)     one deep impact and a slow bloom — the film's big moment
    Act 2  (F5–F9)  sustained pad chords (Dm Bb F C) over a held sub, a quiet
                    arpeggio for flow, a soft half-time pulse; a slow bloom
                    marks each new feature
    Climax (F10)    a soft hit on "Stop guessing" / "Start training"
    Outro  (F11)    the home chord under the logo, a last low impact, ring-out

Deliberately unhurried: no hats, snares or fills — the picture is slow and
the score breathes with it. A soft breath of air sits under each dissolve. The bed is sidechain-ducked against the
narration so the voice always reads. Deterministic: fixed seeds, no clock.

Writes assets/bgm/score.wav and sets audio_meta.json's bgm.
"""
import json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
BGM_VOLUME = 0.78  # as mounted under the narration (assemble-index reads this)
cues = json.load(open('assets/voice/cues.json'))
frames = sorted(cues, key=int)
start, t = {}, 0.0
for k in frames:
    start[int(k)] = t
    t += cues[k]['duration_s']
TOTAL = t
N = int((TOTAL + 0.05) * SR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)


def idx(t): return int(round(t * SR))


def add(sig, t, gain=1.0, pan=0.0):
    """Mix a mono or (2, n) signal in at time t. pan -1..1 (equal power)."""
    i = idx(t)
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)]) * np.sqrt(2)
    n = min(sig.shape[1], N - i)
    if n <= 0 or i < 0: return
    L[i:i + n] += gain * sig[0, :n]; R[i:i + n] += gain * sig[1, :n]


def lp(x, f, o=4): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=4): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def tt(d): return np.arange(int(d * SR)) / SR


def saw(f, d, harmonics=24, detune=0.0):
    x = tt(d); out = np.zeros_like(x)
    for h in range(1, harmonics + 1):
        if f * h > SR / 2.2: break
        out += np.sin(2 * np.pi * f * (1 + detune) * h * x) / h
    return out * 0.6


def env_exp(d, decay):
    return np.exp(-tt(d) / decay)


def reverb_ir(d=2.8, decay=0.9, seed=1):
    g = np.random.default_rng(seed)
    x = tt(d)
    irs = []
    for s in (0, 1):
        n = g.standard_normal(len(x)) * np.exp(-x / decay)
        irs.append(lp(n, 6000) * 0.08)
    return irs


IR = reverb_ir()


def verb(sig_lr, wet=0.35):
    out = []
    for ch, ir in zip(sig_lr, IR):
        out.append(ch + wet * fftconvolve(ch, ir)[:len(ch)])
    return np.vstack(out)


# ------------------------------------------------------------- instruments
def kick(gain=1.0):
    d = 0.6; x = tt(d)
    f = 45 + 95 * np.exp(-x / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.22)
    click = hp(rng.standard_normal(len(x)), 2500) * np.exp(-x / 0.004) * 0.3
    return np.tanh(1.6 * (body + click)) * gain


def heartbeat():
    d = 0.9; out = np.zeros(int(d * SR))
    for off, g in ((0, 1.0), (0.2, 0.7)):
        x = tt(0.5); f = 38 + 30 * np.exp(-x / 0.04)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.12) * g
        i = idx(off); out[i:i + len(s)] += s
    return lp(out, 180)


def tick():
    x = tt(0.03)
    return (hp(rng.standard_normal(len(x)), 3000) * np.exp(-x / 0.003) +
            np.sin(2 * np.pi * 2400 * x) * np.exp(-x / 0.006) * 0.4) * 0.5


def snare():
    x = tt(0.35)
    n = bp(rng.standard_normal(len(x)), 900, 6000) * np.exp(-x / 0.07)
    b = np.sin(2 * np.pi * 185 * x) * np.exp(-x / 0.05)
    return np.tanh(1.4 * (n * 0.9 + b * 0.6))


def tom(f0=90):
    x = tt(0.6); f = f0 + f0 * 0.8 * np.exp(-x / 0.05)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 0.18)


def braam(d=3.0, root=36.71, bright=1800):
    x = tt(d)
    voices = [(root, 1.0), (root * 2, 0.8), (root * 3, 0.55), (root * 4, 0.45), (root * 4.757, 0.35)]
    l = np.zeros(len(x)); r = np.zeros(len(x))
    for f, g in voices:
        l += saw(f, d, 30, -0.004) * g; r += saw(f, d, 30, 0.004) * g
    # filter opens fast then closes: do it in blocks
    cut = 160 + bright * np.exp(-x / 0.6) * (1 - np.exp(-x / 0.05))
    amp = (1 - np.exp(-x / 0.03)) * np.exp(-x / (d * 0.45))
    outl = np.zeros_like(l); outr = np.zeros_like(r)
    B = 2048
    zl = zr = None
    for i in range(0, len(x), B):
        sos = butter(2, float(cut[i]), 'low', fs=SR, output='sos')
        from scipy.signal import sosfilt_zi
        if zl is None:
            zl = sosfilt_zi(sos) * 0; zr = sosfilt_zi(sos) * 0
        outl[i:i + B], zl = sosfilt(sos, l[i:i + B], zi=zl)
        outr[i:i + B], zr = sosfilt(sos, r[i:i + B], zi=zr)
    return np.vstack([np.tanh(1.8 * outl * amp), np.tanh(1.8 * outr * amp)])


def impact(d=4.0):
    x = tt(d)
    f = 28 + 60 * np.exp(-x / 0.25)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x / 1.4)
    slam = lp(rng.standard_normal(len(x)), 3500) * np.exp(-x / 0.12)
    crack = hp(rng.standard_normal(len(x)), 4000) * np.exp(-x / 0.02) * 0.5
    m = np.tanh(2.2 * (sub * 1.1 + slam * 0.7 + crack))
    return np.vstack([m, m])


def riser(d, f0=200, f1=3000, gain=1.0):
    x = tt(d); n = rng.standard_normal(len(x))
    out = np.zeros(len(x)); B = 2400
    for i in range(0, len(x), B):
        c = f0 * (f1 / f0) ** (i / len(x))
        out[i:i + B] = bp(n[i:i + B], c * 0.7, min(c * 1.4, SR / 2.3))
    tone = np.sin(2 * np.pi * np.cumsum(110 * (8 ** (x / d))) / SR) * 0.25
    e = (x / d) ** 2.2
    s = (out * 1.2 + tone) * e * gain
    return np.vstack([s, np.roll(s, 240)])


def reverse_swell(d=1.2):
    x = tt(d); n = hp(rng.standard_normal(len(x)), 1500)
    return n * (x / d) ** 3 * 0.8


def whoosh(d=0.7, up=True):
    x = tt(d); n = rng.standard_normal(len(x))
    out = np.zeros(len(x)); B = 1200
    for i in range(0, len(x), B):
        p = i / len(x)
        c = 300 * (12 ** (p if up else 1 - p))
        out[i:i + B] = bp(n[i:i + B], c * 0.6, min(c * 1.8, SR / 2.3))
    e = np.sin(np.pi * x / d) ** 2
    s = out * e
    pan = np.linspace(-0.7, 0.7, len(x))
    return np.vstack([s * np.cos((pan + 1) * np.pi / 4), s * np.sin((pan + 1) * np.pi / 4)]) * 1.4


def drone(d, root=36.71, gain=1.0):
    x = tt(d)
    l = saw(root, d, 16, -0.003) + saw(root * 1.5, d, 12, 0.002) * 0.5
    r = saw(root, d, 16, 0.003) + saw(root * 1.5, d, 12, -0.002) * 0.5
    swell = np.clip(x / 2.0, 0, 1) * (0.85 + 0.15 * np.sin(2 * np.pi * x / 3.7))
    return np.vstack([lp(l, 320), lp(r, 320)]) * swell * gain


def pad(freqs, d, attack=1.4, release=1.8, cutoff=1100, gain=1.0):
    """Sustained chord: detuned saws through a low-pass, slow swell in and out."""
    x = tt(d)
    l = np.zeros(len(x)); r = np.zeros(len(x))
    for f in freqs:
        l += saw(f, d, 14, -0.0035) + saw(f, d, 14, 0.0021) * 0.6
        r += saw(f, d, 14, 0.0035) + saw(f, d, 14, -0.0021) * 0.6
    env = np.clip(x / attack, 0, 1) ** 1.5 * np.clip((d - x) / release, 0, 1) ** 1.2
    return np.vstack([lp(l, cutoff, 2), lp(r, cutoff, 2)]) * env * gain / len(freqs)


def sub(f, d, gain=1.0):
    x = tt(d)
    env = np.clip(x / 0.8, 0, 1) * np.clip((d - x) / 1.0, 0, 1)
    return np.sin(2 * np.pi * f * x) * env * gain


def pluck(f, d=1.6):
    """Soft felt-piano-ish pluck: sine + octave, fast attack, long decay."""
    x = tt(d)
    s = (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * 2 * f * x)
         + 0.12 * np.sin(2 * np.pi * 3 * f * x))
    return lp(s * (1 - np.exp(-x / 0.004)) * np.exp(-x / 0.55), 2600, 2)


def swell(d=2.6, root=36.71, gain=1.0):
    """A braam that blooms instead of hitting: slow attack, dark filter."""
    b = braam(d, root, bright=700)
    x = tt(d)
    return b * np.clip(x / 0.6, 0, 1) ** 2 * gain


def bass_note(f, d=0.12):
    x = tt(d)
    s = saw(f, d, 18) * np.exp(-x / 0.07)
    return np.tanh(2.0 * lp(s, 900))


# ------------------------------------------------------------- arrangement
s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11 = (start[i] for i in range(1, 12))

# Act 1 — low drone, a slow heartbeat, a steady (not accelerating) clock and a
# long gentle riser into the drop. Tension without agitation.
add(drone(s3 - s1 + 0.3, gain=0.5), s1)
hb = s1 + 0.6
while hb < s3 - 0.6:
    add(heartbeat(), hb, 0.75)
    hb += 1.6
tk = s1 + 0.4
while tk < s3 - 0.2:
    add(tick(), tk, 0.10 + 0.08 * (tk - s1) / (s3 - s1), pan=0.3 if int(round(tk * 2)) % 2 else -0.3)
    tk += 1.0
add(riser(5.0, 160, 2200, gain=0.32), s3 - 5.0)

# Drop — silence but for a thin ring, then a reverse swell into the reveal
ring = np.sin(2 * np.pi * 3520 * tt(s4 - s3)) * 0.02 * np.exp(-tt(s4 - s3) / 2.5)
add(ring, s3, pan=0.2)
add(reverse_swell(1.2), s4 - 1.2, 0.7)

# Reveal — one deep impact and a slow bloom; the one big moment of the film
add(impact(5.0), s4, 0.8)
add(swell(4.0), s4, 0.8)

# Act 2 — sustained harmony carries the features. Dm  Bb  F  C, four seconds
# each, a held sub under each chord, a quiet arpeggio for flow and a soft
# half-time pulse (one low thump every two seconds). No hats, no snares.
D3, F3, A3, Bb2, C3, E3, G3 = 146.83, 174.61, 220.0, 116.54, 130.81, 164.81, 196.0
D4, F4, A4, Bb3, C4, E4, G4 = 293.66, 349.23, 440.0, 233.08, 261.63, 329.63, 392.0
CHORDS = [((D3, F3, A3), 73.42, (D4, A4, F4, A4)),
          ((Bb2, D3, F3), 58.27, (Bb3, F4, D4, F4)),
          ((87.31, A3, C4), 87.31, (F4, C4, A4, C4)),
          ((C3, E3, G3), 65.41, (C4, G4, E4, G4))]
CH = 4.0
t, k = s5, 0
while t < s10 - 0.2:
    d = min(CH + 1.8, s10 + 0.8 - t)
    voicing, root, arp = CHORDS[k % 4]
    add(pad(voicing, d, gain=0.55 + 0.05 * min(k, 6)), t)
    add(sub(root, d, 0.22), t)
    for j in range(8):                       # quarter-note arpeggio, 0.5s apart
        tj = t + j * 0.5
        if tj < s10 - 0.3:
            add(pluck(arp[j % 4]), tj, 0.10 + 0.012 * min(k, 6), pan=-0.25 if j % 2 else 0.25)
    for j in (0, 2):                         # soft pulse on 1 and 3 of each 4s bar
        tj = t + j * 2.0
        if tj < s10 - 0.3:
            add(kick(), tj, 0.32 + 0.04 * min(k, 6))
    t += CH; k += 1
# a slow bloom marks each new feature instead of a hit
for s_ in (s6, s7, s8, s9):
    add(swell(2.6), s_ - 0.35, 0.35)
add(riser(3.0, 220, 3800, 0.30), s10 - 3.0)

# Climax — the two commands each land on a soft hit
c1 = s10 + cues['10']['phrases'][0]['start']
c2 = s10 + cues['10']['phrases'][1]['start']
for c, g in ((c1, 0.5), (c2, 0.6)):
    add(impact(2.4), c - 0.02, g)
    add(swell(2.0), c - 0.25, 0.4)

# Outro — the final chord under the logo, one last low impact, long ring-out
add(impact(5.0), s11, 0.65)
add(pad((D3, F3, A3, D4), TOTAL - s11 + 0.2, attack=0.9, release=2.6, gain=0.75), s11 - 0.2)
add(sub(73.42, TOTAL - s11, 0.25), s11)
add(drone(TOTAL - s11, gain=0.25), s11)

# Soft air under each dissolve — no whooshes, just a breath
for f in (2, 5, 6, 7, 8, 9, 11):
    add(whoosh(1.4, up=True), start[f] - 0.9, 0.18)

# ------------------------------------------------------------- reverb, duck, master
mix = verb(np.vstack([L, R]), wet=0.28)
# Bring the summed instruments to unity first — otherwise the soft clip below
# saturates ducked and unducked passages to the same level and erases the duck.
mix /= np.percentile(np.abs(mix), 99.9)

# Duck from the exact phrase timings: ~-11 dB under every spoken phrase, in on
# a 60 ms attack just ahead of the word, back out over 300 ms after it, so the
# hits and swells land full in the gaps between lines.
DUCK = 10 ** (-11 / 20)
act = np.zeros(N)
for f in frames:
    for p in cues[f]['phrases']:
        a = idx(start[int(f)] + p['start'] - 0.06)
        b = idx(start[int(f)] + p['end'] + 0.05)
        act[max(a, 0):min(b, N)] = 1.0
sm = np.zeros(N); prev = 0.0
a_up, a_dn = np.exp(-64 / (0.03 * SR)), np.exp(-64 / (0.30 * SR))
for i in range(0, N, 64):
    v = act[i]
    prev = a_up * prev + (1 - a_up) * v if v > prev else a_dn * prev + (1 - a_dn) * v
    sm[i:i + 64] = prev
duck = 1 - (1 - DUCK) * sm
# carve the speech band a little further so words cut through the drone
carve = np.vstack([bp(mix[0], 900, 4000), bp(mix[1], 900, 4000)])
mix = (mix - 0.5 * carve * sm) * duck

# tail fade, soft clip, normalise
fade = int(1.2 * SR)
mix[:, -fade:] *= np.linspace(1, 0, fade) ** 2
mix = np.tanh(0.9 * mix) / np.tanh(0.9)   # gentle: keep the hits' punch
mix *= 0.95 / np.abs(mix).max()
sf.write('assets/bgm/score.wav', mix.T, SR, subtype='PCM_16')

meta = json.load(open('audio_meta.json'))
meta['bgm'] = {'path': 'assets/bgm/score.wav', 'volume': BGM_VOLUME}
meta.pop('bgm_pending', None)
json.dump(meta, open('audio_meta.json', 'w'), indent=1)
print('score %.2fs  hits at %.2f %.2f %.2f %.2f' % (TOTAL, s4, c1, c2, s11))
