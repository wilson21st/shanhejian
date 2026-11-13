#!/usr/bin/env node
// Automatic metrics for data/world.json. Hard checks fail the run; soft ones are reported.
// node eval.mjs [--json]
import { readFileSync } from 'node:fs';

const W = JSON.parse(readFileSync(new URL('./data/world.json', import.meta.url)));
const raw = f => readFileSync(new URL(`./data/raw/${f}`, import.meta.url), 'utf8').replace(/<BR>/g, '').replace(/\s+/g, '');
const rawOf = id => [W.sources[id]?.raw].flat().filter(Boolean).map(raw).join('');

const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCH = '子丑寅卯辰巳午未申酉戌亥';
const gzIndex = gz => { for (let i = 0; i < 60; i++) if (STEMS[i % 10] + BRANCH[i % 12] === gz) return i; return -1; };
const day = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5; // proleptic; only differences matter
const span = e => { // [start, end] in days, by precision
  const y = +e.date.slice(0, 4), m = +(e.date.slice(5, 7) || 1);
  if (e.prec === 'year') return [Date.UTC(y, 0, 1) / 864e5, Date.UTC(y + 1, 0, 0) / 864e5];
  if (e.prec === 'month') return [Date.UTC(y, m - 1, 1) / 864e5, Date.UTC(y, m, 0) / 864e5];
  const d = day(e.date); return [d, d];
};

const out = [], fails = [];
const metric = (id, name, value, target, hard, detail = []) => {
  const ok = value >= target;
  out.push({ id, name, value: +value.toFixed(3), target, ok, hard, detail });
  if (hard && !ok) fails.push(id);
};

// M1 quote verification: every quoted claim must appear verbatim in its source text
const quoted = W.claims.filter(c => c.quote && W.sources[c.src]?.raw);
const badQ = quoted.filter(c => !rawOf(c.src).includes(c.quote.replace(/\s+/g, '')));
metric('M1', '引文逐字核对率', 1 - badQ.length / quoted.length, 1, true, badQ.map(c => `${c.id}: ${c.quote}`));

// M2 provenance coverage: claims with a known source + locator; relations and events backed by ≥1 claim
const cl = Object.fromEntries(W.claims.map(c => [c.id, c]));
const unsourced = W.claims.filter(c => !W.sources[c.src] || !c.loc);
metric('M2a', '说法有出处', 1 - unsourced.length / W.claims.length, 1, true, unsourced.map(c => c.id));
const relNo = W.relations.filter(r => !(r.claims || []).some(id => cl[id]));
metric('M2b', '关系边有出处', 1 - relNo.length / W.relations.length, 1, true, relNo.map(r => `${r.a}-${r.b}`));
const evNo = W.events.filter(e => !W.claims.some(c => c.ev === e.id));
metric('M2c', '事件有至少一条说法', 1 - evNo.length / W.events.length, 0.9, false, evNo.map(e => e.id));
const verifiable = W.claims.filter(c => c.quote && W.sources[c.src]?.raw).length;
metric('M2d', '可逐字核对的说法占比', verifiable / W.claims.length, 0.6, false,
  W.claims.filter(c => !(c.quote && W.sources[c.src]?.raw)).map(c => `${c.id} (${W.sources[c.src]?.name})`));

// M3 sexagenary-day consistency against the anchor (庚申 = 626-07-02)
const a = W.meta.anchor, a0 = day(a.date), ai = gzIndex(a.gz);
const gzEv = W.events.filter(e => e.gz);
const badGz = gzEv.filter(e => (((ai + day(e.date) - a0) % 60) + 60) % 60 !== gzIndex(e.gz));
metric('M3', '干支日期一致', 1 - badGz.length / gzEv.length, 1, true, badGz.map(e => `${e.id} ${e.gz} ${e.date}`));

// M4 omission checks: a claim that a source never mentions X must hold in the text
const abs = W.claims.filter(c => c.absent);
const badAbs = abs.filter(c => rawOf(c.src).includes(c.absent));
metric('M4', '「沉默」核对', abs.length ? 1 - badAbs.length / abs.length : 1, 1, true, badAbs.map(c => c.id));

// M5 conflicts resolve and are mutual
const badC = W.claims.flatMap(c => (c.conflicts || []).filter(o => !cl[o] || !(cl[o].conflicts || []).includes(c.id)).map(o => `${c.id}→${o}`));
metric('M5', '冲突对称', badC.length ? 0 : 1, 1, true, badC);

