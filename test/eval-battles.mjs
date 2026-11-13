#!/usr/bin/env node
// 战役双方 validator for data/battles.json. Zero dependencies.
//
//   node test/eval-battles.mjs          # exits 0 on PASS, 1 on FAIL
//
// Checks:
//   parse       battles.json parses; has meta and a battles object
//   coverage    all 25 military event ids present (and each is kind "mil" in era.json)
//   at          is a place id in era.json or poems.json places (睢阳 lives in poems.json)
//   type        foreign | civil | rebellion | conquest;  confidence high | medium | low
//   sides       2–3 sides; each has name, realm, leaders[], from{name, ll}, role, result
//   role/result attacker | defender;  胜 | 败 | 退 | 和
//   ll          every from.ll and route point is [lon, lat] with lon 60–135, lat 15–55; route ≤ 3 points
//   line        non-empty, ≤ 40 characters
//   sources     non-empty array of non-empty strings
//   simplified  none of 國軍陳戰東與為壽擊圍鄉龍門長書 anywhere in the file
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const IDS = ['s589', 's612', 's615', 's617', 's621', 's630', 's645', 's663', 's668', 's682', 's751', 's755', 's757', 's763',
  's613', 's617b', 's635', 's640', 's657', 's660', 's670', 's684', 's696', 's749', 's757b'];
const TYPES = ['foreign', 'civil', 'rebellion', 'conquest'];
const ROLES = ['attacker', 'defender'];
const RESULTS = ['胜', '败', '退', '和'];
const CONF = ['high', 'medium', 'low'];
const TRAD = [...'國軍陳戰東與為壽擊圍鄉龍門長書'];

const errs = [];
const err = (where, msg) => errs.push(`${where}: ${msg}`);
const fail = msg => { console.log(`FAIL\n  ${msg}`); process.exit(1); };

let raw, data, era;
try { raw = readFileSync(ROOT + 'data/battles.json', 'utf8'); data = JSON.parse(raw); }
catch (e) { fail(`parse: data/battles.json — ${e.message}`); }
try { era = JSON.parse(readFileSync(ROOT + 'data/era.json', 'utf8')); }
catch (e) { fail(`parse: data/era.json — ${e.message}`); }

if (!data.meta || typeof data.meta.note !== 'string') err('meta', 'missing meta.note');
const B = data.battles;
if (!B || typeof B !== 'object' || Array.isArray(B)) fail('parse: battles is not an object');

let poems = {};
try { poems = JSON.parse(readFileSync(ROOT + 'data/poems.json', 'utf8')); } catch (e) {}
const places = { ...(poems.places || {}), ...(era.places || {}) };
const kindOf = new Map((era.events || []).map(e => [e.id, e.kind]));

const okLL = p => Array.isArray(p) && p.length === 2 && p.every(n => typeof n === 'number' && Number.isFinite(n))
  && p[0] >= 60 && p[0] <= 135 && p[1] >= 15 && p[1] <= 55;
const nonEmpty = s => typeof s === 'string' && s.trim().length > 0;

for (const id of IDS) if (!B[id]) err('coverage', `${id} missing`);
for (const id of Object.keys(B)) {
  if (!IDS.includes(id)) err('coverage', `unexpected id ${id}`);
  else if (kindOf.get(id) !== 'mil') err('coverage', `${id} is not a kind "mil" event in era.json`);
}

for (const id of IDS) {
  const b = B[id];
  if (!b) continue;
  if (!places[b.at]) err(id, `at "${b.at}" is not a place id in era.json or poems.json`);
  if (!TYPES.includes(b.type)) err(id, `type "${b.type}" not in ${TYPES.join('|')}`);
  if (!CONF.includes(b.confidence)) err(id, `confidence "${b.confidence}" not in ${CONF.join('|')}`);

  const sides = b.sides;
  if (!Array.isArray(sides) || sides.length < 2 || sides.length > 3) err(id, `must have 2–3 sides (has ${sides?.length ?? 0})`);
  else sides.forEach((s, k) => {
    const w = `${id}.sides[${k}]`;
    if (!nonEmpty(s.name)) err(w, 'name missing');
    if (!nonEmpty(s.realm)) err(w, 'realm missing');
    if (!Array.isArray(s.leaders) || !s.leaders.length) err(w, 'leaders empty');
    if (!s.from || !nonEmpty(s.from.name)) err(w, 'from.name missing');
    if (!okLL(s.from?.ll)) err(w, `from.ll ${JSON.stringify(s.from?.ll)} is not [lon 60–135, lat 15–55]`);
    if (s.route != null) {
      if (!Array.isArray(s.route) || s.route.length > 3) err(w, 'route must be an array of 0–3 points');
      else s.route.forEach((p, j) => { if (!okLL(p)) err(w, `route[${j}] ${JSON.stringify(p)} is not [lon 60–135, lat 15–55]`); });
    }
    if (s.strength != null && !nonEmpty(s.strength)) err(w, 'strength present but empty');
    if (!ROLES.includes(s.role)) err(w, `role "${s.role}" not in ${ROLES.join('|')}`);
    if (!RESULTS.includes(s.result)) err(w, `result "${s.result}" not in ${RESULTS.join('|')}`);
  });

  const len = [...String(b.line ?? '')].length;
  if (!nonEmpty(b.line)) err(id, 'line missing');
  else if (len > 40) err(id, `line has ${len} chars (> 40)`);

  if (!Array.isArray(b.sources) || !b.sources.length || !b.sources.every(nonEmpty)) err(id, 'sources must be a non-empty array of strings');
}

for (const ch of TRAD) {
  const at = raw.indexOf(ch);
  if (at >= 0) err('simplified', `traditional 「${ch}」 near 「${raw.slice(Math.max(0, at - 8), at + 8).replace(/\s+/g, ' ')}」`);
}

const present = IDS.filter(id => B[id]).length;
const summary = `${present}/${IDS.length} battles`;
if (errs.length) { console.log(`FAIL (${summary})`); for (const e of errs) console.log('  ' + e); process.exit(1); }
console.log(`PASS (${summary})`);
