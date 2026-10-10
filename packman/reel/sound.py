# The soundtrack: every note the game played while it was filmed, made again here as the game makes them
# (one oscillator a note, swelling in a hundredth of a second and dying away), and written out as a WAV.
import json, sys, numpy as np, wave
d = json.load(open(sys.argv[1])); SR = 48000
length = d['frames'] / d['fps'] + 1.0
out = np.zeros(int(length * SR))
for now, f, dur, kind, to, vol, at in d['notes']:
    t0 = (now - d['t0']) / 1000 + at
    if t0 < 0 or t0 >= length: continue
    n = int((dur + 0.02) * SR); t = np.arange(n) / SR
    # the pitch slides to its end exponentially over the note; the phase is the running sum of it
    freq = f * (to / f) ** np.minimum(t / dur, 1) if to else np.full(n, float(f))
    ph = np.cumsum(freq) / SR
    x = ph % 1
    w = np.sin(2 * np.pi * ph) if kind == 'sine' else (4 * np.abs(x - 0.5) - 1) * -1 if kind == 'triangle' else np.where(x < 0.5, 1.0, -1.0) if kind == 'square' else 2 * x - 1
    g = np.where(t < 0.012, 0.0001 * (vol / 0.0001) ** (t / 0.012), vol * (0.0001 / vol) ** np.clip((t - 0.012) / max(dur - 0.012, 1e-4), 0, 1))
    g[t > dur] = 0
    a = int(t0 * SR); e = min(len(out), a + n)
    out[a:e] += (w * g)[:e - a]
peak = np.abs(out).max(); print('notes', len(d['notes']), 'peak', round(float(peak), 3), 'seconds', round(length, 2))
out = out / max(peak, 1e-9) * 0.7   # the game is quiet; the film is brought up to a level that suits a phone
w = wave.open(sys.argv[2], 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
s = (np.clip(out, -1, 1) * 32767).astype('<i2'); w.writeframes(np.repeat(s, 2).tobytes()); w.close()
