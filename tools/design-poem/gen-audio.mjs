#!/usr/bin/env node
// 吟诗 / 人物 design mocks: pre-render every spoken clip → <dir>/audio/<hash>.mp3 + audio/index.json ("who|pace|text" → file).
// Adapted copy of gen-shuoshu-audio.mjs; uses the shared Edge engine (tools/shuoshu/tts/edge.mjs, read-only import).
// A clip's `say` (TTS-only reading, e.g. 还→环) is what the voice reads; the key stays the shown text.
//   node tools/design-poem/gen-audio.mjs data/design-poem/baidi.json …   (all clips of the files share <dir>/audio/)
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
const root = new URL('../../', import.meta.url).pathname;
const files = process.argv.slice(2).filter(a => !a.startsWith('--')), force = process.argv.includes('--force');
const PITCH = { 急: 2, 紧: 1, 平: 0, 缓: -1, 慢: -2 };
const num = s => parseInt(s || '0', 10), sign = n => (n >= 0 ? '+' : '') + n;
const { render } = await import(root + 'tools/shuoshu/tts/edge.mjs');
// every object in the JSON with {w, t} (and a pace) is a spoken clip
function clips(x, out = []) { if (Array.isArray(x)) x.forEach(y => clips(y, out)); else if (x && typeof x === 'object') {
  if (typeof x.t === 'string' && typeof x.w === 'string') out.push(x); for (const k in x) if (typeof x[k] === 'object') clips(x[k], out); } return out; }
const dir = root + dirname(files[0]) + '/audio/'; mkdirSync(dir, { recursive: true });
const idxF = dir + 'index.json', index = existsSync(idxF) ? JSON.parse(readFileSync(idxF)) : {}, jobs = [];
for (const f of files) {
  const S = JSON.parse(readFileSync(root + f));
  for (const l of clips(S)) {
    const p = l.p || '平', k = `${l.w}|${p}|${l.t}`; if (jobs.some(j => j.k === k)) continue;
    const v = S.voices[l.w] || S.voices.narr, pc = S.pace[p];
    const text = l.say || l.t;
    const file = createHash('sha1').update(`${k}|${text}|${v.voice}|${v.rate || ''}|${v.pitch || ''}|${pc.rate}`).digest('hex').slice(0, 12) + '.mp3';
    index[k] = file;
    jobs.push({ k, text, out: dir + file, voice: v.voice, rate: sign(num(v.rate) + pc.rate - S.pace['平'].rate) + '%', pitch: sign(num(v.pitch) + PITCH[p]) + 'Hz' });
  }
}
function trim(f) { const t = f + '.trim.mp3';
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-af', 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse', '-ac', '1', '-ar', '24000', '-b:a', '48k', t]);
  renameSync(t, f); }
let made = 0, next = 0, failed = 0;
async function worker() { while (next < jobs.length) { const x = jobs[next++];
  if (!force && existsSync(x.out) && statSync(x.out).size > 500) continue;
  for (let k = 0; ; k++) { try { await render(x); trim(x.out); made++; break; }
    catch (e) { if (k >= 3) { console.error('FAIL', x.k, e.message); failed++; process.exitCode = 1; break; } await new Promise(r => setTimeout(r, 1500 * (k + 1))); } } } }
await Promise.all(Array.from({ length: 5 }, worker));
writeFileSync(idxF, JSON.stringify(index));
console.log(`${made} rendered, ${jobs.length} clips, ${failed} failed → ${dir}`);
