# Original score + sound design + voiceover mix for "Raise your flag" (Ensign Studio).
import numpy as np, subprocess, sys
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000; END = 39.6; N = int(END * SR)
rng = np.random.default_rng(7)
T = np.arange(N) / SR
def at(t): return int(t * SR)
def nf(note):  # 'D4' -> Hz
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = note[:-1], int(note[-1]); return 440 * 2 ** ((names[n] + (o - 4) * 12) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def env(n, a, r, sus=1.0):
    e = np.ones(n) * sus; ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai) * sus
    ri = min(n, int(r * SR)); e[n - ri:] *= np.linspace(1, 0, ri); return e
def add(buf, sig, t, g=1.0):
    i = at(t); j = min(len(buf), i + len(sig)); buf[i:j] += sig[:j - i] * g
IR = rng.standard_normal(int(3.2 * SR)) * np.exp(-np.linspace(0, 7, int(3.2 * SR))); IR = lp(IR, 6000); IR /= np.abs(IR).sum() ** .5 * 6
def verb(x, mix=.35): w = fftconvolve(x, IR)[:len(x)]; return x * (1 - mix) + w * mix

mus = np.zeros(N); sfx = np.zeros(N)

# --- piano: a few partials with decay, slightly detuned ---
def piano(note, dur=3.5, vel=.5):
    f = nf(note); n = int(dur * SR); t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * k * (1 + .0007 * k) * t) * np.exp(-t * (1.6 + k * .9)) for k, a in [(1, 1), (2, .45), (3, .22), (4, .12), (5, .06)])
    s *= np.minimum(1, t / .004); return s * vel
# --- string pad: detuned saws, slow attack, filtered ---
def strings(notes, dur, att=1.2, rel=1.5, cut=1800, vel=.18):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for note in notes:
        f = nf(note)
        for d in (-.006, 0, .007):
            ph = (f * (1 + d) * t + rng.random()) % 1; s += (2 * ph - 1) * .33
    s = lp(s, cut, 4) * env(n, att, rel) * vel / len(notes) ** .5
    return s
def sub_boom(dur=3.0, f0=62, f1=28, vel=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = f1 + (f0 - f1) * np.exp(-t * 6)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6)
    s += lp(rng.standard_normal(n), 900) * np.exp(-t * 14) * .6
    return s * vel
def hit(vel=.8):  # taiko-ish
    n = int(1.2 * SR); t = np.arange(n) / SR; f = 70 + 90 * np.exp(-t * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 5) + bp(rng.standard_normal(n), 150, 2500) * np.exp(-t * 28) * .5
    return s * vel
def tick(vel=.12):
    n = int(.08 * SR); return hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * 70) * vel
def whoosh(dur=.6, up=True, vel=.35):
    n = int(dur * SR); t = np.linspace(0, 1, n); e = np.sin(np.pi * t) ** 2
    x = rng.standard_normal(n); out = np.zeros(n); seg = 2400
    for k in range(0, n, seg):  # sweep a band through the noise
        c = 400 + (3600 if up else -3000) * (k / n) + (0 if up else 3400)
        out[k:k + seg] = bp(x[k:k + seg + 2000], max(80, c * .6), c * 1.4)[:len(out[k:k + seg])]
    return out * e * vel
def riser(dur, vel=.25):
    n = int(dur * SR); t = np.linspace(0, 1, n)
    s = hp(rng.standard_normal(n), 300) * t ** 2.5; tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * t ** 2) / SR) * t ** 3 * .3
    return (lp(s, 6000) + tone) * vel

# 1) Opening: wind bed and a low drone
wind = lp(rng.standard_normal(at(17.6)), 500, 2) * (0.5 + 0.5 * np.sin(2 * np.pi * .13 * T[:at(17.6)]) ** 2)
sfx[:len(wind)] += wind * .09 * env(len(wind), 1.5, 1.0)
add(mus, strings(['D2', 'A2', 'D3'], 17.6, att=3, rel=.4, cut=700, vel=.34), 0.2)
# piano motif, sparse and hopeful
for t, n_, v in [(1.3, 'D4', .42), (2.8, 'A4', .32), (4.3, 'F4', .36), (5.95, 'E4', .34), (7.4, 'D4', .34), (8.55, 'A4', .30), (10.3, 'C5', .30), (11.55, 'Bb4', .32), (13.1, 'A4', .34), (14.6, 'F4', .30), (16.0, 'E4', .30)]:
    add(mus, piano(n_, 3.5, v), t)
add(mus, strings(['F3', 'A3', 'C4'], 5.0, att=2.2, rel=.3, cut=1400, vel=.2), 12.7)
add(sfx, riser(3.0, .22), 14.45)
mus[at(17.42):at(17.6)] *= np.linspace(1, 0, at(17.6) - at(17.42))  # breath before the hit

# 2) The turn: boom, then a driving montage
add(sfx, sub_boom(3.2, vel=1.0), 17.6)
add(mus, strings(['D3', 'A3', 'F4'], 9.8, att=.6, rel=.6, cut=2600, vel=.22), 17.6)
bass = np.zeros(at(9.7)); step = 60 / 100 / 2  # 8ths at 100 bpm
for k, nn in enumerate((['D2', 'D2', 'F2', 'D2', 'A2', 'D2', 'C3', 'A2'] * 12)):
    if k * step >= 9.6: break
    f = nf(nn); n = int(step * .9 * SR); t = np.arange(n) / SR; s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(4 * np.pi * f * t)) * np.exp(-t * 5)
    i = int(k * step * SR); bass[i:i + n] += s[:len(bass) - i] * .5
