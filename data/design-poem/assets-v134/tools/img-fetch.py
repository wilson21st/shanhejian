#!/usr/bin/env python3
"""Fetch picked paintings -> img/<id>.jpg (long edge <=2400) + work/img-meta.json.
usage: img-fetch.py [id ...]   (default: all in work/picks.json not yet fetched)"""
import json, os, re, sys, time, subprocess, urllib.parse
from PIL import Image, ImageFilter, ImageOps
Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW, OUT = f"{ROOT}/raw/img", f"{ROOT}/img"
META = f"{ROOT}/work/img-meta.json"
UA = {"User-Agent": "history-sandbox/1.0 (edu project; https://github.com/wilson21st/shanhejian)"}
OK = re.compile(r"^(public domain|pd|cc0|cc by(?!-sa)|no restrictions)", re.I)
os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)

def get(url, tries=6):
    # curl, not urllib: python.org Python here has no CA bundle
    for k in range(tries):
        r = subprocess.run(["curl", "-sfL", "--http1.1", "-m", "300", "-A", UA["User-Agent"], url], capture_output=True)
        if r.returncode == 0 and r.stdout: return r.stdout
        print("  retry", k, r.returncode, url[:90], flush=True); time.sleep(30 * (k + 1))
    raise RuntimeError("fetch failed " + url)

strip = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", str(s or ""))).strip()

def commons(title, scroll=False):
    q = {"action": "query", "format": "json", "prop": "imageinfo", "titles": "File:" + title,
         "iiprop": "url|size|mime|extmetadata", "iiurlwidth": 1920}
    j = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(q)))
    pg = list(j["query"]["pages"].values())[0]
    if "imageinfo" not in pg: raise RuntimeError("missing on Commons: " + title)
    i = pg["imageinfo"][0]; m = i.get("extmetadata", {})
    v = lambda k: strip(m.get(k, {}).get("value"))
    meta = {"source": "Wikimedia Commons", "title": title, "page": i["descriptionurl"],
            "licence": v("LicenseShortName"), "author": v("Artist")[:200], "date": v("DateTimeOriginal")[:60],
            "credit": v("Credit")[:200], "orig_w": i["width"], "orig_h": i["height"]}
    # originals get 429 under bulk use; standard thumb buckets (1920/3840) do not. Scrolls need the original height.
    w, h = i["width"], i["height"]; need = 2400 if w >= h else 2400 * w / h
    if scroll and i["mime"] != "image/tiff" and os.environ.get("ORIG"): return meta, i["url"].split("?")[0]
    fits = [x for x in (500, 960, 1280, 1920, 3840) if x < w]
    b = next((x for x in fits if x >= need), fits[-1]) if not scroll else fits[-1]
    i["url"] = i["url"].split("?")[0]; base = i["url"].split("/commons/", 1)[1]; name = base.rsplit("/", 1)[1]
    pre = "lossy-page1-" if i["mime"] == "image/tiff" else ""
    suf = ".jpg" if i["mime"] in ("image/tiff", "image/png") and pre else ""
    return meta, f"https://upload.wikimedia.org/wikipedia/commons/thumb/{base}/{pre}{b}px-{name}{suf}"

def met(oid):
    o = json.loads(get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}"))
    meta = {"source": "The Metropolitan Museum of Art", "title": o.get("title"), "page": o.get("objectURL"),
            "licence": "Public Domain (Met Open Access, CC0)" if o.get("isPublicDomain") else "NOT PD",
            "author": o.get("artistDisplayName"), "date": o.get("objectDate"), "credit": o.get("creditLine")}
    if not o.get("primaryImage"): raise RuntimeError(f"Met {oid} has no image")
    return meta, o["primaryImage"]

def autocrop(im):
    """Long handscroll -> 7:5 landscape window with the most detail (edge energy)."""
    w, h = im.size; cw = int(h * 1.4)
    if w <= cw * 1.15: return im, None
    sw = 1200 / w if w > 1200 else 1
    g = ImageOps.grayscale(im.resize((max(1, int(w * sw)), max(1, int(h * sw))))).filter(ImageFilter.FIND_EDGES)
    gw, gh = g.size; px = g.load(); cols = [sum(px[x, y] for y in range(0, gh, 2)) for x in range(gw)]
    win = max(1, int(cw * sw)); s = sum(cols[:win]); best, bx = s, 0
    for x in range(1, gw - win + 1):
        s += cols[x + win - 1] - cols[x - 1]
        if s > best: best, bx = s, x
    x0 = min(w - cw, int(bx / sw)); box = (x0, 0, x0 + cw, h)
    return im.crop(box), list(box)

def main():
    picks = json.load(open(f"{ROOT}/work/picks.json"))["images"]
    meta = json.load(open(META)) if os.path.exists(META) else {}
    ids = sys.argv[1:] or [k for k in picks if k not in meta]
    for k in ids:
        p = picks[k]
        try:
            m, url = commons(p["c"], p.get("crop") == "auto") if "c" in p else met(p["m"])
            if not OK.match(m["licence"] or ""): print(f"SKIP {k}: licence {m['licence']}"); m["rejected"] = True; meta[k] = {**m, "zh": p["zh"]}; continue
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower() or ".jpg"
            rp = f"{RAW}/{k}{ext}"
            if not os.path.exists(rp): open(rp + ".part", "wb").write(get(url)); os.replace(rp + ".part", rp); time.sleep(3)
            im = Image.open(rp); im = ImageOps.exif_transpose(im).convert("RGB")
            crop = None
            if p.get("crop") == "auto": im, crop = autocrop(im)
            sc = min(1, 2400 / max(im.size))
            if sc < 1: im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
            im.save(f"{OUT}/{k}.jpg", quality=86, optimize=True, progressive=True)
            meta[k] = {**m, "zh": p["zh"], "file": f"img/{k}.jpg", "w": im.width, "h": im.height,
                       "crop_src_px": crop, "fetched_from": url, "book": p.get("book", False)}
            print(f"OK {k} {im.width}x{im.height} {m['licence']}" + (f" crop {crop}" if crop else ""))
        except Exception as e:
            print(f"FAIL {k}: {e}")
        json.dump(meta, open(META, "w"), ensure_ascii=False, indent=1)
        time.sleep(1)

main()
