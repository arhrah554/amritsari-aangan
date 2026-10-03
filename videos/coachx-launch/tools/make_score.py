"""Trailer score for the CoachX launch video, synthesised from scratch.

No music service can deliver into this machine (its egress policy blocks the
CDN hosts), so the bed is built here with numpy: a sound-designed trailer
score cut to the frame grid in assets/voice/cues.json.

    Act 1  (F1–F2)  low drone, heartbeat doublets, a clock that speeds up,
                    a riser pulling into the drop
    Drop   (F3)     near-silence: a thin high ring, then a reverse swell
    Hit    (F4)     sub drop + noise slam + braam — the reveal
    Act 2  (F5–F9)  120 BPM hybrid percussion and a pulsing bass ostinato,
                    a braam on each new feature, intensity climbing
    Climax (F10)    two hits on "Stop guessing" / "Start training"
    Outro  (F11)    last impact under the logo, ring-out

Whooshes sit on every transition. The bed is sidechain-ducked against the
narration so the voice always reads. Deterministic: fixed seeds, no clock.

Writes assets/bgm/score.wav and sets audio_meta.json's bgm.
"""
import json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
BGM_VOLUME = 0.85  # as mounted under the narration (assemble-index reads this)
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


def bass_note(f, d=0.12):
    x = tt(d)
    s = saw(f, d, 18) * np.exp(-x / 0.07)
    return np.tanh(2.0 * lp(s, 900))


# ------------------------------------------------------------- arrangement
s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11 = (start[i] for i in range(1, 12))

# Act 1 — drone, heartbeat, accelerating clock, riser into the drop
add(drone(s3 - s1 + 0.3, gain=0.55), s1)
hb = s1 + 0.5
period = 1.25
while hb < s3 - 0.4:
    add(heartbeat(), hb, 0.9)
    hb += period; period = max(0.62, period * 0.93)
tk, step = s1 + 0.3, 0.5
while tk < s3 - 0.1:
    add(tick(), tk, 0.18 + 0.25 * (tk - s1) / (s3 - s1), pan=0.35 if int(tk * 10) % 2 else -0.35)
    tk += step; step = max(0.125, step * 0.965)
add(riser(4.2, gain=0.45), s3 - 4.2)

# Drop — silence but for a thin ring, then a reverse swell into the hit
ring = np.sin(2 * np.pi * 3520 * tt(s4 - s3)) * 0.03 * np.exp(-tt(s4 - s3) / 2.5)
add(ring, s3, pan=0.2)
add(reverse_swell(1.1), s4 - 1.1, 0.9)

# Hit — the reveal
add(impact(4.5), s4, 1.0)
add(braam(3.6), s4, 0.9)

# Act 2 — 120 BPM grid from the hit
BEAT = 0.5
def intensity(t):
    if t < s5: return 0.0
    if t < s6: return 0.55
    if t < s7: return 0.65
    if t < s8: return 0.72
    if t < s9: return 0.82
    if t < s10: return 0.95
    return 0.0

bar = 0
t = s5
pattern_kick = [0, 0.75, 1.5, 2.0, 2.5, 3.25]          # beats within a 4-beat bar
pattern_bass = [36.71, 36.71, 0, 36.71, 43.65, 36.71, 0, 32.70]  # D D - D F D - C (8ths)
while t < s10 - 0.05:
    I = intensity(t)
    for b in pattern_kick:
        tb = t + b * BEAT
        if tb < s10 - 0.05: add(kick(), tb, 0.85 * I)
    for b in (1.0, 3.0):
        tb = t + b * BEAT
        if tb < s10 - 0.05 and I > 0.6: add(snare(), tb, 0.45 * I, pan=0.1)
    for j, f in enumerate(pattern_bass * 1):
        tb = t + j * BEAT / 2
        if f and tb < s10 - 0.05:
            add(bass_note(f * 2, 0.2), tb, 0.32 * I)
    # 16th hats once the energy is up
    if I > 0.7:
        for j in range(16):
            tb = t + j * BEAT / 4
            if tb < s10 - 0.05:
                add(tick(), tb, 0.10 * I * (1.0 if j % 4 == 2 else 0.6), pan=0.4 if j % 2 else -0.4)
    if I > 0.8:
        for j, f0 in enumerate((110, 90, 75)):
            tb = t + (3.5 + j * 0.166) * BEAT
            if tb < s10 - 0.05: add(tom(f0), tb, 0.45 * I, pan=-0.3 + 0.3 * j)
    bar += 1
    t += 4 * BEAT
# a braam on every new feature beat
for s, g in ((s5, 0.55), (s6, 0.5), (s7, 0.5), (s8, 0.6), (s9, 0.7)):
    add(braam(2.4, bright=1200), s, g)
# roll + riser into the climax
roll_t = s10 - 1.5
for j in range(24):
    tb = roll_t + j * (1.5 / 24)
    add(snare(), tb, 0.12 + 0.5 * j / 24, pan=0.15)
add(riser(2.2, 300, 6000, 0.55), s10 - 2.2)

# Climax — a hit on each command
c1 = s10 + cues['10']['phrases'][0]['start']
c2 = s10 + cues['10']['phrases'][1]['start']
for c in (c1, c2):
    add(impact(1.8), c - 0.02, 0.85)
    add(braam(1.6, bright=2200), c - 0.02, 0.7)
    add(kick(), c - 0.02, 1.0)

# Outro — last impact under the logo, ring-out
add(impact(5.0), s11, 1.05)
add(braam(5.0, bright=900), s11, 0.75)
add(drone(TOTAL - s11, gain=0.35), s11)

# Whooshes into every transitioned frame (cuts get none — they hit on the cut)
for f, kind in ((2, 'in'), (5, 'zoom'), (6, 'push'), (7, 'push'), (8, 'push'), (9, 'zoom'), (11, 'in')):
    s = start[f]
    add(whoosh(0.8, up=True), s - 0.55, 0.55 if kind != 'zoom' else 0.7)

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
