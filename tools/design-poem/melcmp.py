#!/usr/bin/env python3
"""melcmp.py ref a b -> [d(ref,a), d(ref,b)]: mean DTW distance between log-mel spectrograms (16 kHz, 25 ms / 10 ms, 40 mel,
per-file mean/variance normalised). Used by polyphone-check.mjs to tell which homophone swap the voice actually said."""
import json, subprocess, sys
import numpy as np

SR, NFFT, HOP, NMEL = 16000, 400, 160, 40


def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def melfb():
    mel = lambda h: 2595 * np.log10(1 + h / 700)
    imel = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = imel(np.linspace(mel(60), mel(7600), NMEL + 2))
    bins = np.floor((NFFT + 1) * pts / SR).astype(int)
    fb = np.zeros((NMEL, NFFT // 2 + 1))
    for m in range(1, NMEL + 1):
        a, b, c = bins[m - 1], bins[m], bins[m + 1]
        for k in range(a, b): fb[m - 1, k] = (k - a) / max(b - a, 1)
        for k in range(b, c): fb[m - 1, k] = (c - k) / max(c - b, 1)
    return fb


FB = melfb()


def feats(x):
    n = 1 + max(0, (len(x) - NFFT) // HOP)
    fr = np.stack([x[i * HOP:i * HOP + NFFT] * np.hanning(NFFT) for i in range(n)])
    p = np.abs(np.fft.rfft(fr, NFFT)) ** 2
    m = np.log(p @ FB.T + 1e-8)
    return (m - m.mean(0)) / (m.std(0) + 1e-6)


def dtw(a, b):
    c = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(-1))
    n, m = c.shape
    D = np.full((n + 1, m + 1), np.inf); D[0, 0] = 0
    for i in range(1, n + 1):
        row = c[i - 1]
        for j in range(1, m + 1):
            D[i, j] = row[j - 1] + min(D[i - 1, j], D[i, j - 1], D[i - 1, j - 1])
    return D[n, m] / (n + m)


r, a, b = (feats(load(f)) for f in sys.argv[1:4])
print(json.dumps([dtw(r, a), dtw(r, b)]))
