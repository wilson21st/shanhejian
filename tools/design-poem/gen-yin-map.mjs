#!/usr/bin/env node
// v132: a recited voice for every poem on the map (poems.json + person-poems.json) that has no show of its own.
// Same voice and settings as the three shows' 吟 (poems.mjs voices.yin = Edge 云健 -16% -3Hz; 出句 平, 对句 缓 — exactly what
// gen-audio.mjs renders for them), same trim, same per-character marks as gen-yin.mjs, so the brush follows the voice.
// Lines are cut the way design-poem.html genS() cuts them (one 句 a column, a couplet a column for long 歌行).
// TTS-only readings for 多音字 live in READ below (checked by tools/design-poem/polyphone-check.mjs).
//   node tools/design-poem/gen-yin-map.mjs [--force] [ids…]  → data/design-poem/audio/yin/map/<id>-<i>.mp3 + data/design-poem/yin-map.json
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url).pathname, D = root + 'data/design-poem/', A = D + 'audio/yin/map/';
const { render } = await import(root + 'tools/shuoshu/tts/edge.mjs');
const RECORDED = { p23: 'baidi', p21: 'chunwang', p11: 'huanghelou' };
const VOICE = 'zh-CN-YunjianNeural', RATE = { 0: '-16%', 1: '-22%' }, PITCH = { 0: '-3Hz', 1: '-4Hz' };
// 多音字 the voice gets wrong, per poem: [shown fragment, fragment the voice reads]. Fragment context keeps it unambiguous.
export const READ = JSON.parse(readFileSync(D + 'yin-read.json'));
const args = process.argv.slice(2), force = args.includes('--force'), only = args.filter(a => !a.startsWith('--'));
// ---- the poems, cut like genS() ----
const P = [...JSON.parse(readFileSync(root + 'data/poems.json')).events, ...JSON.parse(readFileSync(root + 'data/person-poems.json')).poems];
const strip = t => t.replace(/[，。！？；、：“”‘’「」《》—…\s]/g, '');
export function cut(p) {
  let cl = p.text.join('').replace(/([，。！？；])/g, '$1\n').split('\n').map(t => t.trim()).filter(t => strip(t));
  if (cl.length > 10 && Math.max(...cl.map(t => t.length)) <= 8) { const m = []; for (let i = 0; i < cl.length; i += 2) m.push(cl.slice(i, i + 2).join('')); cl = m; }
  return { said: cl.map(t => t.replace(/[。！？；，]$/, '')), text: cl.map(strip) };
}
const trimAf = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse';
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
// = gen-yin.mjs marks(): voiced spans from silencedetect, characters spread over voiced time, the last one weighs 1.5
function marks(f, n) {
  const d = dur(f), txt = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'silencedetect=noise=-38dB:d=0.12', '-f', 'null', '-']).stderr.toString(), sil = [];
  const re = /silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g; let m;
  while ((m = re.exec(txt))) sil.push([+m[1], +m[2]]);
  const voiced = []; let t = 0; for (const [a, b] of sil) { if (a > t + 0.02) voiced.push([t, a]); t = b; } if (d > t + 0.02) voiced.push([t, d]);
  const w = Array.from({ length: n }, (_, k) => k === n - 1 ? 1.5 : 1), W = w.reduce((a, b) => a + b), V = voiced.reduce((a, [x, y]) => a + y - x, 0);
  const at = v => { for (const [x, y] of voiced) { if (v <= y - x) return x + v; v -= y - x; } return d; };
  const out = []; let acc = 0; for (let k = 0; k < n; k++) { out.push(+at(acc / W * V).toFixed(2)); acc += w[k]; }
  return { d: +d.toFixed(2), m: out };
}
export const sayOf = (id, s) => (READ[id] || []).reduce((a, [x, y]) => a.split(x).join(y), s);
export async function tts(text, i, out) {
  for (let k = 0; ; k++) { try {
    await render({ text, voice: VOICE, rate: RATE[i % 2], pitch: PITCH[i % 2], out });
    const t = out + '.trim.mp3'; execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-af', trimAf, '-ac', '1', '-ar', '24000', '-b:a', '48k', t]); renameSync(t, out);
    if (statSync(out).size < 500) throw new Error('tiny'); return;
  } catch (e) { if (k >= 5) throw e; console.error('  retry', k + 1, String(e).slice(0, 80)); await new Promise(r => setTimeout(r, (String(e).includes('429') ? 20000 : 3000) * (k + 1))); } }
}
if (import.meta.url === 'file://' + process.argv[1]) {
  mkdirSync(A, { recursive: true });
  const manF = D + 'yin-map.json', man = existsSync(manF) ? JSON.parse(readFileSync(manF)) : {};
  let made = 0;
  for (const p of P) {
    if (RECORDED[p.id] || (only.length && !only.includes(p.id))) continue;
    const { said, text } = cut(p.poem), list = [];
    for (const [i, s] of said.entries()) {
      const say = sayOf(p.id, s), h = createHash('sha1').update(`${say}|${VOICE}|${RATE[i % 2]}|${PITCH[i % 2]}`).digest('hex').slice(0, 8);
      const f = `${p.id}-${i}-${h}.mp3`;
      if (force || !existsSync(A + f)) { await tts(say, i, A + f); made++; await new Promise(r => setTimeout(r, 600)); }
      list.push({ f: 'map/' + f, ...marks(A + f, text[i].length), ...(say !== s ? { say } : {}) });
    }
    man[p.id] = list; writeFileSync(manF, JSON.stringify(man));
    console.log(p.id, p.poem.title, list.length, 'lines', list.reduce((a, x) => a + x.d, 0).toFixed(1) + 's');
  }
  console.log(made, 'rendered →', manF);
}
