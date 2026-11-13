#!/usr/bin/env node
// Pre-render every spoken clip of a 说书 story (data/shuoshu/<id>/story.json) → data/shuoshu/<id>/audio/<hash>.mp3 plus
// audio/index.json mapping "who|pace|text" → file. The page only knows that index, so the TTS engine is replaceable:
// each role's voice config in story.json is { engine, voice, rate, pitch }; the engine is tools/shuoshu/tts/<engine>.mjs.
// The file hash covers the text AND the role's voice config, so changing a voice re-renders only that role's clips.
// Pace: rate = role rate + (pace rate − 平's rate) so 急 runs ~+30% faster than the role's normal and 慢 ~−20% slower;
// pitch nudges up when tense, down when slow. Pauses/醒木 are played by the page.
// Speed ceiling (v121): Edge speeds up short and high-rate clips beyond what the rate says (10 字 came out in 0.89 s), so
// every clip is measured after rendering; one faster than its pace's `max` 字/s (3–5 字 clips: max + 0.7) is re-rendered at
// a proportionally lower rate, up to 3 times. audio/rates.json remembers per file the rate asked for, the rate used and the
// duration, so a pace-table change re-renders only the clips it touches.
//   node gen-shuoshu-audio.mjs <id ...|all> [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, readdirSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const force = process.argv.includes('--force');
const root = new URL('./data/shuoshu/', import.meta.url).pathname;
const ids = !args.length || args[0] === 'all' ? JSON.parse(readFileSync(root + 'stories.json')).map(s => s.id) : args;
const PITCH = { 急: 3, 紧: 1, 平: 0, 缓: -1, 慢: -3 };
export const count = t => t.replace(/[^\u4e00-\u9fff0-9A-Za-z]/g, '').length;
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString();
const num = s => parseInt(s || '0', 10);
const sign = n => (n >= 0 ? '+' : '') + n;
const engines = {};
const engine = async n => engines[n] ||= await import(`./tools/shuoshu/tts/${n}.mjs`);
// every clip a story can speak: beats, question text, reactions, reveals, 问说书人 answers
export function lines(S) {
  const out = [], L = x => { if (x && x.w && x.t) out.push({ w: x.w, p: x.p || '平', t: x.t }); };
  for (const h of S.hui) {
    for (const b of h.beats) { L(b); if (b.q) { L({ w: 'narr', t: b.q.t }); b.q.choices.forEach(c => c.react.forEach(L)); b.q.reveal.forEach(L); } }
    for (const a of h.ask) a.a.forEach(L);
  }
  return out;
}
export const fileFor = (S, l) => { const v = S.voices[l.w] || S.voices.narr;
  return createHash('sha1').update(`${l.w}|${l.p}|${l.t}|${v.engine || 'edge'}|${v.voice}|${v.rate || ''}|${v.pitch || ''}`).digest('hex').slice(0, 12) + '.mp3'; };
// engines pad clips with silence; cut it so the page's per-pace gaps are the only pauses (急 needs ~40 ms)
function trim(f) {
  const t = f + '.trim.mp3';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.06,areverse', '-ac', '1', '-ar', '24000', '-b:a', '48k', t]);
  renameSync(t, f);
}
if (import.meta.url === `file://${process.argv[1]}`) for (const id of ids) {
  const S = JSON.parse(readFileSync(`${root}${id}/story.json`));
  const dir = `${root}${id}/audio/`; mkdirSync(dir, { recursive: true });
  const index = {}, jobs = [], RF = dir + 'rates.json', R = existsSync(RF) ? JSON.parse(readFileSync(RF)) : {};
  for (const l of lines(S)) {
    const k = `${l.w}|${l.p}|${l.t}`; if (index[k]) continue;
    const f = fileFor(S, l); index[k] = f;
    const v = S.voices[l.w] || S.voices.narr, pc = S.pace[l.p] || S.pace['平'];
    const n = count(l.t), max = !pc.max || n < 3 ? Infinity : pc.max + (n < 6 ? 0.7 : 0) - 0.12;   // 0.12 = margin under the gate
    jobs.push({ f, n, max, text: l.t, out: dir + f, engine: v.engine || 'edge', voice: v.voice, pace: l.p,
      req: num(v.rate) + pc.rate - S.pace['平'].rate, pitch: sign(num(v.pitch) + PITCH[l.p]) + 'Hz' });
  }
  let made = 0, next = 0, failed = 0, slowed = 0;
  async function worker() {
    while (next < jobs.length) {
      const x = jobs[next++], r = R[x.f];
      if (!force && existsSync(x.out) && statSync(x.out).size > 500 && r && r.req === x.req && r.pitch === x.pitch && x.n / r.d <= x.max) continue;
      const E = await engine(x.engine);
      let rate = x.req;
      for (let k = 0, tries = 0; ; k++) {
        try { await E.render({ ...x, rate: sign(rate) + '%' }); trim(x.out); }
        catch (e) { if (k >= 3) { console.error('FAIL', x.out, e.message); failed++; process.exitCode = 1; break; } await new Promise(r => setTimeout(r, 1500 * (k + 1))); continue; }
        const d = dur(x.out), cps = x.n / d;
        if (cps > x.max && tries < 3 && rate > -30) { tries++; rate = Math.max(-30, Math.floor((100 + rate) * x.max / cps - 100) - 2); continue; }
        if (rate !== x.req) slowed++;
        R[x.f] = { req: x.req, rate, pitch: x.pitch, d: +d.toFixed(3) }; made++; break;
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  // clips no longer in the script go to audio/_old/, so the folder only holds what the page uses
  const keep = new Set(Object.values(index)); let old = 0;
  for (const f of readdirSync(dir)) if (f.endsWith('.mp3') && !keep.has(f)) { mkdirSync(dir + '_old', { recursive: true }); renameSync(dir + f, dir + '_old/' + f); old++; }
  writeFileSync(dir + 'index.json', JSON.stringify(index));
  writeFileSync(RF, JSON.stringify(Object.fromEntries(Object.entries(R).filter(([f]) => keep.has(f)))));
  console.log(`${id}: ${made} rendered (${slowed} slowed under their pace's max 字/s), ${jobs.length} clips total, ${failed} failed, ${old} stale moved to _old/`);
}
