#!/usr/bin/env node
// 吟诗 mock: poems.mjs → data/design-poem/<id>.json, list.json, and tools/design-poem/glyphs.txt (for the brush-font subset).
// Checks each poem's text against data/poems.json and that every @slide has an image in data/design-poem/img/.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { poems, voices } from './poems.mjs';
import { PACE, clip, shown } from './dsl.mjs';
const root = new URL('../../', import.meta.url).pathname, D = root + 'data/design-poem/';
const credits = JSON.parse(readFileSync(D + 'credits.json'));
const src = Object.fromEntries(JSON.parse(readFileSync(root + 'data/poems.json')).events.map(e => [e.id, e]));
const errs = [], list = [];
const slide = id => { const c = credits.find(x => x.id === id); if (!c) { errs.push('no image ' + id); return null; }
  return { type: 'img', src: c.file, cap: c.cap, lic: c.licence }; };
for (const p of poems) {
  const ref = src[p.pid].poem.text.join('').replace(/[，。？！]/g, ''), mine = p.text.map(shown).join('');
  if (ref !== mine) errs.push(`${p.id}: text differs from poems.json\n  ${ref}\n  ${mine}`);
  const yin = p.text.map((t, i) => ({ ...clip(`yin ${i % 2 ? '缓' : '平'}|${t}`), line: i }));
  const words = p.words.map(w => { if (shown(p.text[w.line])[w.pos] !== w.ch) errs.push(`${p.id}: word ${w.ch} not at ${w.line}:${w.pos}`); return { ...w, a: clip('缓|' + w.t) }; });
  const used = new Set([p.cover, p.bg, p.yinSlide]);
  const scan = a => a.forEach(c => c.s && used.add(c.s));
  [p.intro, p.guess.reveal, p.yinIntro, p.debate.reveal, p.outro, ...p.guess.choices.map(c => c.react), ...p.debate.choices.map(c => c.react)].forEach(scan);
  const slides = {}; for (const id of used) slides[id] = slide(id);
  const out = { ...p, text: p.text.map(shown), yin, words, slides, voices, pace: PACE,
    guess: { ...p.guess, q: clip('平|' + p.guess.t) }, debate: { ...p.debate, q: clip('平|' + p.debate.t) } };
  writeFileSync(D + p.id + '.json', JSON.stringify(out));
  list.push({ id: p.id, title: p.title, poet: p.poet, year: p.year, form: p.form, hook: p.hook, cover: slides[p.cover]?.src, first: shown(p.text[0]) });
}
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
writeFileSync(D + 'list.json', JSON.stringify(list, null, 1));
// glyphs the brush font must carry: poem text, titles, poets, seals, the few UI words drawn in it
const g = new Set([...poems.flatMap(p => [...p.text.map(shown), p.title, p.poet, ...p.debate.books.flatMap(b => [b.q, b.gist])]).join(''), ...'吟诗印再一遍原文出处你信哪个白云黄鹤尽住人哭花' + '马善政楷志莽行书刘建毛草龙藏体霞鹜文字'].filter(c => c.trim()));
writeFileSync(new URL('./glyphs.txt', import.meta.url), [...g].sort().join(''));
console.log('built', poems.length, 'poems;', g.size, 'brush glyphs');
