"""Premix narration + score as mounted and report how well the voice reads."""
import json, subprocess, numpy as np, soundfile as sf
SR = 48000
cues = json.load(open('assets/voice/cues.json'))
vol = json.load(open('audio_meta.json'))['bgm']['volume']
m, _ = sf.read('assets/bgm/score.wav'); m = m.mean(1) * vol
N = len(m); vo = np.zeros(N); t = 0
for k in sorted(cues, key=int):
    x, _ = sf.read(f'assets/voice/{int(k):02d}.wav'); i = int(t * SR); n = min(len(x), N - i)
    vo[i:i + n] += x[:n]; t += cues[k]['duration_s']
db = lambda x: 20 * np.log10(np.sqrt((x ** 2).mean()) + 1e-9)
seps = []; t = 0
for k in sorted(cues, key=int):
    for p in cues[k]['phrases']:
        a, b = int((t + p['start']) * SR), int((t + p['end']) * SR)
        seps.append((db(vo[a:b]) - db(m[a:b]), k, p['text']))
    t += cues[k]['duration_s']
seps.sort()
print('voice over music: min %.1f dB (F%s "%s") | median %.1f dB'
      % (seps[0][0], seps[0][1], seps[0][2], np.median([s[0] for s in seps])))
gaps = np.ones(N, bool); t = 0
for k in sorted(cues, key=int):
    for p in cues[k]['phrases']:
        gaps[int((t + p['start']) * SR):int((t + p['end'] + .3) * SR)] = False
    t += cues[k]['duration_s']
print('music between lines %.1f dB | under speech %.1f dB' % (db(m[gaps]), db(m[~gaps])))
mix = m + vo
sf.write('/tmp/premix.wav', np.vstack([mix, mix]).T, SR)
out = subprocess.run(['ffmpeg', '-i', '/tmp/premix.wav', '-af', 'loudnorm=print_format=summary',
                      '-f', 'null', '-'], capture_output=True, text=True).stderr
print(' | '.join(l.strip() for l in out.splitlines() if l.strip().startswith(('Input Integrated', 'Input True Peak', 'Input LRA'))))
