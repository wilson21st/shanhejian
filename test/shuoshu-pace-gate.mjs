#!/usr/bin/env node
// 说书 pace GATE (v121): fails when a clip is spoken faster than a human storyteller would, or the silences/speed changes
// around it make no sense. Measures the real mp3s (ffprobe duration of the trimmed clip), not the TTS rate setting.
//   node test/shuoshu-pace-gate.mjs [id ...]      (default: every story in data/shuoshu/stories.json)   exit 1 on any FAIL
//   --json FILE   also write every measured clip (story, who, pace, text, 字, s, 字/s) to FILE
//
// Why these numbers. One 汉字 = one syllable, so 字/s = syllables/s.
//  · Pellegrino, Coupé & Marsico 2011 ("A cross-language perspective on speech information rate", Language 87(3)) measured
//    Mandarin read speech at ≈5.2 syllables/s; careful narration and audiobooks run slower, ~4–4.5.
//  · Our own Edge narrator at its normal rate (平) reads 4.9–5.0 字/s, i.e. right on that natural rate.
//  · 评书/说书 speeds up for action, but by shortening sentences and pauses, not by gabbling: past ~6 字/s Edge's voices
//    start to clip tones and swallow syllables (Wilson's report, v120: "some lines far too fast and unnatural").
//  So: no clip ≥ 6 字 over 6.0 字/s (≈ +15% over natural), and each tier has its own ceiling below that.
// Rules (clips of ≥ MIN_N 字; shorter interjections like 「老二！」 are only held to the short-clip cap):
//  R1 tier cap      字/s ≤ CAP[pace]                 (急 6.0 · 紧 5.8 · 平 5.6 · 缓 5.3 · 慢 4.8)
//  R2 short cap     3–5 字 clips ≤ CAP[pace] + 0.7  (Edge crushes short clips: 10 字 in 0.89 s was heard)
//  R3 length        a 急 clip has ≤ 16 字 and is not a list (≥ 2 「、」): a storyteller slows down for long sentences and names
//  R4 breath        after a full sentence (ends 。！？, optionally 」) ≥ 220 ms of silence; after a clause ≥ 80 ms
//  R5 run           ≤ 4 急 clips in a row
//  R6 jump          adjacent clips (both ≥ MIN_N 字) differ by ≤ 2.0 字/s unless ≥ 500 ms of silence (or 醒木) sits between
//  R7 contrast      tier means keep 张弛: 急 > 紧 > 平 > 缓 > 慢 and tense(急+紧)/relaxed(缓+慢) between 1.15 and 1.45
import { readFileSync, writeFileSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lines } from '../gen-shuoshu-audio.mjs';
const run = promisify(execFile);
const ROOT = new URL('../data/shuoshu/', import.meta.url).pathname;
const argv = process.argv.slice(2), jsonOut = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null;
const ids = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--json');
const IDS = ids.length ? ids : JSON.parse(readFileSync(ROOT + 'stories.json')).map(s => s.id);
export const CAP = { 急: 6.0, 紧: 5.8, 平: 5.6, 缓: 5.3, 慢: 4.8 }, SHORT = 0.7, MIN_N = 6;
export const END_GAP = 220, CLAUSE_GAP = 80, MAX_RUN = 4, JUMP = 2.0, JUMP_SIL = 500, RATIO = [1.15, 1.45];
const P = ['急', '紧', '平', '缓', '慢'];
export const count = t => t.replace(/[^一-鿿0-9A-Za-z]/g, '').length;
// the page's silence after a clip (shuoshu.html clip()): its pace gap, longer after a full sentence (pace.end)
export const isEnd = t => /[。！？][」』]?$/.test(t);
export const gapAfter = (S, l) => { const pc = S.pace[l.p || '平'] || S.pace['平']; return isEnd(l.t) ? (pc.end ?? pc.gap) : pc.gap; };
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

