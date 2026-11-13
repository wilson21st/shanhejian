#!/usr/bin/env node
// 吟诗 v2: the poem lines in several voices → data/design-poem/audio/yin/<voice>/<poem>-<line>.mp3 + data/design-poem/yin.json.
// Edge's free endpoint rejects express-as/break, so "shaped" voices are two <prosody> half-lines (rate/pitch/volume from MOOD)
// spliced with a real pause at the caesura, the second half slower (held last syllable); see halves() below.
// cv3 clips come from cv3-yin.py (CosyVoice3 instruct, run separately); this script only indexes them.
// Every clip gets char marks: when each character starts, from the voiced spans (ffmpeg silencedetect), so the brush follows the voice.
//   node tools/design-poem/gen-yin.mjs [--force] [--only=voiceId]
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { poems } from './poems.mjs';
import { shown, said } from './dsl.mjs';
const require = createRequire(process.env.TTS_MODULES_DIR || process.env.HOME + '/dev/openclaw/tools/tts/');
const { EdgeTTS } = require('node-edge-tts');
class Raw extends EdgeTTS { async _connectWebSocket() { const ws = await super._connectWebSocket(); const s = ws.send.bind(ws); ws.send = m => s(m.includes('Path:ssml') ? m.slice(0, m.indexOf('\r\n\r\n') + 4) + this.raw : m); return ws; } }
const root = new URL('../../', import.meta.url).pathname, D = root + 'data/design-poem/', A = D + 'audio/yin/';
const force = process.argv.includes('--force'), only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
export const VOICES = [
  { id: 'edge', label: '原版 云健', note: 'v1 的读法：Edge 云健，整句一个语速一个音高' },
  { id: 'shaped', label: '云健 · 抑扬', voice: 'zh-CN-YunjianNeural', note: 'Edge 云健，逐个词组调快慢高低，句中停顿，尾字拖长' },
  { id: 'yunxi', label: '云希 · 抑扬', voice: 'zh-CN-YunxiNeural', pitch: 0, note: 'Edge 云希（较年轻、柔和的男声），同样逐词组调' },
  { id: 'yunyang', label: '云扬 · 朗诵', voice: 'zh-CN-YunyangNeural', pitch: -1, note: 'Edge 云扬（播音腔男声），同样逐词组调' },
  { id: 'xiaoxiao', label: '晓晓 · 抑扬', voice: 'zh-CN-XiaoxiaoNeural', pitch: -1, note: 'Edge 晓晓（温柔女声），同样逐词组调' },
  { id: 'cv3', label: 'CosyVoice 有情绪', note: '本机 CosyVoice3 指令模式：按诗的情绪（喜/悲/愁）吟，每句出两版自动拣' },
];
// mood: base rate %, pitch st, volume %; per line [rate, pitch, vol] offsets; tail = extra slow-down % on the last syllable
export const MOOD = {
  baidi: { word: '轻快、喜悦', rate: -8, pitch: 1, vol: 5, tail: -30,
    lines: [[0, 1, 0], [4, 2, 5], [-6, 0, -5], [8, 1, 8]] },           // 出发 → 一日还 (release) → 猿声 (hush) → 轻舟已过 (rush, then 山 held)
  chunwang: { word: '沉痛、悲伤', rate: -22, pitch: -2, vol: -4, tail: -35,
    lines: [[0, -1, 0], [0, 0, -3], [-2, 1, 0], [-2, 0, 0], [4, 1, 6], [0, 1, 4], [-4, -1, -6], [-8, -2, -8]] },
  huanghelou: { word: '惆怅、悠远', rate: -16, pitch: 0, vol: 0, tail: -38,
    lines: [[0, 0, 0], [-2, -1, 0], [2, 1, 4], [-6, 0, -2], [2, 1, 2], [0, 1, 0], [-4, -1, -3], [-8, -2, -5]] },
};
const sg = n => (n >= 0 ? '+' : '') + n;
const P = (t, r, p, v) => `<prosody rate="${sg(r)}%" pitch="${sg(p)}st" volume="${sg(v)}%">${t}</prosody>`;
const sp = (voice, b) => `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${voice}">${b}</voice></speak>`;
// A line = two half-lines, each its own request with one <prosody> (Edge's free endpoint hangs on 3+ spans and 429s when
// pressed), spliced with a real pause at the caesura: 7 字 = 4 | 3, 5 字 = 2 | 3. The second half is slower (the held last
// syllable) and ends a touch higher on 出句 (odd lines), lower on 对句. GAP = caesura pause per mood, ms.
const GAP = { baidi: 230, chunwang: 420, huanghelou: 340 };
function halves(voice, txt, mood, i, vp = 0) {
  const [lr, lp, lv] = mood.lines[i] || [0, 0, 0], r = mood.rate + lr, p = mood.pitch + lp + vp, v = mood.vol + lv;
  const c = [...txt], cut = c.length === 7 ? 4 : 2, end = i % 2 ? -1 : 1;
  return [sp(voice, P(c.slice(0, cut).join(''), r, p + 1, v)), sp(voice, P(c.slice(cut).join(''), r + Math.round(mood.tail / 2), p + end, v))];
}
const trimAf = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse';
export const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
// char start times: voiced spans from silencedetect, chars spread over voiced time; the last char weighs 1.5 (held)
export function marks(f, n) {
  const d = dur(f), txt = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-']).stderr.toString(), sil = [];
  const re = /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g; let m;
  while ((m = re.exec(txt))) sil.push([+m[1], +m[2]]);
  const voiced = []; let t = 0; for (const [a, b] of sil) { if (a > t + 0.02) voiced.push([t, a]); t = b; } if (d > t + 0.02) voiced.push([t, d]);
  const w = Array.from({ length: n }, (_, k) => k === n - 1 ? 1.5 : 1), W = w.reduce((a, b) => a + b), V = voiced.reduce((a, [x, y]) => a + y - x, 0);
  const at = v => { for (const [x, y] of voiced) { if (v <= y - x) return x + v; v -= y - x; } return d; };
  const out = []; let acc = 0; for (let k = 0; k < n; k++) { out.push(+at(acc / W * V).toFixed(2)); acc += w[k]; }
  return { d: +d.toFixed(2), m: out };
}
// Edge's free endpoint answers 429 / hangs when hit fast: one request at a time, a pause after each, long backoff on failure
const CACHE = '/tmp/dpyin/'; mkdirSync(CACHE, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function edge1(voice, raw) { // one request, cached by its SSML; pause after each, long backoff on 429/hang
  const f = CACHE + createHash('sha1').update(raw).digest('hex').slice(0, 16) + '.wav'; if (existsSync(f)) return f;
  for (let k = 0; ; k++) { await sleep(1800); try {
    const t = new Raw({ voice, lang: 'zh-CN', outputFormat: 'audio-24khz-48kbitrate-mono-mp3', timeout: 15000 }); t.raw = raw;
    await t.ttsPromise('x', f + '.mp3');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f + '.mp3', '-af', trimAf, '-ac', '1', '-ar', '24000', f]); execFileSync('trash', [f + '.mp3']); return f;
  } catch (e) { if (k >= 8) throw new Error(String(e)); const w = String(e).includes('429') ? 20000 : 5000 * (k + 1); console.error('  retry', k + 1, String(e), 'wait', w / 1000 + 's'); await sleep(w); } }
}
async function edge(voice, raws, gap, out) {
  const parts = []; for (const [k, raw] of raws.entries()) { if (k) { const g = CACHE + `gap${gap}.wav`; if (!existsSync(g)) execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', String(gap / 1000), g]); parts.push(g); } parts.push(await edge1(voice, raw)); }
  const lst = CACHE + 'list.txt'; writeFileSync(lst, parts.map(p => `file '${p}'`).join('\n'));
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-ac', '1', '-ar', '24000', '-b:a', '64k', out]);
}
const yinF = D + 'yin.json', man = existsSync(yinF) ? JSON.parse(readFileSync(yinF)) : {};
const v1 = JSON.parse(readFileSync(D + 'audio/index.json')), stats = {};
for (const p of poems) {
  man[p.id] = man[p.id] || {};
  for (const V of VOICES) {
    if (only && V.id !== only) continue;
    const dir = A + V.id + '/'; mkdirSync(dir, { recursive: true }); const t0 = Date.now(), list = [];
    for (const [i, raw] of p.text.entries()) {
      const txt = shown(raw), n = [...txt].length, f = `${p.id}-${i}.mp3`, out = dir + f;
      if (V.id === 'edge') { // the v1 clip, copied so every voice lives in one folder
        const src = v1[`yin|${i % 2 ? '缓' : '平'}|${txt}`]; if (!src) throw new Error('no v1 clip for ' + txt);
        if (force || !existsSync(out)) execFileSync('cp', [D + 'audio/' + src, out]);
      } else if (V.id === 'cv3') { if (!existsSync(out)) { list.push(null); continue; } }
      else if (force || !existsSync(out) || statSync(out).size < 500) await edge(V.voice, halves(V.voice, said(raw), MOOD[p.id], i, V.pitch || 0), GAP[p.id], out);
      list.push({ f: `${V.id}/${f}`, ...marks(out, n) });
    }
    if (list.some(x => !x)) { console.log(p.id, V.id, 'incomplete (', list.filter(Boolean).length, '/', list.length, ')'); continue; }
    man[p.id][V.id] = list; (stats[V.id] = stats[V.id] || []).push(`${p.id} ${((Date.now() - t0) / 1000).toFixed(1)}s ${list.reduce((a, x) => a + x.d, 0).toFixed(1)}s audio`);
  }
}
man.voices = VOICES.map(({ id, label, note }) => ({ id, label, note })).filter(v => poems.every(p => man[p.id][v.id]));
writeFileSync(yinF, JSON.stringify(man));
console.log(JSON.stringify(stats, null, 1), '\nvoices:', man.voices.map(v => v.id).join(' '));
