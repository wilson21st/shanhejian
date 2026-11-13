#!/usr/bin/env python3
"""Cut a bed from a raw track, normalise and encode. usage: bgm-encode.py <raw> <out-id> [start_s] [len_s]
Writes ../bgm/<id>.m4a  (AAC 96k stereo, -23 LUFS, 3 s fade-in, 5 s fade-out)
   and ../bgm/<id>.loop.m4a (seamless loop: tail crossfaded into head, no fades)
Start is auto-picked (steadiest loud window, skipping the first 8 s) when not given."""
import json, subprocess, sys, os, re
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'bgm'); os.makedirs(OUT, exist_ok=True)
SR, XF = 22050, 6.0

def dur(p):
    return float(subprocess.run(['ffprobe', '-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', p],
                                capture_output=True, text=True).stdout.strip())

def loud_span(p):
    """first/last second whose level is within 35 dB of the track's loud blocks (trims leading/trailing silence)"""
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    db = np.array([20 * np.log10(np.sqrt((x[i:i + SR] ** 2).mean() + 1e-12)) for i in range(0, len(x) - SR, SR)])
    ok = np.where(db > np.percentile(db, 90) - 35)[0]
    return float(ok[0]), float(ok[-1] + 1)

def pick(p, L):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', p, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
    blk = SR  # 1 s blocks
    r = np.array([np.sqrt((x[i:i + blk] ** 2).mean() + 1e-12) for i in range(0, len(x) - blk, blk)])
    db = 20 * np.log10(r)
    n, L = len(db), int(L)
    if n <= L + 8: return max(0, (n - L) // 2)
    best, bs = 8, -1e9
    for s in range(8, n - L - 2):
        w = db[s:s + L]
        score = w.mean() - 0.6 * w.std() - 2.0 * (w < w.max() - 30).mean() * 10
        if score > bs: best, bs = s, score
    return best

def lufs(p):
    e = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', e)
    return float(I[-1]) if I else None

def run(a): subprocess.run(['ffmpeg', '-v', 'error', '-y'] + a, check=True)

src, oid = sys.argv[1], sys.argv[2]
D = dur(src)
A, B = loud_span(src)
L = float(sys.argv[4]) if len(sys.argv) > 4 else min(150.0, B - A)
S = float(sys.argv[3]) if len(sys.argv) > 3 else (A if B - A <= L + 8 else pick(src, L))
SHORT = L < 90 + XF  # too short for one pass: main file = seamless loop repeated
tmp = os.path.join(OUT, f'.{oid}.wav')
# 1) cut + two-pass loudnorm to -23 LUFS
run(['-ss', str(S), '-t', str(L), '-i', src, '-ac', '2', '-ar', '44100', tmp + '.cut.wav'])
m = subprocess.run(['ffmpeg', '-hide_banner', '-i', tmp + '.cut.wav', '-af', 'loudnorm=I=-23:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'],
                   capture_output=True, text=True).stderr
j = json.loads(m[m.rindex('{'):m.rindex('}') + 1])
ln = (f"loudnorm=I=-23:TP=-2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
      f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
run(['-i', tmp + '.cut.wav', '-af', ln + ',aresample=44100', tmp])
# 3) seamless loop: body = [XF, L-XF], then tail [L-XF, L] crossfaded with head [0, XF]
run(['-i', tmp, '-filter_complex',
     f"[0]atrim={XF}:{L - XF},asetpts=N/SR/TB[b];[0]atrim={L - XF}:{L},asetpts=N/SR/TB,afade=t=out:d={XF}:curve=qsin[t];"
     f"[0]atrim=0:{XF},asetpts=N/SR/TB,afade=t=in:d={XF}:curve=qsin[h];[t][h]amix=inputs=2:normalize=0[x];[b][x]concat=n=2:v=0:a=1",
     '-c:a', 'aac', '-b:a', '96k', os.path.join(OUT, oid + '.loop.m4a')])
# 2) play-once version with fades (short sources: the loop played until >= 96 s)
if SHORT:
    k = int(np.ceil(96 / (L - XF)))
    T = k * (L - XF)
    run(['-stream_loop', str(k - 1), '-i', os.path.join(OUT, oid + '.loop.m4a'), '-af', f'afade=t=in:d=3,afade=t=out:st={T - 5}:d=5',
         '-c:a', 'aac', '-b:a', '96k', os.path.join(OUT, oid + '.m4a')])
else:
    run(['-i', tmp, '-af', f'afade=t=in:d=3,afade=t=out:st={L - 5}:d=5', '-c:a', 'aac', '-b:a', '96k', os.path.join(OUT, oid + '.m4a')])
for f in (tmp, tmp + '.cut.wav'): os.remove(f)
o = os.path.join(OUT, oid + '.m4a')
print(json.dumps(dict(id=oid, src=os.path.basename(src), start=S, len=round(L, 1), out_dur=round(dur(o), 1),
                      loop_dur=round(dur(os.path.join(OUT, oid + '.loop.m4a')), 1), lufs=lufs(o), kb=os.path.getsize(o) // 1024)))
