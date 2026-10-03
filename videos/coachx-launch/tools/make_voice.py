"""Narration for the CoachX launch trailer, rendered locally with Kokoro.

The cloud voices (Everygen / Higgsfield) deliver audio from CDN hosts this
machine's egress policy blocks, so the voice is synthesised here: a blend of
Kokoro's am_michael (clearest male voice) and am_onyx (deepest, ~89 Hz), then
given a trailer treatment in ffmpeg — a slight pitch drop, low-end weight,
presence, compression and a short room.

Each line in SCRIPT.md is split into its phrases and every phrase is read
separately, then joined with a deliberate gap. Kokoro's own sentence pauses are
too short for trailer pacing ("Every. Single. Day." runs together), and reading
phrases apart gives exact cue times for the visuals to land on.

Each frame's file is padded so its length IS the frame's length: a lead-in
before the first word and a tail after the last.

Writes assets/voice/NN.wav, assets/voice/cues.json and the voices in
audio_meta.json (bgm / sfx entries are kept if already present).
"""
import json, os, re, subprocess
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

K = Kokoro('/root/kokoro/kokoro-v1.0.onnx', '/root/kokoro/voices-v1.0.bin')
STYLE = 0.55 * K.get_voice_style('am_michael') + 0.45 * K.get_voice_style('am_onyx')
SPEED = 1.04
SR = 24000

GAP = 0.16                      # between phrases
DRAMATIC = {1: 0.24, 9: 0.22}   # frames whose phrases each want their own hit
PADS = {1: (0.6, 0.45), 2: (0.2, 0.4), 3: (0.3, 0.3), 4: (0.7, 0.6),
        5: (0.2, 0.35), 6: (0.2, 0.35), 7: (0.2, 0.35), 8: (0.2, 0.45),
        9: (0.2, 0.35), 10: (0.1, 0.4), 11: (0.45, 1.4)}

# Trailer chain. asetrate drops pitch ~1.4 semitones (formants too — the bigger
# chest read); atempo restores the timing so cue times stay exact.
DROP = 0.92
CHAIN = (f"asetrate={SR}*{DROP},aresample=48000,atempo={1/DROP:.5f},"
         "highpass=f=55,"
         "equalizer=f=110:t=q:w=1.0:g=4,"
         "equalizer=f=320:t=q:w=1.2:g=-2,"
         "equalizer=f=3200:t=q:w=1.5:g=2.5,"
         "acompressor=threshold=-20dB:ratio=3.5:attack=8:release=120:makeup=4,"
         "aecho=0.8:0.5:38|71:0.10|0.06")


def phrases(text):
    # split after . ? ! : keeping the punctuation; quotes stay with their phrase
    parts = re.findall(r'[^.?!:]+[.?!:]+["”]?', text)
    return [p.strip() for p in parts if p.strip()] or [text]


def read(p):
    spoken = p.replace('CoachX', 'Coach X').replace('"', '')
    a, sr = K.create(spoken, voice=STYLE, speed=SPEED, lang='en-us')
    assert sr == SR
    on = np.where(np.abs(a) > 0.01)[0]
    return a[max(0, on[0] - int(.015 * SR)): on[-1] + int(.06 * SR)]


lines, cur = [], None
for raw in open('SCRIPT.md', encoding='utf-8'):
    m = re.match(r'^##\s+Line\s+\d+.*\(Frame\s+(\d+)\)', raw)
    if m:
        cur = {'frame': int(m.group(1)), 'text': ''}
        lines.append(cur)
    elif cur and raw.startswith('    ') and raw.strip():
        cur['text'] += ' ' + raw.strip()

os.makedirs('assets/voice', exist_ok=True)
cues, voices = {}, []
for ln in lines:
    f, text = ln['frame'], ln['text'].strip()
    pre, post = PADS[f]
    gap = DRAMATIC.get(f, GAP)
    buf, t, marks = [np.zeros(int(pre * SR))], pre, []
    for i, p in enumerate(phrases(text)):
        a = read(p)
        if i:
            buf.append(np.zeros(int(gap * SR))); t += gap
        marks.append({'text': p, 'start': round(t, 2), 'end': round(t + len(a) / SR, 2)})
        buf.append(a); t += len(a) / SR
    buf.append(np.zeros(int(post * SR)))
    y = np.concatenate(buf)
    raw = f'/tmp/voice_raw_{f:02d}.wav'
    sf.write(raw, y, SR)
    dst = f'assets/voice/{f:02d}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', CHAIN,
                    '-ar', '48000', '-ac', '1', dst], check=True)
    dur = round(len(y) / SR, 3)
    cues[f] = {'duration_s': dur, 'text': text, 'phrases': marks}
    voices.append({'frame': f, 'path': dst, 'duration_s': dur})
    print(f'frame {f:2d} {dur:5.2f}s  ' + ' | '.join(f"{m['start']:.2f} {m['text']}" for m in marks))

# One loudness pass across the whole read so lines sit at the same level.
peaks = []
for v in voices:
    x, sr = sf.read(v['path'])
    peaks.append(np.sqrt((x[np.abs(x) > 0.02] ** 2).mean()))
target = np.median(peaks)
for v, p in zip(voices, peaks):
    x, sr = sf.read(v['path'])
    x = np.clip(x * (target / p) * (10 ** (-15.5 / 20) / target), -0.89, 0.89)
    sf.write(v['path'], x, sr, subtype='PCM_16')

json.dump(cues, open('assets/voice/cues.json', 'w'), indent=1)
meta = json.load(open('audio_meta.json')) if os.path.exists('audio_meta.json') else {}
meta.update({'voices': voices})
meta.setdefault('bgm', None); meta.setdefault('sfx', [])
json.dump(meta, open('audio_meta.json', 'w'), indent=1)
print('total %.2fs' % sum(v['duration_s'] for v in voices))
