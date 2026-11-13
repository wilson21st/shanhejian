import pc from 'polygon-clipping';
import { readFileSync } from 'node:fs';
const RM = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const dn = d => d.split('-').map(Number).reduce((a, v, i) => a + v * [1e4, 100, 1][i], 0);
const act = d => RM.pieces.filter(p => dn(p.from) <= dn(d) && (!p.to || dn(d) < dn(p.to)));
const area = mp => mp.reduce((s, poly) => s + poly.reduce((t, r, i) => { let a = 0; for (let k = 0; k < r.length - 1; k++) a += r[k][0] * r[k + 1][1] - r[k + 1][0] * r[k][1]; return t + (i ? -1 : 1) * Math.abs(a / 2) }, 0), 0);
const P = p => [[...p.poly, p.poly[0]]];
let bad = 0; const verbose = process.argv.includes('-v');
const dates = new Set(); for (let y = 581; y <= 763; y++) dates.add(`${y}-07-01`); for (const p of RM.pieces) { dates.add(p.from); }
const ds = [...dates].filter(d => dn(d) >= dn('581-01-01') && dn(d) <= dn('763-12-31')).sort((a, b) => dn(a) - dn(b));
for (const d of ds) {
  const a = act(d), names = [...new Set(a.map(p => p.realm))];
  const main = a.filter(p => ['zhou', 'sui', 'tang'].includes(p.realm) && p.status === 'core' && !p.overlay);
  if (!main.length) { console.log('NO MAIN DYNASTY', d); bad++ }
  for (const ov of [false, true]) {
    const L = a.filter(p => !!p.overlay === ov);
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const x = area(pc.intersection(P(L[i]), P(L[j])));
      if (x > 0.5) { console.log('OVERLAP', d, ov ? 'ov' : 'base', L[i].realm, L[i].from, L[j].realm, L[j].from, x.toFixed(2)); bad++ }
    }
  }
  if (verbose || d.endsWith('-07-01')) console.log(d, a.filter(p => p.label).map(p => p.label[0].replace(/　/g, '')).join(' | '));
}
console.log(bad ? `FAIL ${bad}` : 'OK', ds.length, 'dates checked');