async function durations(dir, files) {
  const out = {}, q = [...new Set(files)];
  await Promise.all(Array.from({ length: 8 }, async () => { for (let f; (f = q.pop());) {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dir + f]); out[f] = +stdout; } }));
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {   // importable for gapAfter/count without running the gate
let fails = 0; const all = [];
for (const id of IDS) {
  const S = JSON.parse(readFileSync(`${ROOT}${id}/story.json`)), I = JSON.parse(readFileSync(`${ROOT}${id}/audio/index.json`));
  const key = l => `${l.w}|${l.p || '平'}|${l.t}`;
  const L = lines(S).filter((l, i, a) => a.findIndex(x => key(x) === key(l)) === i);
  const miss = L.filter(l => !I[key(l)]); if (miss.length) { console.log(`${id}: FAIL ${miss.length} clips have no audio`); fails += miss.length; }
  const D = await durations(`${ROOT}${id}/audio/`, L.map(l => I[key(l)]).filter(Boolean));
  const M = {}; for (const l of L) { const f = I[key(l)]; if (!f) continue; const n = count(l.t), d = D[f];
    M[key(l)] = { id, w: l.w, p: l.p || '平', t: l.t, n, d: +d.toFixed(3), cps: +(n / d).toFixed(2) }; }
  all.push(...Object.values(M));
  const bad = [], F = (r, s) => bad.push(`${r} ${s}`);
  const show = m => `${m.p} ${m.w} ${m.n}字 ${m.cps}字/s「${m.t}」`;
  for (const m of Object.values(M)) {
    if (m.n >= MIN_N && m.cps > CAP[m.p]) F('R1', `${show(m)} > ${CAP[m.p]}`);
    if (m.n >= 3 && m.n < MIN_N && m.cps > CAP[m.p] + SHORT) F('R2', `${show(m)} > ${(CAP[m.p] + SHORT).toFixed(1)}`);
    if (m.p === '急' && (m.n > 16 || (m.t.match(/、/g) || []).length >= 2)) F('R3', `${show(m)} too long / a list for 急`);
  }
  // the spoken sequence: beats in order (questions/answers are interactive and start after a tap)
  const seq = S.hui.flatMap(h => h.beats.filter(b => b.t)); let runN = 0;
  seq.forEach((b, i) => {
    const p = b.p || '平'; runN = p === '急' ? runN + 1 : 0;
    if (runN === MAX_RUN + 1) F('R5', `${MAX_RUN + 1}+ 急 in a row from「${seq[i - MAX_RUN].t}」`);
    const nx = seq[i + 1]; if (!nx) return;
    const sil = gapAfter(S, b) + (nx.pre || 0) + (nx.mu ? 330 : 0);
    if (isEnd(b.t) && sil < END_GAP) F('R4', `${sil} ms after sentence「${b.t}」(${p}) < ${END_GAP}`);
    else if (!isEnd(b.t) && sil < CLAUSE_GAP) F('R4', `${sil} ms after clause「${b.t}」(${p}) < ${CLAUSE_GAP}`);
    const a = M[key(b)], c = M[key(nx)];
    if (a && c && a.n >= MIN_N && c.n >= MIN_N && Math.abs(a.cps - c.cps) > JUMP && sil < JUMP_SIL)
      F('R6', `${a.cps}→${c.cps} 字/s with ${sil} ms between「${a.t}」→「${c.t}」`);
  });
  const tm = Object.fromEntries(P.map(p => [p, mean(Object.values(M).filter(m => m.p === p && m.n >= MIN_N && m.w === 'narr').map(m => m.cps))]));
  for (let k = 1; k < P.length; k++) if (tm[P[k - 1]] && tm[P[k]] && !(tm[P[k - 1]] > tm[P[k]])) F('R7', `${P[k - 1]} ${tm[P[k - 1]].toFixed(2)} not faster than ${P[k]} ${tm[P[k]].toFixed(2)}`);
  const ratio = mean([tm['急'], tm['紧']].filter(Boolean)) / mean([tm['缓'], tm['慢']].filter(Boolean));
  if (!(ratio >= RATIO[0] && ratio <= RATIO[1])) F('R7', `tense/relaxed ${ratio.toFixed(2)} outside ${RATIO.join('–')}`);
  const vals = Object.values(M).filter(m => m.n >= MIN_N), worst = vals.reduce((a, b) => (b.cps > a.cps ? b : a), vals[0]);
  console.log(`${id}: ${Object.keys(M).length} clips · narr means ${P.map(p => `${p} ${tm[p] ? tm[p].toFixed(2) : '-'}`).join(' ')} · tense/relaxed ${ratio.toFixed(2)}x · fastest ${worst.cps} 字/s「${worst.t}」`);
  const byR = {}; for (const b of bad) byR[b.slice(0, 2)] = (byR[b.slice(0, 2)] || 0) + 1;
  if (bad.length) { console.log(`  FAIL ${bad.length}: ${Object.entries(byR).map(([r, n]) => `${r}×${n}`).join(' ')}`); for (const b of bad) console.log('   ✗ ' + b); }
  else console.log('  PASS');
  fails += bad.length;
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(all));
console.log(fails ? `FAIL: ${fails} pace violations` : `PASS: ${IDS.length} stories, ${all.length} clips within pace rules`);
process.exit(fails ? 1 : 0);
}