// M6 contested events carry ≥2 lenses
const contested = W.events.filter(e => e.contested);
const thin = contested.filter(e => new Set(W.claims.filter(c => c.ev === e.id).map(c => c.lens)).size < 2);
metric('M6', '争议事件有 ≥2 个 lens', 1 - thin.length / contested.length, 1, true, thin.map(e => e.id));

// M7 independent witnesses: for each contested zhengshi claim set, how many root sources really stand behind it
const roots = (id, seen = new Set()) => {
  const s = W.sources[id]; if (!s || seen.has(id)) return []; seen.add(id);
  return s.derivedFrom.length ? s.derivedFrom.flatMap(p => roots(p, seen)) : [id];
};
const witness = contested.map(e => {
  const srcs = [...new Set(W.claims.filter(c => c.ev === e.id && c.lens === 'zhengshi').map(c => c.src))];
  const rs = [...new Set(srcs.flatMap(s => roots(s)))];
  return { ev: e.id, title: e.title, books: srcs.map(s => W.sources[s].name), roots: rs.map(r => W.sources[r].name) };
}).filter(w => w.books.length);
const inflated = witness.filter(w => w.books.length > w.roots.length);
metric('M7', '「多书一源」被识破的争议点', inflated.length, 1, false, witness.map(w => `${w.ev} ${w.title}: ${w.books.length} 本书 → ${w.roots.length} 个源头 (${w.roots.join('、')})`));

// M8 synchrony: for the day of the coup, how many events elsewhere fall within ±45 days
const focus = W.events.filter(e => e.date === a.date);
const [f0] = span(focus[0]);
const others = W.events.filter(e => {
  if (W.places[e.place].view === 'palace') return false;
  const [s, t] = span(e); return t >= f0 - 45 && s <= f0 + 45;
});
const placesN = new Set(others.map(e => e.place)).size;
metric('M8', '政变前后 ±45 日别处事件（地点数）', placesN, 4, false, others.map(e => `${e.date} ${W.places[e.place].name}: ${e.title}`));

// M9 every event carries one of the defined categories (kinds)
const badK = W.events.filter(e => !W.kinds?.[e.kind]);
metric('M9', '事件分类有定义', 1 - badK.length / W.events.length, 1, true, badK.map(e => `${e.id} ${e.kind}`));

// M10 疆域 pieces: known realms and patrons, from < to, polygons with ≥3 points
const RM = JSON.parse(readFileSync(new URL('./data/realms.json', import.meta.url), 'utf8'));
const dn = d => d ? d.split('-').map(Number).reduce((a, v, i) => a + v * [1e4, 100, 1][i], 0) : Infinity;
const badR = RM.pieces.filter(p => !RM.realms[p.realm] || [].concat(p.of || []).some(r => !RM.realms[r])
  || !(dn(p.from) < dn(p.to)) || !(p.poly?.length >= 3) || (p.status === 'contested' && [].concat(p.of || []).length !== 2));
// …and every year 581–763 has the main dynasty (北周/隋/唐) as a core base piece on 1 July
const noMain = [];
for (let y = 581; y <= 763; y++) { const n = y * 1e4 + 701; if (!RM.pieces.some(p => ['zhou', 'sui', 'tang'].includes(p.realm) && p.status === 'core' && !p.overlay && dn(p.from) <= n && n < dn(p.to))) noMain.push(`${y}: 无主朝`) }
metric('M10', '疆域数据有效', 1 - (badR.length + noMain.length) / (RM.pieces.length + 183), 1, true, [...badR.map(p => `${p.realm} ${p.from}`), ...noMain]);

if (process.argv.includes('--json')) console.log(JSON.stringify({ metrics: out, fails }, null, 2));
else {
  for (const m of out) {
    console.log(`${m.ok ? '✓' : m.hard ? '✗' : '·'} ${m.id} ${m.name}: ${m.value} (目标 ≥${m.target}${m.hard ? '，硬性' : ''})`);
    for (const d of m.detail.slice(0, 12)) console.log(`    ${d}`);
  }
  console.log(`\n${W.events.length} 事件 · ${W.claims.length} 说法 · ${W.relations.length} 关系 · ${Object.keys(W.people).length} 人 · ${Object.keys(W.sources).length} 史源`);
  console.log(fails.length ? `FAIL: ${fails.join(', ')}` : 'PASS');
}
process.exit(fails.length ? 1 : 0);
