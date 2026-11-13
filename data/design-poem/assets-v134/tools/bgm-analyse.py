#!/usr/bin/env python3
"""Objective features for each audio file (we cannot listen): duration, LUFS/LRA,
onset density (notes per second → tempo/busyness), spectral centroid (brightness),
spectral flatness (noise / crowd walla), quiet-gap share, and a 10 s energy profile
(to find a good segment). usage: bgm-analyse.py file... > out.json"""
import json, subprocess, sys, re
import numpy as np

SR = 16000

def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def ebu(path):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', e); L = re.findall(r'LRA:\s+([\d.]+) LU', e)
    return float(I[-1]) if I else None, float(L[-1]) if L else None

def feats(path):
    x = pcm(path)
    n, hop = 1024, 512
    frames = np.lib.stride_tricks.sliding_window_view(x, n)[::hop] * np.hanning(n)
    S = np.abs(np.fft.rfft(frames, axis=1)) + 1e-9
    f = np.fft.rfftfreq(n, 1 / SR)
    rms = np.sqrt((frames ** 2).mean(1))
    loud = rms > (np.percentile(rms, 95) * 0.1)
    cent = (S * f).sum(1) / S.sum(1)
    flat = np.exp(np.log(S).mean(1)) / S.mean(1)
    flux = np.maximum(0, np.diff(np.log(S), axis=0)).sum(1)
    thr = np.median(flux) + 1.5 * np.std(flux)
    peaks = (flux[1:-1] > thr) & (flux[1:-1] > flux[:-2]) & (flux[1:-1] >= flux[2:])
    dur = len(x) / SR
    # 10 s blocks: rms dB, onset density
    blk = int(10 * SR / hop)
    prof = []
    for i in range(0, len(rms), blk):
        r = rms[i:i + blk]; p = peaks[i:i + blk]
        prof.append([round(20 * np.log10(r.mean() + 1e-9), 1), round(p.sum() / 10, 2)])
    I, LRA = ebu(path)
    return dict(dur=round(dur, 1), lufs=I, lra=LRA, onsets_per_s=round(peaks.sum() / dur, 2),
                centroid_hz=int(np.median(cent[loud])) if loud.any() else 0,
                flatness=round(float(np.median(flat[loud])), 3) if loud.any() else 0,
                quiet_share=round(1 - loud.mean(), 2), profile10s=prof)

out = {}
for p in sys.argv[1:]:
    try:
        out[p.split('/')[-1]] = feats(p)
    except Exception as e:
        out[p.split('/')[-1]] = {'error': str(e)}
    print(p, out[p.split('/')[-1]].get('dur'), file=sys.stderr)
print(json.dumps(out, indent=1))
