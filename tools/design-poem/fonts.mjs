#!/usr/bin/env node
// 吟诗 v2 brush fonts: download the OFL brush fonts from google/fonts (cached in /tmp/dpfonts), check they carry every glyph in
// glyphs.txt (build.mjs writes it) plus every map poem (poems.json + person-poems.json), subset each to those glyphs →
// data/design-poem/fonts/<id>-sub.woff2 + OFL-<Name>.txt.
// v133 (Wilson 2026-11-11: a poem must never mix fonts): data/design-poem/font-cover.json lists, per poem, the glyphs each
// font lacks; design-poem.html writes the whole poem in the first font of ALT that has them all. 纔浥鄜咷 are in none of the
// four Google brush fonts, so wenkai = 霞鹜文楷 subset from the full LXGW WenKai TTF (the vendored webfont lacks 咷).
//   node tools/design-poem/fonts.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url).pathname, OUT = root + 'data/design-poem/fonts/', C = '/tmp/dpfonts/';
const GF = 'https://github.com/google/fonts/raw/main/ofl/', WK = 'https://github.com/lxgw/LxgwWenKai/';
export const FONTS = [
  { id: 'mashanzheng', file: 'MaShanZheng-Regular.ttf', name: 'MaShanZheng', src: GF + 'mashanzheng/', ofl: GF + 'mashanzheng/OFL.txt' },
  { id: 'zhimangxing', file: 'ZhiMangXing-Regular.ttf', name: 'ZhiMangXing', src: GF + 'zhimangxing/', ofl: GF + 'zhimangxing/OFL.txt' },
  { id: 'liujianmaocao', file: 'LiuJianMaoCao-Regular.ttf', name: 'LiuJianMaoCao', src: GF + 'liujianmaocao/', ofl: GF + 'liujianmaocao/OFL.txt' },
  { id: 'longcang', file: 'LongCang-Regular.ttf', name: 'LongCang', src: GF + 'longcang/', ofl: GF + 'longcang/OFL.txt' },
  { id: 'wenkai', file: 'LXGWWenKai-Regular.ttf', name: 'LXGWWenKai', src: WK + 'releases/download/v1.530/', ofl: WK + 'raw/v1.530/OFL.txt' },
];
// default first, then the fallbacks in the ⚙ panel's order
export const DEFAULT = 'zhimangxing', ALT = ['mashanzheng', 'liujianmaocao', 'longcang', 'wenkai'];
mkdirSync(C, { recursive: true });
const pun = /[，。！？；、：“”‘’「」《》—…（）\s]/g;
const P = [...JSON.parse(readFileSync(root + 'data/poems.json')).events, ...JSON.parse(readFileSync(root + 'data/person-poems.json')).poems];
const need = {};   // every character the brush draws for a poem: body, title (short and full), poet
for (const e of P) { const p = e.poem; need[e.id] = [...new Set((p.text.join('') + (p.short || '') + p.title + p.poet).replace(pun, ''))].join(''); }
const glyphs = [...new Set(readFileSync(new URL('./glyphs.txt', import.meta.url), 'utf8').trim() + Object.values(need).join(''))].join('');
const cover = { default: DEFAULT, alt: ALT, miss: {} };
for (const f of FONTS) {
  const src = C + f.file;
  if (!existsSync(src)) execFileSync('curl', ['-sfL', f.src + f.file, '-o', src]);
  if (!existsSync(OUT + `OFL-${f.name}.txt`)) execFileSync('curl', ['-sfL', f.ofl, '-o', OUT + `OFL-${f.name}.txt`]);
  const lacks = s => execFileSync('python3', ['-c', `from fontTools.ttLib import TTFont;import sys;cm=TTFont(sys.argv[1]).getBestCmap();print(''.join(c for c in sys.argv[2] if ord(c) not in cm))`, src, s]).toString().trim();
  const miss = lacks(glyphs);
  for (const [id, s] of Object.entries(need)) { const m = [...s].filter(c => miss.includes(c)).join(''); if (m) (cover.miss[id] ||= {})[f.id] = m; }
  const out = OUT + f.id + '-sub.woff2';
  execFileSync('pyftsubset', [src, '--text=' + glyphs + '，。？！（）', '--flavor=woff2', '--layout-features=*', '--output-file=' + out]);
  console.log(f.id, (statSync(out).size / 1024).toFixed(0) + 'KB', miss ? 'lacks ' + miss : 'all glyphs');
}
// which font each poem is written in when the default lacks a glyph
cover.use = {};
for (const [id, m] of Object.entries(cover.miss)) if (m[DEFAULT]) {
  const f = ALT.find(a => !m[a]); if (!f) { console.error(id, 'NO font covers', need[id]); process.exitCode = 1; continue; }
  cover.use[id] = f; console.log(id, 'lacks', m[DEFAULT], 'in', DEFAULT, '→ whole poem in', f);
}
writeFileSync(root + 'data/design-poem/font-cover.json', JSON.stringify(cover, null, 1));
