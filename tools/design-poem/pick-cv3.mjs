#!/usr/bin/env node
// 吟诗 v2: choose one CosyVoice3 take per line from /tmp/cv3yin/<poem>-<line>-<take>.wav (cv3-yin.py) → data/design-poem/audio/yin/cv3/.
// Each take is transcribed with the local Qwen3-ASR (~/dev/openclaw/tools/asr-qwen); score = character accuracy against the
// line (shown or as-read text, so 还/环 both count), then closeness to a recited pace of ~2.2 chars/s. A line with no take at
// ≥ 0.85 accuracy is reported and still uses the best one. Log → $HS_WORK/cv3-picks.json (default /tmp/hs-work).
// Then run gen-yin.mjs (it indexes cv3/ into yin.json).
//   node tools/design-poem/pick-cv3.mjs [poem ...]
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { poems } from './poems.mjs';
import { shown, said } from './dsl.mjs';
const root = new URL('../../', import.meta.url).pathname, OUT = root + 'data/design-poem/audio/yin/cv3/', T = '/tmp/cv3yin/';
const ASR = process.env.ASR_QWEN || process.env.HOME + '/dev/openclaw/tools/asr-qwen/run.sh', LOG = (process.env.HS_WORK || '/tmp/hs-work') + '/cv3-picks.json';
const only = process.argv.slice(2); mkdirSync(OUT, { recursive: true }); mkdirSync(LOG.replace(/[^/]+$/, ''), { recursive: true });
const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG)) : {};
const strip = s => [...s.replace(/[^\p{Script=Han}]/gu, '')];
function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length]; }
const acc = (got, want) => 1 - lev(strip(got), strip(want)) / strip(want).length;
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString();
const files = readdirSync(T).filter(f => f.endsWith('.wav'));
for (const p of poems) {
  if (only.length && !only.includes(p.id)) continue;
  for (const [i, raw] of p.text.entries()) {
    const takes = files.filter(f => f.startsWith(`${p.id}-${i}-`)).sort(); if (!takes.length) { console.log(p.id, i, 'no takes yet'); continue; }
    const key = `${p.id}-${i}`, n = strip(shown(raw)).length, scored = [];
    for (const f of takes) {
      const prev = log[key]?.takes?.find(x => x.f === f);
      let text = prev?.text;
      if (text == null) { execFileSync(ASR, ['--no-context', '--out-base', '/tmp/cv3yin/asr', T + f], { stdio: ['ignore', 'ignore', 'ignore'] }); text = readFileSync('/tmp/cv3yin/asr.txt', 'utf8').trim(); }
      const d = dur(T + f), a = Math.max(acc(text, shown(raw)), acc(text, said(raw))), cps = n / d;
      scored.push({ f, text, d: +d.toFixed(2), acc: +a.toFixed(2), cps: +cps.toFixed(2), score: +(a * 10 - Math.abs(cps - 2.2) - (cps < 1 || cps > 4 ? 3 : 0)).toFixed(2) });
    }
    const best = scored.reduce((x, y) => y.score > x.score ? y : x);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', T + best.f, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-18:TP=-1.5', '-ac', '1', '-ar', '24000', '-b:a', '64k', `${OUT}${key}.mp3`]);
    log[key] = { pick: best.f, takes: scored };
    console.log(key, best.f, best.text, 'acc', best.acc, best.cps + '/s', best.acc < 0.85 ? '  ← LOW ACCURACY' : '');
    writeFileSync(LOG, JSON.stringify(log, null, 1));
  }
}
