#!/usr/bin/env python3
"""work/{bgm-beds,img-meta,focal,picks}.json -> manifest.json, CREDITS.md, report.md"""
import json, os, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(f"{ROOT}/{p}"))
B, M, F, P = J("work/bgm-beds.json"), J("work/img-meta.json"), J("work/focal.json"), J("work/picks.json")
poems = J("poems46.json"); poems = poems if isinstance(poems, list) else poems["poems"]

BYSA = {
 "p15": ("阳关三叠 (guqin, Charlie Huang)", "CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Guqin-Yangguan_Sandie.ogg", "this poem set to music"),
 "q14": ("二泉映月 (erhu)", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:%E4%BA%8C%E6%B3%89%E6%98%A0%E6%9C%88.ogg", "grand sorrow"),
 "q07": ("江河水 (erhu)", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:%E6%B1%9F%E6%B2%B3%E6%B0%B4.ogg", "lament"),
 "p24": ("雨打芭蕉 (广东音乐)", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:%E9%9B%A8%E6%89%93%E8%8A%AD%E8%95%89.ogg", "rain"),
 "q02": ("醉渔唱晚 (guqin, Charlie Huang)", "CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Guqin-Zuiyu_Changwan.ogg", "drunken, unrestrained"),
 "q21": ("神人畅 (guqin, Charlie Huang)", "CC BY-SA 2.5", "https://commons.wikimedia.org/wiki/File:Shenren_Chang.ogg", "ancient ritual"),
 "q08": ("连环扣 (广东音乐)", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:%E8%BF%9E%E7%8E%AF%E6%89%A3.ogg", "lively, festive"),
}

beds = {k: {x: v[x] for x in ("file", "loop", "dur", "loop_dur", "lufs", "codec", "mood", "inst", "title", "author", "licence", "page", "source") if x in v}
        | ({"warn": v["warn"]} if v.get("warn") else {}) for k, v in B["beds"].items()}
images = {}
for k, v in M.items():
    f = F[k]
    images[k] = {"file": v["file"], "w": v["w"], "h": v["h"], "zh": v["zh"], "title": v["title"], "author": v.get("author"),
                 "date": v.get("date"), "licence": v["licence"], "page": v.get("page_museum") or v["page"], "source": v["source"],
                 "book_illustration": v.get("book", False), "crop_src_px": v.get("crop_src_px"),
                 "focus": f["focus"], "kb_start": f["kb_start"], "kb_end": f["kb_end"], "focal_method": f["method"], "needs_review": f["review"]}
pm = {p["id"]: {"poet": p["poet"], "title": p["title"], "bgm": B["map"][p["id"]], "images": P["poems"][p["id"]],
                **({"bgm_bysa_alt": BYSA[p["id"]][0]} if p["id"] in BYSA else {})} for p in poems}
man = {"version": "v134-assets", "generated": "2026-11-11",
       "notes": {"boxes": "normalised [x,y,w,h], top-left origin, relative to img/<id>.jpg",
                 "kb": "kb_start = widest 390:844 portrait window containing focus; kb_end = 1.35x tighter around focus",
                 "bgm": "<id>.m4a = 3s fade-in / 5s fade-out bed; <id>.loop.m4a = seamless loop (tail crossfaded into head), both ~-23 LUFS, AAC 96k",
                 "licences": "PD / CC0 / CC BY only. CC BY beds need on-screen or credits attribution (see CREDITS.md). No CC BY-SA used."},
       "bgm": beds, "images": images, "poems": pm,
       "bysa_alternatives_need_ok": {k: {"name": a, "licence": b, "page": c, "why": d} for k, (a, b, c, d) in BYSA.items()}}
json.dump(man, open(f"{ROOT}/manifest.json", "w"), ensure_ascii=False, indent=1)

# CREDITS.md
c = ["# v134 asset credits", "", "## Music (BGM beds)", ""]
for k, v in beds.items():
    c.append(f"- **{k}** — \"{v['title']}\" by {v['author']}, {v['licence']}, {v['source']}: {v['page']}" + (" (normalised, trimmed, looped)" if "BY" in v["licence"] else ""))
c += ["", "## Paintings", "", "All public domain or CC0. Listed for provenance (no attribution legally required).", ""]
for k, v in sorted(images.items()):
    c.append(f"- **{k}** — {v['zh']} · {v['licence']} · {v['source']}: {v['page']}")
open(f"{ROOT}/CREDITS.md", "w").write("\n".join(c) + "\n")

# report.md
cnt = collections.Counter(v["focal_method"] for v in images.values())
review = sorted(k for k, v in images.items() if v["needs_review"])
small = sorted((k, v["w"], v["h"]) for k, v in images.items() if max(v["w"], v["h"]) < 1300)
lic = collections.Counter(v["licence"] for v in images.values())
r = ["# v134 assets — report", "", "Folder: `~/dev/history-sandbox/data/design-poem/assets-v134/` (nothing outside it touched).", "",
     "## Counts", "",
     f"- BGM beds: {len(beds)} (each .m4a + .loop.m4a, ~-23 LUFS, AAC 96k); {len(set(B['map'].values()))} mapped to poems, `qiufengci` reserve (sung vocals)",
     f"- Paintings: {len(images)} unique in img/ (long edge ≤2400); licences {dict(lic)}",
     f"- Poems: {len(pm)} — all have a bed and 3-4 images ({dict(collections.Counter(len(v['images']) for v in pm.values()))})",
     f"- Focal boxes: {dict(cnt)}; {len(review)} heuristic (needs_review)", f"- Contact sheets: contact/<poem>.jpg ({len(os.listdir(ROOT + '/contact'))}) — red = focus, cyan = kb_start, yellow = kb_end", "",
     "## Per poem", ""]
for pid, v in pm.items():
    r.append(f"- {pid} {v['poet']}《{v['title']}》 — bgm `{v['bgm']}`; img " + ", ".join(v["images"]) + (f"; BY-SA alt: {v['bgm_bysa_alt']}" if "bgm_bysa_alt" in v else ""))
r += ["", "## BGM beds", ""]
for k, v in beds.items():
    r.append(f"- `{k}` {v['dur']}s / loop {v['loop_dur']}s — {v['mood']} — {v['licence']} {v['author']}" + (f" ⚠ {v['warn']}" if v.get("warn") else "") + f" — poems: {', '.join(sorted(p for p, x in pm.items() if x['bgm'] == k)) or '—'}")
r += ["", "## Gaps / caveats", "",
      "- Nobody has listened to the beds or looked at the images: the agent cannot hear audio or see pictures. Choices come from metadata, loudness/onset analysis and Apple Vision.",
      "- Synth-made beds (neolein karst/blossom/guzheng, CVLTIV8R solemn, Kevin MacLeod) may sound less authentic than the guqin recordings.",
      "- `erhu_street` has street noise; `drums` is an outdoor live recording with crowd ambience.",
      f"- {len(review)} focal boxes come from detail-density/saliency (inscriptions masked via OCR), not detected figures — check the contact sheets: {', '.join(review)}",
      f"- Low-resolution sources (long edge <1300 px): {', '.join(f'{k} {w}x{h}' for k, w, h in small)}",
      "- Handscroll segments were auto-cropped by detail density (crop_src_px): zhaojun, beggars (Cleveland 944 MB TIFF), yaoshou_drink, guoguo, xx_full, qianli_sec, cjwl, bamboo_rain, beneficent_rain.",
      "- tsh_* are Japanese Edo-period 《唐诗选画本》 woodblock pages (PD) — the only direct illustrations found for 早发白帝城/黄鹤楼送孟/枫桥夜泊/凉州词/鹿柴; label as Japanese illustrations if used.",
      "- No PD portrait found for 王勃, 陈子昂, 骆宾王, 薛道衡, 王昌龄, 岑参, 高适, 张继, 张九龄, 崔颢; no real desert / Great Wall painting; no Chinese 枫桥/寒山寺 painting (Japanese page only).",
      "- Shared images: some paintings serve several poems (e.g. cjwl ×5, beggars ×4, minghuang ×4).", "",
      "## CC BY-SA alternatives (not used — need Wilson's OK)", ""]
for k, (a, b, cc, d) in BYSA.items():
    r.append(f"- {k} {pm[k]['title']}: {a} — {b} — {cc}")
r += ["", "Using BY-SA would oblige the derived audio (the trimmed/normalised bed) to be shared under BY-SA too, with attribution."]
open(f"{ROOT}/report.md", "w").write("\n".join(r) + "\n")
print("ok", len(beds), len(images), len(pm))
