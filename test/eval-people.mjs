#!/usr/bin/env node
// Validator for data/people.json (人物视角). No deps.  node test/eval-people.mjs
import { existsSync, readFileSync, statSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const fails = [];
const fail = (who, msg) => fails.push(`${who}: ${msg}`);

let P, steps;
try { P = JSON.parse(readFileSync(new URL('data/people.json', root), 'utf8')); }
catch (e) { console.log(`FAIL\n  people.json does not parse: ${e.message}`); process.exit(1); }
try { steps = JSON.parse(readFileSync(new URL('data/_steps.json', root), 'utf8')); }
catch (e) { console.log(`FAIL\n  _steps.json does not parse: ${e.message}`); process.exit(1); }
const stepIds = new Set(steps.map(s => s.id));

const CANTONESE = /[嘅唔喺睇咗系冇佢哋咁啲嚟㗎噉]/g;
const len = s => Array.from(String(s ?? '').replace(/\s/g, '')).length; // every visible char counts
const inBounds = ll => Array.isArray(ll) && ll.length === 2 && ll.every(Number.isFinite) &&
  ll[0] >= 60 && ll[0] <= 135 && ll[1] >= 15 && ll[1] <= 55;

// Cantonese scan over every string in the file
(function walk(v, path) {
  if (typeof v === 'string') { const m = v.replace(/墓系铭/g, '').match(CANTONESE); if (m) fail(path, `Cantonese character(s) ${[...new Set(m)].join('')} in "${v}"`); }
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
  else if (v && typeof v === 'object') for (const k in v) walk(v[k], `${path}.${k}`);
})(P, 'root');

if (!P._meta?.note || !Array.isArray(P._meta?.sources) || !P._meta.sources.length) fail('_meta', 'needs note and non-empty sources');
const people = P.people;
if (!Array.isArray(people) || people.length < 7) fail('people', `expected at least 7 people, got ${people?.length}`);
const ids = (people || []).map(p => p.id);
if (new Set(ids).size !== ids.length) fail('people', `duplicate ids: ${ids.join(',')}`);
const byId = Object.fromEntries((people || []).map(p => [p.id, p]));

for (const p of people || []) {
  const who = p.id || p.name || '?';
  if (!/^[a-z][a-z0-9_]*$/.test(p.id || '')) fail(who, 'id must be lowercase ascii');
  if (!p.name) fail(who, 'missing name');
  if (len(p.face) !== 1) fail(who, `face must be one character, got "${p.face}"`);
  if (!Number.isInteger(p.born) || !Number.isInteger(p.died) || p.died <= p.born) fail(who, `bad born/died ${p.born}/${p.died}`);

  // roles: 3–6, consecutive (next.from === prev.to), covering born→died
  const cameo = p.cameo === true; // a light person: only the stops around their crossings with a protagonist
  if (!/^#[0-9a-f]{6}$/i.test(p.c || '')) fail(who, `colour c "${p.c}" must be #rrggbb`);
  if (!p.img || !existsSync(new URL(p.img, root))) fail(who, `portrait ${p.img} missing`);
  else if (statSync(new URL(p.img, root)).size > 40000) fail(who, `portrait ${p.img} over 40 KB`);
  if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(p.imgCredit?.page || '') || !p.imgCredit?.cap) fail(who, 'imgCredit needs cap and a Wikimedia Commons page');
  const R = p.roles || [];
  if (R.length < (cameo ? 1 : 3) || R.length > 6) fail(who, `roles count ${R.length} not in 3–6`);
  R.forEach((r, i) => {
    if (!(r.from <= r.to)) fail(who, `role ${i} "${r.label}" from ${r.from} > to ${r.to}`);
    if (!r.label || len(r.label) > 8) fail(who, `role label "${r.label}" length ${len(r.label)} > 8`);
    if (i > 0 && r.from !== R[i - 1].to) fail(who, `role ${i} "${r.label}" starts ${r.from}, previous ends ${R[i - 1].to}`);
  });
  if (R.length && R[0].from !== p.born) fail(who, `roles start ${R[0].from} ≠ born ${p.born}`);
  if (R.length && R.at(-1).to !== p.died) fail(who, `roles end ${R.at(-1).to} ≠ died ${p.died}`);

  // stops
  const S = p.stops || [];
  const [smin, smax] = cameo ? [3, 10] : [8, 26];
  if (S.length < smin || S.length > smax) fail(who, `stops count ${S.length} not in ${smin}–${smax}`);
  S.forEach((s, i) => {
    const at = `${who} stop ${i} (${s.place} ${s.year})`;
    if (!Number.isInteger(s.year) || s.year < p.born || s.year > p.died) fail(at, `year outside ${p.born}..${p.died}`);
    if (i > 0 && s.year < S[i - 1].year) fail(at, `not chronological (prev ${S[i - 1].year})`);
    if (s.age !== s.year - p.born) fail(at, `age ${s.age} ≠ ${s.year - p.born}`);
    if (!s.place) fail(at, 'missing place');
    if (!inBounds(s.ll)) fail(at, `ll ${JSON.stringify(s.ll)} outside lon 60–135 / lat 15–55`);
    if (typeof s.approx !== 'boolean') fail(at, 'approx must be boolean');
    if (!s.title || len(s.title) > 10) fail(at, `title "${s.title}" length ${len(s.title)} > 10`);
    if (!s.text || len(s.text) > 36) fail(at, `text length ${len(s.text)} > 36: "${s.text}"`);
    if (!s.src) fail(at, 'missing src');
    if (s.event !== undefined && !stepIds.has(s.event)) fail(at, `event "${s.event}" not in _steps.json`);
  });
  if (S.length && S[0].year !== p.born) fail(who, `first stop ${S[0].year} is not the birth year ${p.born}`);

  // focus regions: 2–4
  const F = p.focus || [];
  if (F.length < (cameo ? 0 : 2) || F.length > 4) fail(who, `focus count ${F.length} not in 2–4`);
  F.forEach((f, i) => {
    if (!inBounds(f.ll)) fail(who, `focus ${i} ll out of bounds`);
    if (!(f.r > 0)) fail(who, `focus ${i} r must be > 0 km`);
    if (!f.label) fail(who, `focus ${i} missing label`);
  });

  // meetings (optional)
  (p.meet || []).forEach((m, i) => {
    const at = `${who} meet ${i} (${m.with} ${m.year})`;
    if (!/^[a-z][a-z0-9_]*$/.test(m.with || '')) fail(at, 'with must be ascii id');
    if (!Number.isInteger(m.year) || m.year < p.born || m.year > p.died) fail(at, 'year outside life');
    const o = byId[m.with];
    if (o && (m.year < o.born || m.year > o.died)) fail(at, `year outside ${o.name}'s life`);
    if (!inBounds(m.ll)) fail(at, 'll out of bounds');
    if (!m.text) fail(at, 'missing text');
  });
}

// crossings: the encounter graph behind 交集 (two people, or a person and a guest who has no route of their own)
const KINDS = new Set(['met', 'legend', 'near', 'saw', 'far']);
const X = P.crossings || [];
if (X.length < 20) fail('crossings', `expected at least 20, got ${X.length}`);
const xids = new Set();
const stopNear = (p, y, d) => p.stops.some(s => Math.abs(s.year - y) <= d);
X.forEach((c, i) => {
  const at = `crossing ${c.id || i}`;
  if (!/^[a-z][a-z0-9-]*$/.test(c.id || '') || xids.has(c.id)) fail(at, 'id missing, not ascii or duplicate'); xids.add(c.id);
  const A = byId[c.a], B = c.b ? byId[c.b] : null;
  if (!A) fail(at, `a "${c.a}" is not a person`);
  if (c.b && !B) fail(at, `b "${c.b}" is not a person`);
  if (!c.b && (!c.guest?.name || len(c.guest?.face) !== 1)) fail(at, 'no b, so it needs guest {name, one-char face}');
  if (c.b === c.a) fail(at, 'a and b are the same person');
  if (!KINDS.has(c.kind)) fail(at, `kind "${c.kind}" not one of ${[...KINDS].join('/')}`);
  for (const Q of [A, B]) if (Q && (c.year < Q.born || c.year > Q.died)) fail(at, `${c.year} outside ${Q.name}'s life ${Q.born}–${Q.died}`);
  if (c.kind === 'met') for (const Q of [A, B]) if (Q && !stopNear(Q, c.year, 2)) fail(at, `${Q.name} has no stop within 2 years of ${c.year}`);
  if (c.kind === 'near' && !(Array.isArray(c.years) && c.years[0] <= c.year && c.years[1] >= c.year)) fail(at, 'near needs years [from, to] around year');
  if (!c.place || !inBounds(c.ll)) fail(at, 'place / ll missing or out of bounds');
  if (!c.title || len(c.title) > 12) fail(at, `title "${c.title}" length ${len(c.title)} > 12`);
  if (len(c.text) < 30 || len(c.text) > 160) fail(at, `text length ${len(c.text)} not in 30–160`);
  if (!c.src) fail(at, 'missing src');
  if (c.film && !P._meta.films?.[c.film]) fail(at, `film "${c.film}" not in _meta.films`);
  if (c.film && !existsSync(new URL(P._meta.films[c.film].href.replace(/\?.*/, ''), root))) fail(at, `film page for ${c.film} missing`);
});
for (const p of people || []) if (!X.some(c => c.a === p.id || c.b === p.id)) fail(p.id, 'has no crossing');
// 李白 is the first protagonist Wilson asked for: every friend he named must be in his 交集 list, with the right kind
{ const mine = X.filter(c => c.a === 'libai' || c.b === 'libai'), other = c => c.a === 'libai' ? c.b : c.a;
  const want = { dufu: 'met', xuanzong: 'met', yangguifei: 'legend', hezhizhang: 'met', menghaoran: 'met', gaoshi: 'met', wangwei: 'near' };
  for (const [id, k] of Object.entries(want)) if (!mine.some(c => other(c) === id && c.kind === k)) fail('libai', `交集 lacks ${id} (${k})`);
  if (mine.filter(c => other(c) === 'dufu').length < 3) fail('libai', '李杜 needs at least 3 crossings');
  if (!mine.some(c => c.film)) fail('libai', 'no crossing carries a film'); }

if (fails.length) { console.log(`FAIL (${fails.length})`); for (const f of fails) console.log('  ' + f); process.exit(1); }
const n = people.reduce((a, p) => a + p.stops.length, 0);
console.log(`PASS — ${people.length} people, ${n} stops, ${X.length} crossings (${X.filter(c => c.kind === 'met').length} met), ${people.flatMap(p => p.stops).filter(s => s.event).length} linked events`);
