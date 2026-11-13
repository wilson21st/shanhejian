#!/usr/bin/env node
// v134 font comparison (design-poem-fonts.html): the five 吟诗 brush fonts plus open-licence kai / brush / handwriting
// candidates, so Wilson can see them side by side and pick. Downloads each font once into /tmp/dpfonts-cmp (cache), copies its
// licence file, measures per-poem coverage over the 46 map poems (body + title + short + poet, punctuation excluded, the same
// glyph set fonts.mjs uses), subsets each to the union of those glyphs → data/design-poem/fonts-cmp/<id>.woff2, and writes
// data/design-poem/fonts-cmp/fonts.json. Touches nothing the poem page reads.
//   node tools/design-poem/fonts-cmp.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, copyFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url).pathname, OUT = root + 'data/design-poem/fonts-cmp/', C = '/tmp/dpfonts-cmp/';
const GF = 'https://github.com/google/fonts/raw/main/ofl/', GH = 'https://github.com/';
const gf = (dir, file) => ({ url: GF + dir + '/' + file, lic: GF + dir + '/OFL.txt', page: 'https://github.com/google/fonts/tree/main/ofl/' + dir });
const OFL = 'SIL OFL 1.1';
// order: the current five (default first), then the new candidates. get: url (a font file) or zip/deb + the member to take.
export const FONTS = [
  { id: 'zhimangxing', zh: '志莽行书', en: 'Zhi Mang Xing', style: '行书', licence: OFL, cur: 'default', file: 'ZhiMangXing-Regular.ttf', ...gf('zhimangxing', 'ZhiMangXing-Regular.ttf') },
  { id: 'mashanzheng', zh: '马善政楷', en: 'Ma Shan Zheng', style: '毛笔楷书', licence: OFL, cur: 1, file: 'MaShanZheng-Regular.ttf', ...gf('mashanzheng', 'MaShanZheng-Regular.ttf') },
  { id: 'liujianmaocao', zh: '刘建毛草', en: 'Liu Jian Mao Cao', style: '草书', licence: OFL, cur: 1, file: 'LiuJianMaoCao-Regular.ttf', ...gf('liujianmaocao', 'LiuJianMaoCao-Regular.ttf') },
  { id: 'longcang', zh: '龙藏体', en: 'Long Cang', style: '行书（手写）', licence: OFL, cur: 1, file: 'LongCang-Regular.ttf', ...gf('longcang', 'LongCang-Regular.ttf') },
  { id: 'wenkai', zh: '霞鹜文楷', en: 'LXGW WenKai', style: '楷书', licence: OFL, cur: 1, file: 'LXGWWenKai-Regular.ttf',
    url: GH + 'lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Regular.ttf', lic: GH + 'lxgw/LxgwWenKai/raw/v1.530/OFL.txt', page: GH + 'lxgw/LxgwWenKai' },
  { id: 'wenkai-medium', zh: '霞鹜文楷 粗', en: 'LXGW WenKai Medium', style: '楷书', licence: OFL, file: 'LXGWWenKai-Medium.ttf',
    url: GH + 'lxgw/LxgwWenKai/releases/download/v1.530/LXGWWenKai-Medium.ttf', lic: GH + 'lxgw/LxgwWenKai/raw/v1.530/OFL.txt', page: GH + 'lxgw/LxgwWenKai' },
  { id: 'wenkaitc', zh: '霞鹜文楷 TC', en: 'LXGW WenKai TC', style: '楷书（繁体字形）', licence: OFL, file: 'LXGWWenKaiTC-Regular.ttf',
    url: GH + 'lxgw/LxgwWenkaiTC/releases/download/v1.530/LXGWWenKaiTC-Regular.ttf', lic: GH + 'lxgw/LxgwWenkaiTC/raw/v1.530/OFL.txt', page: GH + 'lxgw/LxgwWenkaiTC' },
  { id: 'zhenkai', zh: '霞鹜臻楷', en: 'LXGW ZhenKai GB', style: '楷书', licence: OFL, file: 'LXGWZhenKaiSlabGB-Regular.ttf',
    url: GH + 'lxgw/LxgwZhenKai/releases/download/v0.827/LXGWZhenKaiSlabGB-Regular.ttf', lic: GH + 'lxgw/LxgwZhenKai/raw/main/OFL.txt', page: GH + 'lxgw/LxgwZhenKai' },
  { id: 'ukai', zh: '文鼎PL中楷', en: 'AR PL UKai CN', style: '楷书', licence: 'Arphic Public License', file: 'ukai.ttc', fontNumber: 0,
    deb: 'http://deb.debian.org/debian/pool/main/f/fonts-arphic-ukai/fonts-arphic-ukai_0.2.20080216.2-6_all.deb', member: 'ukai.ttc', debLic: 'copyright',
    page: 'https://packages.debian.org/sid/fonts-arphic-ukai' },
  { id: 'iansui', zh: '芫荽', en: 'Iansui', style: '手写楷', licence: OFL, file: 'Iansui-Regular.ttf',
    zip: GH + 'ButTaiwan/iansui/releases/download/v1.020/iansui.zip', member: /\.ttf$/i, lic: GH + 'ButTaiwan/iansui/raw/main/OFL.txt', page: GH + 'ButTaiwan/iansui' },
  { id: 'xiaolai', zh: '小赖字体', en: 'Xiaolai', style: '手写', licence: OFL, file: 'Xiaolai-Regular.ttf',
    url: GH + 'lxgw/kose-font/releases/download/v3.126/Xiaolai-Regular.ttf', lic: GH + 'lxgw/kose-font/raw/master/OFL.txt', page: GH + 'lxgw/kose-font' },
  { id: 'jason', zh: '清松手写体', en: 'Jason Handwriting 1', style: '手写', licence: OFL, file: 'JasonHandwriting1.ttf',
    url: GH + 'jasonhandwriting/JasonHandwriting/raw/master/JasonHandwriting1.ttf', lic: GH + 'jasonhandwriting/JasonHandwriting/raw/master/README.md', page: GH + 'jasonhandwriting/JasonHandwriting' },
  { id: 'zhuque', zh: '朱雀仿宋', en: 'Zhuque Fangsong', style: '仿宋', licence: OFL, file: 'ZhuqueFangsong-Regular.ttf',
    zip: GH + 'TrionesType/zhuque/releases/download/v0.212/ZhuqueFangsong-v0.212.zip', member: /\.ttf$/i, lic: GH + 'TrionesType/zhuque/raw/main/LICENSE.txt', page: GH + 'TrionesType/zhuque' },
  { id: 'zcoolxiaowei', zh: '站酷小薇', en: 'ZCOOL XiaoWei', style: '手绘宋体', licence: OFL, file: 'ZCOOLXiaoWei-Regular.ttf', ...gf('zcoolxiaowei', 'ZCOOLXiaoWei-Regular.ttf') },
  { id: 'yujisyuku', zh: '佑字肃', en: 'Yuji Syuku', style: '毛笔楷书（日本）', licence: OFL, file: 'YujiSyuku-Regular.ttf', ...gf('yujisyuku', 'YujiSyuku-Regular.ttf') },
  { id: 'yujimai', zh: '佑字舞', en: 'Yuji Mai', style: '毛笔行书（日本）', licence: OFL, file: 'YujiMai-Regular.ttf', ...gf('yujimai', 'YujiMai-Regular.ttf') },
];
mkdirSync(C, { recursive: true }); mkdirSync(OUT, { recursive: true });
const curl = (u, o) => execFileSync('curl', ['-sfL', '--retry', '2', u, '-o', o]);
const find = (dir, re) => { for (const n of readdirSync(dir, { withFileTypes: true })) { const p = dir + '/' + n.name;
  if (n.isDirectory()) { const r = find(p, re); if (r) return r; } else if (re.test(n.name)) return p; } };
