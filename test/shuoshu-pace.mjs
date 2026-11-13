#!/usr/bin/env node
// 说书 v2 pacing numbers: speaking speed (chars/s, from the trimmed mp3 durations) and silence between clips, per pace.
// Silence = the page's gap after a clip (pace gap) + any `pre` before the next one + 醒木 (≈0.35 s). Narrator clips only.
//   S=<story id> node test/shuoshu-pace.mjs   (default xuanwumen). The pass/fail rules are in test/shuoshu-pace-gate.mjs (v121).
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gapAfter } from './shuoshu-pace-gate.mjs';
const D = `../data/shuoshu/${process.env.S || 'xuanwumen'}/`;
const S = JSON.parse(readFileSync(new URL(D + 'story.json', import.meta.url)));
const I = JSON.parse(readFileSync(new URL(D + 'audio/index.json', import.meta.url)));
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', new URL(D + 'audio/' + f, import.meta.url).pathname]).toString();
const P = ['急', '紧', '平', '缓', '慢'];
const st = Object.fromEntries(P.map(p => [p, { cps: [], sil: [], dur: [] }]));
const seq = S.hui.flatMap(h => h.beats.filter(b => b.t));
seq.forEach((b, i) => {
  const p = b.p || '平', f = I[`${b.w}|${p}|${b.t}`]; if (!f) return;
  const d = dur(f), n = b.t.replace(/[，。！？、；：—…「」《》\s]/g, '').length;
  st[p].dur.push(d); if (b.w === 'narr' && n >= 4) st[p].cps.push(n / d);
  const nx = seq[i + 1]; if (nx) st[p].sil.push(gapAfter(S, b) + (nx.pre || 0) + (nx.mu ? 350 : 0));
});
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = a => Math.sqrt(mean(a.map(x => (x - mean(a)) ** 2)));
const out = [];
for (const p of P) { const s = st[p]; out.push(`${p}: ${s.dur.length} clips, ${mean(s.cps).toFixed(2)} 字/s, avg clip ${mean(s.dur).toFixed(2)} s, silence after avg ${Math.round(mean(s.sil))} ms (sd ${Math.round(sd(s.sil))})`); }
const tense = [...st['急'].cps, ...st['紧'].cps], calm = [...st['缓'].cps, ...st['慢'].cps];
const ts = [...st['急'].sil, ...st['紧'].sil], cs = [...st['缓'].sil, ...st['慢'].sil];
out.push(`tense(急+紧) ${mean(tense).toFixed(2)} 字/s, silence ${Math.round(mean(ts))} ms  vs  relaxed(缓+慢) ${mean(calm).toFixed(2)} 字/s, silence ${Math.round(mean(cs))} ms`);
out.push(`speed ratio tense/relaxed ${(mean(tense) / mean(calm)).toFixed(2)}x, silence ratio relaxed/tense ${(mean(cs) / mean(ts)).toFixed(1)}x`);
const all = seq.map(b => gapAfter(S, b)); out.push(`all gaps: sd ${Math.round(sd(all))} ms (v1: one fixed 120 ms gap, sd 0)`);
console.log(out.join('\n'));