add(mus, lp(bass, 600), 17.6)
for k in range(int(9.6 / (step / 2))):
    add(sfx, tick(.10 if k % 2 else .16), 17.6 + k * step / 2)
for t in [19.8, 20.68, 21.62, 22.48, 23.38, 24.18]:
    add(sfx, hit(.6), t - .16); add(sfx, whoosh(.45, True, .18), t - .5)
add(sfx, whoosh(.9, True, .3), 25.0)
# shimmer as the grid zooms out
sh = sum(np.sin(2 * np.pi * nf(n_) * T[:at(2)]) for n_ in ['D6', 'A6', 'F6']) * np.exp(-T[:at(2)] * 1.2) * .04
add(mus, sh, 25.4)
add(sfx, riser(1.6, .26), 25.75)

# 3) The flag: the swell
add(mus, strings(['D3', 'A3', 'D4', 'F4', 'A4'], 5.3, att=2.0, rel=.15, cut=3200, vel=.34), 27.2)
add(mus, strings(['Bb2', 'F3', 'Bb3', 'D4'], 2.5, att=.8, rel=.15, cut=2600, vel=.22), 29.85)
choir_n = at(5.1); ct = np.arange(choir_n) / SR; choir = np.zeros(choir_n)
for n_ in ['D4', 'A4', 'D5']:
    f = nf(n_)
    for h, a in [(1, 1), (2, .5), (3, .35), (4, .2)]:
        choir += a * np.sin(2 * np.pi * f * h * ct * (1 + .002 * np.sin(2 * np.pi * 5 * ct)))
choir = bp(choir, 300, 2800) * env(choir_n, 2.5, .2) * .05
add(mus, choir, 27.25)
roll = np.zeros(at(5.0))
for k in range(int(5.0 / .07)):
    v = .1 + .55 * (k * .07 / 5.0) ** 2; s = hit(v)[:at(.3)]; i = at(k * .07); roll[i:i + len(s)] += s[:len(roll) - i]
add(sfx, lp(roll, 1200) * .55, 27.3)
flap = bp(rng.standard_normal(at(5.0)), 200, 3000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 3.6 * T[:at(5.0)]))) * .07
add(sfx, flap * env(len(flap), .4, .3), 27.3)
add(sfx, riser(1.2, .3), 31.15)
mus[at(32.2):at(32.34)] *= np.linspace(1, 0, at(32.34) - at(32.2))

# 4) The reveal: impact and a resolved major chord
add(sfx, sub_boom(4.5, 70, 26, 1.1), 32.34)
add(sfx, lp(rng.standard_normal(at(2.5)), 9000) * np.exp(-T[:at(2.5)] * 2.2) * .18, 32.34)  # crash
for n_, v in [('D3', .45), ('F#3', .35), ('A3', .35), ('D4', .38), ('F#4', .3), ('A4', .28)]:
    add(mus, piano(n_, 6.5, v), 32.34)
add(mus, strings(['D3', 'F#3', 'A3', 'D4', 'F#4'], 7.2, att=.8, rel=3.0, cut=2400, vel=.3), 32.34)
for t, n_ in [(34.45, 'A4'), (35.2, 'D5'), (36.6, 'F#5')]:
    add(mus, piano(n_, 3.0, .22), t)

mus = verb(mus, .38); sfx_dry = sfx.copy(); sfx = verb(sfx, .18)

# --- voiceover: cut the take into phrases and place them on the picture ---
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'raw/vo.mp3', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
vo_src = np.frombuffer(raw, np.float32).astype(float)
P = [(0.00, 3.40, 1.25), (3.80, 5.45, 5.95), (5.80, 6.30, 8.55), (6.75, 7.22, 10.30), (7.62, 8.20, 11.55), (8.65, 12.25, 13.05),
     (12.60, 14.45, 17.75), (14.60, 19.55, 19.65), (19.70, 21.55, 25.55), (21.60, 23.00, 27.75), (23.20, 24.30, 33.25), (24.40, 26.67, 34.40)]
vo = np.zeros(N)
for a, b, t in P:
    seg = vo_src[at(a):at(b)].copy(); f = min(len(seg), at(.02)); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    add(vo, seg, t)
vo = hp(vo, 90); vo = vo + fftconvolve(vo, IR)[:N] * .10
# duck the music under the voice
act = np.convolve((np.abs(vo) > .02).astype(float), np.ones(at(.25)) / at(.25), 'same'); act = np.clip(act * 4, 0, 1)
act = lp(act, 6, 1); duck = 1 - .45 * act
mix = mus * duck * 1.0 + sfx * (1 - .25 * act) + vo * 1.25
mix[-at(.6):] *= np.linspace(1, 0, at(.6))
mix /= np.max(np.abs(mix)) * 1.05
st = np.stack([mix, mix], 1)
# a little width on the music only
wide = lp(np.roll(mus * duck, at(.012)), 8000) * .12; st[:, 0] += wide; st[:, 1] -= wide
st /= np.max(np.abs(st)) * 1.02
st.astype(np.float32).tofile('mix.f32'); print('ok', st.shape)
