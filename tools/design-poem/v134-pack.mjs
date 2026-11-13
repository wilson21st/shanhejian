#!/usr/bin/env node
// v134 (Wilson 2026-11-11 23:52: 啲图同音乐重复太多): packs data/design-poem/assets-v134/manifest.json (the 18 beds, 94 PD/CC0
// paintings with focal boxes, 46 poems × one bed + 3-4 paintings) into the small file design-poem.html reads,
// data/design-poem/v134.json: {bgm:{id:{f,zh,by,lic,url,lufs}}, img:{id:{f,w,h,cap,lic,url,focus}}, poems:{key:{bgm,img[]}}}.
// Keys are the show ids (baidi chunwang huanghelou) and the map ids (p01 … q21). Only PD / CC0 / CC BY assets (no CC BY-SA).
//   node tools/design-poem/v134-pack.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url).pathname, A = 'assets-v134/';
const M = JSON.parse(readFileSync(root + 'data/design-poem/' + A + 'manifest.json'));
// the beds' names as the page shows them (乐：…)
const ZH = { liushui: '古琴《流水》', pingsha: '古琴《平沙落雁》', kongziduyi: '古琴《孔子读易》', jiukuang: '古琴《酒狂》', peilan: '古琴《佩兰》',
  qiufengci: '古琴《秋风词》', shenyang: '《Shenyang》', cattails: '《Cattails》', karst: '古筝《Karst Mountains》', rain: '笛子 · 雨林',
  solemn: '丝弦《Solemn Asian String》', guzheng: '古筝独奏', blossom: '扬琴古筝《Blossom Valley》', erhu_street: '二胡（北京街头实录）',
  xiao: '箫独奏', guzheng_recital: '古筝独奏（中央音乐学院）', drums: '西安城墙鼓乐', meihua: '古琴曲（实录）' };
const ok = l => /public domain|cc0|^cc by \d/i.test(l) && !/sa/i.test(l);
const out = { bgm: {}, img: {}, poems: {} };
for (const [id, b] of Object.entries(M.bgm)) { if (!ok(b.licence)) throw new Error('licence ' + id + ' ' + b.licence);
  out.bgm[id] = { f: A + b.loop, zh: ZH[id] || id, by: b.author.replace(/\s*\(User:.*\)/, ''), lic: b.licence, url: b.page, lufs: b.lufs, title: b.title }; }
for (const [k, p] of Object.entries(M.poems)) {
  if (!out.bgm[p.bgm]) throw new Error('bed ' + k);
  out.poems[k] = { bgm: p.bgm, img: p.images };
  for (const id of p.images) { const m = M.images[id]; if (!ok(m.licence)) throw new Error('licence ' + id + ' ' + m.licence);
    out.img[id] ||= { f: A + m.file, w: m.w, h: m.h, cap: m.zh, lic: /cc0/i.test(m.licence) ? 'CC0' : '公有领域', url: m.page, focus: m.focus.map(x => +x.toFixed(4)) }; }
}
writeFileSync(root + 'data/design-poem/v134.json', JSON.stringify(out));
const imgs = new Set(Object.values(out.poems).flatMap(p => p.img)), beds = new Set(Object.values(out.poems).map(p => p.bgm));
console.log(`v134.json: ${Object.keys(out.poems).length} poems, ${imgs.size} paintings, ${beds.size} beds`);
