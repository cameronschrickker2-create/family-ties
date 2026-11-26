# Place a voiceover take on the film timeline word by word, with a narrator treatment.
import sys, json, subprocess, numpy as np
from faster_whisper import WhisperModel
SR = 48000; END = 39.6; N = int(END * SR)
src, out = sys.argv[1], sys.argv[2]
def load(path, sr):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(sr), '-af',
        'highpass=f=80,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3200:t=q:w=1.2:g=2.5,deesser=i=0.4,acompressor=threshold=-22dB:ratio=3:attack=5:release=140:makeup=3',
        '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(float)
v16 = np.frombuffer(subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True).stdout, np.float32)
words = [(w.word.strip(' .,…').lower(), w.start, w.end) for s in WhisperModel('base.en', device='cpu', compute_type='int8').transcribe(v16, word_timestamps=True)[0] for w in s.words]
print(' '.join(f'{w}@{a:.2f}' for w, a, b in words))
v = load(src, SR)
# phrases: (first word, last word, target start on the film)
PLAN = [('every', 'see', 1.25), ('you', 'work', 5.95), ('early', 'early', 8.55), ('late', 'late', 10.30), ('properly', 'properly', 11.55),
        ('but', 'secret', 13.05), ('so', 'brand', 17.75), ('research', 'research', 19.85), ('identity', 'identity', 20.73), ('website', 'website', 21.67),
        ('shop', 'shop', 22.53), ('crm', 'crm', 23.43), ('film', 'film', 24.23), ('one', 'weeks', 25.55), ('now', 'it', 27.75),
        ('ensign', 'studio', 33.25), ('your', 'brand', 34.45), ('flown', 'high', 35.62)]
env = np.convolve(np.abs(v), np.ones(int(.01 * SR)) / int(.01 * SR), 'same')
def quiet_near(t, lo, hi):  # lowest-energy point between t+lo and t+hi
    a, b = max(0, int((t + lo) * SR)), min(len(v) - 1, int((t + hi) * SR))
    return (a + int(np.argmin(env[a:b]))) / SR if b > a else t
i = 0; track = np.zeros(N)
for first, last, at in PLAN:
    while i < len(words) and not words[i][0].startswith(first[:4]): i += 1
    if i >= len(words): print('missing', first); continue
    j = i
    while j < len(words) and not words[j][0].startswith(last[:4]): j += 1
    j = min(j, len(words) - 1)
    a = quiet_near(words[i][1], -.18, .02); nxt = words[j + 1][1] if j + 1 < len(words) else words[j][2] + .4
    b = min(nxt - .03, words[j][2] + .28)
    seg = v[int(a * SR):int(b * SR)].copy(); f = min(len(seg) // 4, int(.015 * SR)); seg[:f] *= np.linspace(0, 1, f); g = min(len(seg) // 3, int(.06 * SR)); seg[-g:] *= np.linspace(1, 0, g)
    lead = words[i][1] - a; k = int((at - lead) * SR); track[k:k + len(seg)] += seg[:N - k]
    i = j + 1
track.astype(np.float32).tofile(out); print('placed', out)