function fetchFont(f) {
  const src = C + f.file; if (existsSync(src)) return src;
  if (f.url) curl(f.url, src);
  else if (f.zip) { const z = C + f.id + '.zip', d = C + f.id + '-x'; curl(f.zip, z); execFileSync('unzip', ['-oq', z, '-d', d]); copyFileSync(find(d, f.member), src); }
  else if (f.deb) { const d = C + f.id + '-x'; mkdirSync(d, { recursive: true }); curl(f.deb, d + '/p.deb');
    execFileSync('sh', ['-c', `cd ${d} && ar x p.deb && mkdir -p root && tar -xf data.tar.* -C root`]); copyFileSync(find(d + '/root', new RegExp('^' + f.member + '$')), src); }
  return src;
}
function fetchLicence(f) {
  const out = OUT + f.id + '-LICENSE.txt'; if (existsSync(out)) return;
  if (f.debLic) copyFileSync(find(C + f.id + '-x/root', /^copyright$/), out);
  else curl(f.lic, out);
}
const pun = /[，。！？；、：“”‘’「」《》—…（）·\s]/g;
const P = [...JSON.parse(readFileSync(root + 'data/poems.json')).events, ...JSON.parse(readFileSync(root + 'data/person-poems.json')).poems];
const need = {};
for (const e of P) { const p = e.poem; need[e.id] = [...new Set((p.text.join('') + (p.short || '') + p.title + p.poet).replace(pun, ''))].join(''); }
const glyphs = [...new Set(Object.values(need).join(''))].join('');
const res = [];
for (const f of FONTS) {
  let src; try { src = fetchFont(f); fetchLicence(f); } catch (e) { console.error(f.id, 'download failed', e.message); process.exitCode = 1; continue; }
  const fn = f.fontNumber ?? 0;
  const miss = execFileSync('python3', ['-c', `from fontTools.ttLib import TTFont;import sys;cm=TTFont(sys.argv[1],fontNumber=int(sys.argv[3])).getBestCmap();print(''.join(c for c in sys.argv[2] if ord(c) not in cm))`, src, glyphs, String(fn)]).toString().trim();
  const missing = {};
  for (const [id, s] of Object.entries(need)) { const m = [...s].filter(c => miss.includes(c)).join(''); if (m) missing[id] = m; }
  const out = OUT + f.id + '.woff2';
  execFileSync('pyftsubset', [src, '--font-number=' + fn, '--text=' + glyphs + '，。？！、；：（）《》', '--flavor=woff2', '--layout-features=*', '--output-file=' + out]);
  const kb = Math.round(statSync(out).size / 1024), poemsFull = P.length - Object.keys(missing).length;
  res.push({ id: f.id, name_zh: f.zh, name_en: f.en, style: f.style, licence: f.licence, source: f.page, current: f.cur || false,
    file: f.id + '.woff2', licenceFile: f.id + '-LICENSE.txt', kb, cover: { poemsFull, poemsTotal: P.length, missing } });
  console.log(f.id.padEnd(14), (kb + 'KB').padStart(7), `${poemsFull}/${P.length}`, miss ? 'lacks ' + miss.length + ': ' + miss.slice(0, 40) : 'all glyphs');
}
const poems = P.map(e => ({ id: e.id, title: e.poem.title, poet: e.poem.poet, text: e.poem.text }));
writeFileSync(OUT + 'fonts.json', JSON.stringify({ fonts: res, poems, skipped: [
  { name: '演示春风楷 / 演示悠然小楷', reason: '找不到官方仓库或授权文件（只有转载站声称免费商用），授权不明' },
  { name: '佑字朴 Yuji Boku', reason: '同 Yuji 系列，日文字形，覆盖同样差，未加入以免太多' },
] }, null, 1));
