#!/usr/bin/env python3
"""Focal boxes for 390x844 portrait Ken Burns + per-poem contact sheets.
reads img/*.jpg, work/vision.jsonl (tools/vision output), work/picks.json, work/img-meta.json
writes work/focal.json, contact/<poem>.jpg
Boxes: normalised [x, y, w, h], top-left origin.
  focus      - the subject (people > objects > saliency > detail density)
  kb_start   - widest portrait (390:844) window that contains the focus
  kb_end     - 1.35x tighter portrait window centred on the focus"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageOps, ImageFont
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AR = 390 / 844
MANUAL = {}  # id -> [x,y,w,h] overrides, filled after review
mf = f"{ROOT}/work/focal-manual.json"
if os.path.exists(mf): MANUAL = json.load(open(mf))

def union(bs):
    x0 = min(b[0] for b in bs); y0 = min(b[1] for b in bs)
    x1 = max(b[0] + b[2] for b in bs); y1 = max(b[1] + b[3] for b in bs)
    return [x0, y0, x1 - x0, y1 - y0]

def ptsbox(pts):
    """pose-head keypoints -> padded head box"""
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    s = max(max(xs) - min(xs), max(ys) - min(ys), 0.03) * 1.6; cx = (max(xs) + min(xs)) / 2; cy = (max(ys) + min(ys)) / 2
    return [max(0, cx - s / 2), max(0, cy - s / 2), s, s]

TEXT = {}
tf = f"{ROOT}/work/textbox.jsonl"
if os.path.exists(tf):
    for l in open(tf):
        v = json.loads(l); TEXT[v["file"].rsplit(".", 1)[0]] = [b for b in v["text"] if b[2] * b[3] < 0.15]

def in_text(b, k):
    """share of box b covered by inscription/seal boxes"""
    cov = 0
    for t in TEXT.get(k, []):
        ix = max(0, min(b[0] + b[2], t[0] + t[2]) - max(b[0], t[0])); iy = max(0, min(b[1] + b[3], t[1] + t[3]) - max(b[1], t[1]))
        cov += ix * iy
    return cov / max(b[2] * b[3], 1e-6)

def detail_box(path, k=None):
    """Box around the densest 30% of edge energy (ink paintings: figures/buildings carry the detail), inscriptions masked."""
    im = ImageOps.grayscale(Image.open(path)); im.thumbnail((256, 256))
    e = im.filter(ImageFilter.FIND_EDGES); w, h = e.size
    d = ImageDraw.Draw(e)
    for t in TEXT.get(k, []):
        d.rectangle([(t[0] - 0.02) * w, (t[1] - 0.02) * h, (t[0] + t[2] + 0.02) * w, (t[1] + t[3] + 0.02) * h], fill=0)
    e = e.filter(ImageFilter.BoxBlur(12)); px = e.load()
    m = max(px[x, y] for x in range(w) for y in range(h)) or 1
    pts = [(x, y) for x in range(w) for y in range(h) if px[x, y] >= 0.7 * m]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return [min(xs) / w, min(ys) / h, (max(xs) - min(xs) + 1) / w, (max(ys) - min(ys) + 1) / h]

def portrait(cx, cy, W, H, scale=1.0):
    """portrait window (normalised) around centre, clamped inside image."""
    if W / H > AR: ph = H / scale; pw = ph * AR
    else: pw = W / scale; ph = pw / AR
    pw, ph = min(pw, W), min(ph, H)
    x = min(max(cx * W - pw / 2, 0), W - pw); y = min(max(cy * H - ph / 2, 0), H - ph)
    return [round(x / W, 4), round(y / H, 4), round(pw / W, 4), round(ph / H, 4)]

def focal(k, v):
    W, H = v["px"]; area = lambda b: b[2] * b[3]
    people = [d["b"] if "b" in d else ptsbox(d["pts"]) for key in ("faces", "poseHeads", "humans", "upper", "animals")
              for d in v.get(key, []) if d.get("c", 1) >= 0.3 and ("b" in d or d.get("pts"))]
    objs = [d["b"] for d in v.get("objectness", []) if d["c"] >= 0.35 and area(d["b"]) < 0.6 and in_text(d["b"], k) < 0.3]
    att = [d["b"] for d in v.get("attention", []) if area(d["b"]) < 0.55 and in_text(d["b"], k) < 0.3]
    if k in MANUAL: f, how = MANUAL[k], "manual"
    elif people: f, how = union(people), "vision-people"
    elif objs: f, how = max(objs, key=lambda b: b[2] * b[3]), "vision-object"
    elif att: f, how = att[0], "vision-saliency"
    else: f, how = detail_box(f"{ROOT}/img/{k}.jpg", k), "detail-density"
    cx, cy = f[0] + f[2] / 2, f[1] + f[3] / 2
    return {"focus": [round(a, 4) for a in f], "method": how, "kb_start": portrait(cx, cy, W, H),
            "kb_end": portrait(cx, cy, W, H, 1.35), "px": [W, H],
            "review": how in ("detail-density", "vision-saliency") }

def sheet(pid, ids, meta, F):
    tiles = []
    for k in ids:
        im = Image.open(f"{ROOT}/img/{k}.jpg").convert("RGB"); im.thumbnail((480, 480)); w, h = im.size
        d = ImageDraw.Draw(im)
        for key, col in (("kb_start", "#00e5ff"), ("kb_end", "#ffd400"), ("focus", "#ff2d55")):
            b = F[k][key]; d.rectangle([b[0] * w, b[1] * h, (b[0] + b[2]) * w, (b[1] + b[3]) * h], outline=col, width=3)
        t = Image.new("RGB", (500, 560), "white"); t.paste(im, ((500 - w) // 2, 10))
        ImageDraw.Draw(t).text((10, 500), f"{k}  {F[k]['method']}\n{meta[k]['zh'][:30]}", fill="black", font=FONT)
        tiles.append(t)
    s = Image.new("RGB", (500 * len(tiles), 560), "white")
    for i, t in enumerate(tiles): s.paste(t, (500 * i, 0))
    s.save(f"{ROOT}/contact/{pid}.jpg", quality=80)

try: FONT = ImageFont.truetype("/System/Library/Fonts/STHeiti Medium.ttc", 18)
except Exception: FONT = ImageFont.load_default()

def main():
    V = {json.loads(l)["file"].rsplit(".", 1)[0]: json.loads(l) for l in open(f"{ROOT}/work/vision.jsonl") if l.strip()}
    meta = json.load(open(f"{ROOT}/work/img-meta.json")); picks = json.load(open(f"{ROOT}/work/picks.json"))
    F = {k: focal(k, v) for k, v in V.items()}
    json.dump(F, open(f"{ROOT}/work/focal.json", "w"), indent=1)
    os.makedirs(f"{ROOT}/contact", exist_ok=True)
    for pid, ids in picks["poems"].items():
        ok = [k for k in ids if k in F and not meta.get(k, {}).get("rejected")]
        if ok: sheet(pid, ok, meta, F)
    from collections import Counter
    print(Counter(f["method"] for f in F.values()), "review:", [k for k, f in F.items() if f["review"]])

main()
