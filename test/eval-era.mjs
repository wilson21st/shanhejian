#!/usr/bin/env node
// Validator for data/era.json and for candidate additions (same shape: { places:{}, events:[] }). Zero dependencies.
//
//   node test/eval-era.mjs                         # data/era.json alone
//   node test/eval-era.mjs data/era-add-1.json …   # era.json plus additions, checked as if merged
//
// Checks every event in the files named on the command line (or all of era.json when none are named):
//   id        unique across era.json, the additions, poems.json and world.json; matches /^s\d{3}[a-z]*$/
//   date      YYYY | YYYY-MM | YYYY-MM-DD within 0581-03-04 … 0763-02-17; prec matches its precision;
//             endDate (optional) is a valid date not before date
//   place     an id in the merged places (era + additions + poems + world), with ll [lon,lat] in lon 60–135, lat 10–55
//   kind      pol | gov | dip | mil | cul | nat
//   text      title ≤ 18 汉字; summary 60–200 汉字; why 20–80 汉字; who 1–10 names; importance 1–3; debate optional
//   evidence  3–7 items; type in text|archaeology|inscription|artifact|art|foreign|modern; stance in supports|
//             complicates|contradicts; confidence in high|medium|low; title, detail (≥ 20 汉字), cite and url (http) present;
//             at least one item is type text; at least one is not supports (every event shows a doubt or a tension)
//   script    simplified Chinese outside `quote` and `url` (both keep their source's script): none of the traditional-only
//             characters in TRAD below
//   duplicate no addition shares a title, or the same year + place, with an existing event
import { readFileSync } from 'node:fs';
const ROOT = new URL('..', import.meta.url).pathname;
const read = f => JSON.parse(readFileSync(f.startsWith('/') ? f : ROOT + f, 'utf8'));
const HAN = /\p{Script=Han}/gu, han = s => (String(s ?? '').match(HAN) || []).length;
const TRAD = [...'國軍陳戰東與為壽擊圍鄉龍門長書會學點經說張開關問題實發體團變邊過還這頭種當對興義華與歲歷誌']; // traditional-only forms
const KINDS = new Set(['pol', 'gov', 'dip', 'mil', 'cul', 'nat']);
const TYPES = new Set(['text', 'archaeology', 'inscription', 'artifact', 'art', 'foreign', 'modern']);
const STANCE = new Set(['supports', 'complicates', 'contradicts']), CONF = new Set(['high', 'medium', 'low']);
const DATE = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/;

const era = read('data/era.json'), poems = read('data/poems.json'), world = read('data/world.json');
const adds = process.argv.slice(2).map(f => ({ f, d: read(f) }));
const places = { ...poems.places, ...era.places, ...world.places };
for (const a of adds) Object.assign(places, a.d.places || {});
const errs = [], err = (w, m) => errs.push(`${w}: ${m}`);

const seen = new Map();
for (const e of [...era.events, ...poems.events]) seen.set(e.id, 'base');
for (const e of world.events || []) seen.set(e.id, 'world');
const baseKeys = new Set(era.events.map(e => e.title)), baseYP = new Set(era.events.map(e => e.date.slice(0, 4) + '|' + e.place));

const check = (e, where, isAdd) => {
  const W = `${where} ${e.id || '?'}`;
  if (!/^s\d{3}[a-z]*$/.test(e.id || '')) err(W, 'id must look like s605 / s605b');
  if (isAdd) { if (seen.has(e.id)) err(W, 'id already used'); seen.set(e.id, where); }
  const m = DATE.exec(e.date || '');
  if (!m) err(W, `bad date ${e.date}`);
  else {
    if (e.date < '0581-03-04' || e.date.slice(0, 4) > '0763') err(W, `date ${e.date} outside 581–763`);
    const p = m[3] ? 'day' : m[2] ? 'month' : 'year';
    if (e.prec !== p) err(W, `prec ${e.prec} but date precision is ${p}`);
  }
  if (e.endDate !== undefined && (!DATE.test(e.endDate) || e.endDate < e.date.slice(0, e.endDate.length))) err(W, `bad endDate ${e.endDate}`);
  const pl = places[e.place];
  if (!pl) err(W, `place ${e.place} not defined`);
  else if (!Array.isArray(pl.ll) || pl.ll[0] < 60 || pl.ll[0] > 135 || pl.ll[1] < 10 || pl.ll[1] > 55) err(W, `place ${e.place} ll out of range`);
  if (!KINDS.has(e.kind)) err(W, `kind ${e.kind}`);
  if (han(e.title) < 2 || han(e.title) > 18) err(W, `title ${han(e.title)} 汉字 (2–18)`);
  if (han(e.summary) < 60 || han(e.summary) > 200) err(W, `summary ${han(e.summary)} 汉字 (60–200)`);
  if (han(e.why) < 20 || han(e.why) > 80) err(W, `why ${han(e.why)} 汉字 (20–80)`);
  if (!Array.isArray(e.who) || e.who.length < 1 || e.who.length > 10) err(W, 'who: 1–10 names');
  if (![1, 2, 3].includes(e.importance)) err(W, 'importance 1–3');
  const ev = e.evidence || [];
  if (ev.length < 3 || ev.length > 7) err(W, `evidence ${ev.length} (3–7)`);
  ev.forEach((v, i) => {
    const V = `${W} evidence[${i}]`;
    if (!TYPES.has(v.type)) err(V, `type ${v.type}`);
    if (!STANCE.has(v.stance)) err(V, `stance ${v.stance}`);
    if (!CONF.has(v.confidence)) err(V, `confidence ${v.confidence}`);
    if (!v.title) err(V, 'title missing');
    if (han(v.detail) < 20) err(V, 'detail < 20 汉字');
    if (!v.cite) err(V, 'cite missing');
    if (!/^https?:\/\//.test(v.url || '')) err(V, 'url missing');
  });
  if (!ev.some(v => v.type === 'text')) err(W, 'no text (史书) evidence');
  if (ev.length && ev.every(v => v.stance === 'supports')) err(W, 'every item supports — show at least one doubt or tension');
  // quotes, urls (wikisource titles), image file names and 《book titles》 keep their own script
  const prose = JSON.stringify({ ...e, evidence: ev.map(({ quote, url, imageHint, ...v }) => v) }).replace(/《[^》]*》/g, '');
  const bad = TRAD.filter(c => prose.includes(c));
  if (bad.length) err(W, `traditional characters outside quotes: ${bad.join('')}`);
  if (isAdd) {
    if (baseKeys.has(e.title)) err(W, 'same title as an existing event');
    if (baseYP.has(e.date.slice(0, 4) + '|' + e.place)) err(W, `an existing event already sits at ${e.place} in ${e.date.slice(0, 4)} — merge or justify with a distinct place`);
  }
};

if (!adds.length) era.events.forEach(e => check(e, 'era.json', false));
for (const a of adds) {
  if (!Array.isArray(a.d.events)) { err(a.f, 'events is not an array'); continue; }
  for (const [id, p] of Object.entries(a.d.places || {})) if (!p.name || !Array.isArray(p.ll)) err(`${a.f} place ${id}`, 'needs name and ll');
  a.d.events.forEach(e => check(e, a.f, true));
}
const n = adds.length ? adds.reduce((s, a) => s + (a.d.events || []).length, 0) : era.events.length;
if (errs.length) { console.log(`FAIL (${errs.length})\n  ` + errs.slice(0, 60).join('\n  ')); process.exit(1); }
console.log(`PASS (${n} events${adds.length ? ' added' : ''})`);
