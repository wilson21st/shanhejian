# Seal round 2 for design-poem-seals2.html: 「李氏太白」(姓氏 + 字, the 赵孟頫「赵氏子昂」 form) alone and paired with a
# second seal, so Wilson can see it before anything on the live poems changes. Reuses the drawing code of seals-cmp.py
# (same font, same ink filter); writes data/design-poem/seals-cmp2/<n>-<id>.svg + seals.json.
# usage: python3 tools/design-poem/seals-cmp2.py /path/to/chongxi_seal.otf   (download: xiaoxue.iis.sinica.edu.tw/chongxi)
import os, json, random
src = open(os.path.join(os.path.dirname(__file__), 'seals-cmp.py')).read()
exec(src[:src.index('os.makedirs(OUT')])
OUT = 'data/design-poem/seals-cmp2/'

def lianzhu(chars, colour, seed, rot=1):
    """联珠印 朱文: two small square seals cut on one stone, one character each, stacked (like 唐太宗「贞观」)"""
    rnd = random.Random(seed); W, H, b = 50, 100, 3.2
    body = ''.join(f'<rect x="{b / 2}" y="{y + b / 2}" width="{W - b}" height="{48 - b}" rx="1.5" fill="none" stroke="{colour}" stroke-width="{b}"/>' for y in (0, 52))
    strokes = glyph(chars[0], 7, 7, 36, 34, .96) + glyph(chars[1], 7, 59, 36, 34, .96)
    body += f'<g fill="{colour}" stroke="{colour}" stroke-width="30" stroke-linejoin="round">{strokes}</g>'
    mask = f'<g fill="#000">{chips(rnd, {"kind": "rect", "w": W, "h": H}, 5, 2.2)}</g>'
    return svg(f'{chars} · 朱文联珠印', W, H, body, mask, ink_filter(seed, colour, holes=.69), rot)

os.makedirs(OUT, exist_ok=True)
ZHUSHA, ZHUBIAO = '#b8231a', '#c4402a'
OPTS = [
    dict(n=1, id='baiwen', name='白文方印 · 汉印风', text='李氏太白', place='end', w=1.05, h=1.05, svg=baiwen('李氏太白', ZHUSHA, 121),
         note='单独一个印。右行「李氏」、左行「太白」，红底白字，方正饱满。'),
    dict(n=2, id='yuanzhu', name='朱文方印 · 元朱文', text='李氏太白', place='end', w=1.05, h=1.05, svg=zhuwen('李氏太白', ZHUSHA, 133, line=14, border=2.6),
         note='单独一个印。红字幼笔、细边框，赵孟頫「赵氏子昂」就系呢种刻法。'),
    dict(n=3, id='pair-qinglian', name='对章：李氏太白 + 青莲居士', text='李氏太白 + 青莲居士', place='end2', w=.86, h=.86,
         svg=baiwen('李氏太白', ZHUSHA, 141, M=8, cut=30, rot=-1.5), svg2=zhuwen('青蓮居士', ZHUSHA, 142, line=16, border=2.8, rot=1.5),
         note='上白文「李氏太白」，下朱文「青莲居士」（号）。一白一朱，明清书画最常见嘅配法。'),
    dict(n=4, id='pair-zhuyin', name='对章：李氏太白 + 联珠「太白」', text='李氏太白 + 太白', place='end2', w=.86, h=.86,
         svg=baiwen('李氏太白', ZHUSHA, 151, M=8, cut=30, rot=-1.5), svg2=lianzhu('太白', ZHUBIAO, 152),
         note='上白文「李氏太白」，下朱文联珠「太白」，学唐太宗「贞观」两个细印连埋嘅格式。'),
    dict(n=5, id='pair-zhubai', name='对章：朱白调转', text='李氏太白 + 青莲居士', place='end2', w=.86, h=.86,
         svg=zhuwen('李氏太白', ZHUSHA, 161, line=16, border=2.8, rot=1.5), svg2=baiwen('青蓮居士', ZHUSHA, 162, M=8, cut=30, rot=-1.5),
         note='上朱文「李氏太白」，下白文「青莲居士」，同第 3 款相反，睇边个红色多啲好睇。'),
]
meta = []
for o in OPTS:
    o['file'] = f'{o["n"]}-{o["id"]}.svg'; open(OUT + o['file'], 'w').write(o.pop('svg'))
    if 'svg2' in o:
        o['file2'] = f'{o["n"]}-{o["id"]}-b.svg'; open(OUT + o['file2'], 'w').write(o.pop('svg2'))
    meta.append(o)
json.dump(dict(options=meta, glyphs=dict(name='崇羲篆體 Chongxi Small Seal', by='中央研究院 小學堂', licence='CC BY-ND 3.0 TW (or later)',
          source='https://xiaoxue.iis.sinica.edu.tw/chongxi/', licenceUrl='https://xiaoxue.iis.sinica.edu.tw/chongxi/copyright.htm'),
          poem=dict(id='p23', title='早发白帝城', poet='李白', text=['朝辞白帝彩云间，', '千里江陵一日还。', '两岸猿声啼不尽，', '轻舟已过万重山。'])),
          open(OUT + 'seals.json', 'w'), ensure_ascii=False, indent=1)
for o in meta: print(o['n'], o['id'], o['file'], o.get('file2', ''))
