#!/usr/bin/env node
// 章回 validator for data/huimu.json. Zero dependencies.
//
//   node test/eval-huimu.mjs            # exits 0 on PASS, 1 on FAIL
//
// Checks:
//   parse       huimu.json and _steps.json parse; hui is a non-empty array, n runs 1..N
//   coverage    every step id in data/_steps.json appears exactly once, and in timeline order
//   title       two halves, each 6–8 汉字
//   hook        ends with ？, ≤ 30 汉字
//   narr        2–3 items; first starts with 话说/却说/且说/再说; each ≤ 60 汉字
//   cliff       ≤ 30 汉字, not counting 「欲知后事如何，且听下回分解。」
//   causes      ≤ 2; from/to are real step ids; from is earlier than to; to is in this 回; note ≤ 20 汉字
//   elsewhere   ≤ 2 items, each ≤ 30 汉字;  fubi ≤ 24 汉字;  src non-empty
//   cantonese   none of 嘅唔喺睇咗系冇佢哋咁啲嚟㗎噉 anywhere in the file
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const HAN = /\p{Script=Han}/gu;
const han = s => (String(s ?? '').match(HAN) || []).length;
const CANTO = [...'嘅唔喺睇咗系冇佢哋咁啲嚟㗎噉'];
const OPENERS = ['话说', '却说', '且说', '再说'];
const TAIL = /欲知后事如何[，,]?\s*且听下回分解[。.]?/g;

const errs = [];
const err = (where, msg) => errs.push(`${where}: ${msg}`);

let steps, raw, data;
try { steps = JSON.parse(readFileSync(ROOT + 'data/_steps.json', 'utf8')); }
catch (e) { console.log(`FAIL\n  parse: data/_steps.json — ${e.message}`); process.exit(1); }
try { raw = readFileSync(ROOT + 'data/huimu.json', 'utf8'); data = JSON.parse(raw); }
catch (e) { console.log(`FAIL\n  parse: data/huimu.json — ${e.message}`); process.exit(1); }

const order = steps.map(s => s.id);
const pos = new Map(order.map((id, i) => [id, i]));
const hui = data.hui;
if (!Array.isArray(hui) || !hui.length) { console.log('FAIL\n  parse: hui is not a non-empty array'); process.exit(1); }
if (!data._meta || !Array.isArray(data._meta.sources)) err('_meta', 'missing _meta.sources');

// coverage + order
const seen = new Map();
const flat = [];
hui.forEach((h, i) => {
  const w = `回${h.n ?? '?'}`;
  if (h.n !== i + 1) err(w, `n should be ${i + 1}`);
  if (!Array.isArray(h.steps) || !h.steps.length) { err(w, 'steps empty'); return; }
  for (const id of h.steps) {
    if (!pos.has(id)) err(w, `unknown step id ${id}`);
    if (seen.has(id)) err(w, `step ${id} already used in 回${seen.get(id)}`);
    seen.set(id, h.n);
    flat.push(id);
  }
});
for (const id of order) if (!seen.has(id)) err('coverage', `step ${id} not in any 回`);
for (let i = 1; i < flat.length; i++)
  if (pos.has(flat[i]) && pos.has(flat[i - 1]) && pos.get(flat[i]) <= pos.get(flat[i - 1]))
    err('order', `${flat[i]} comes after ${flat[i - 1]} but is earlier in the timeline`);

// per-回 checks
for (const h of hui) {
  const w = `回${h.n}`;
  if (!Array.isArray(h.title) || h.title.length !== 2) err(w, 'title must be two halves');
  else h.title.forEach((t, k) => { const c = han(t); if (c < 6 || c > 8) err(w, `title[${k}] 「${t}」 has ${c} 汉字 (6–8)`); });

  if (typeof h.hook !== 'string' || !h.hook.endsWith('？')) err(w, `hook must end with ？`);
  if (han(h.hook) > 30) err(w, `hook has ${han(h.hook)} 汉字 (> 30)`);

  if (!Array.isArray(h.narr) || h.narr.length < 2 || h.narr.length > 3) err(w, `narr must have 2–3 items`);
  else {
    if (!OPENERS.some(o => h.narr[0].startsWith(o))) err(w, `narr[0] must start with ${OPENERS.join('/')}`);
    h.narr.forEach((s, k) => { const c = han(s); if (c > 60) err(w, `narr[${k}] has ${c} 汉字 (> 60)`); });
  }

  if (typeof h.cliff !== 'string' || !h.cliff) err(w, 'cliff missing');
  else { const c = han(h.cliff.replace(TAIL, '')); if (c > 30) err(w, `cliff has ${c} 汉字 (> 30)`); }

  const causes = h.causes ?? [];
  if (!Array.isArray(causes) || causes.length > 2) err(w, 'causes must be an array of 0–2');
  else for (const c of causes) {
    if (!pos.has(c.from)) err(w, `cause from unknown id ${c.from}`);
    if (!pos.has(c.to)) err(w, `cause to unknown id ${c.to}`);
    if (pos.has(c.from) && pos.has(c.to) && pos.get(c.from) >= pos.get(c.to)) err(w, `cause ${c.from}→${c.to}: from is not earlier`);
    if (!h.steps.includes(c.to)) err(w, `cause to ${c.to} is not in this 回`);
    if (h.steps.includes(c.from)) err(w, `cause from ${c.from} should be an earlier 回's step`);
    if (han(c.note) > 20 || !c.note) err(w, `cause note 「${c.note}」 has ${han(c.note)} 汉字 (1–20)`);
  }

  const els = h.elsewhere ?? [];
  if (!Array.isArray(els) || els.length > 2) err(w, 'elsewhere must be an array of 0–2');
  else els.forEach((e, k) => { if (han(e) > 30) err(w, `elsewhere[${k}] has ${han(e)} 汉字 (> 30)`); });

  if (h.fubi != null && han(h.fubi) > 24) err(w, `fubi has ${han(h.fubi)} 汉字 (> 24)`);
  if (!Array.isArray(h.src) || !h.src.length) err(w, 'src missing');
}

// Cantonese characters anywhere
for (const ch of CANTO) {
  const at = raw.indexOf(ch);
  if (at >= 0) err('cantonese', `「${ch}」 near 「${raw.slice(Math.max(0, at - 8), at + 8).replace(/\s+/g, ' ')}」`);
}

const summary = `${hui.length} 回, ${flat.length}/${order.length} steps`;
if (errs.length) { console.log(`FAIL (${summary})`); for (const e of errs) console.log('  ' + e); process.exit(1); }
console.log(`PASS (${summary})`);
