#!/usr/bin/env node
// v133: the rest of the rich 吟 for every map poem without a show of its own (Wilson 2026-11-11: the 43 sound odd and
// incomplete next to 早发白帝城 / 黄鹤楼). Reads tools/design-poem/map-shows.src.json (painting, music bed, two 引子 lines per
// poem) and renders the 引子 in the shows' narrator voice exactly as gen-audio.mjs does for their yinIntro: Edge 云健 +6%,
// pace 缓 then 慢 (baidi/chunwang/huanghelou pace table: 缓 = 0% −1Hz, 慢 = −8% −2Hz), same trim.
// SAY: TTS-only readings for 多音字 in the 引子 (the screen keeps the real text), always swapped for a same-tone homophone.
//   node tools/design-poem/gen-intro-map.mjs [--force] [ids…]  → data/design-poem/audio/intro/*.mp3 + data/design-poem/map-shows.json
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url).pathname, D = root + 'data/design-poem/', A = D + 'audio/intro/';
const { render } = await import(root + 'tools/shuoshu/tts/edge.mjs');
const VOICE = 'zh-CN-YunjianNeural', PACE = { 缓: ['+0%', '-1Hz'], 慢: ['-8%', '-2Hz'] };
export const SAY = { 放还: '放环', 封禅: '封善', 乐工: '月工', 曲江: '区江', 正落: '正洛', 曲阜: '区阜', 当涂: '裆涂' };
const sayOf = t => Object.entries(SAY).reduce((a, [x, y]) => a.split(x).join(y), t);
const args = process.argv.slice(2), force = args.includes('--force'), only = args.filter(a => !a.startsWith('--'));
const src = JSON.parse(readFileSync(root + 'tools/design-poem/map-shows.src.json'));
const cred = Object.fromEntries([...JSON.parse(readFileSync(D + 'credits.json')), ...JSON.parse(readFileSync(D + 'map/credits.json'))].map(c => [c.id, c]));
const trimAf = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse';
const dur = f => +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim();
async function tts(text, p, out) {
  for (let k = 0; ; k++) { try {
    await render({ text, voice: VOICE, rate: PACE[p][0], pitch: PACE[p][1], out });
    const t = out + '.trim.mp3'; execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', out, '-af', trimAf, '-ac', '1', '-ar', '24000', '-b:a', '48k', t]); renameSync(t, out);
    if (statSync(out).size < 500) throw new Error('tiny'); return;
  } catch (e) { if (k >= 5) throw e; console.error('  retry', k + 1, String(e).slice(0, 80)); await new Promise(r => setTimeout(r, (String(e).includes('429') ? 20000 : 3000) * (k + 1))); } }
}
mkdirSync(A, { recursive: true });
const manF = D + 'map-shows.json', man = existsSync(manF) ? JSON.parse(readFileSync(manF)) : {};
let made = 0;
for (const [id, s] of Object.entries(src)) {
  if (id.startsWith('_') || (only.length && !only.includes(id))) continue;
  const c = cred[s.img]; if (!c) throw new Error(id + ': no credit for image ' + s.img);
  if (!existsSync(D + 'bgm/' + s.bgm + '.mp3')) throw new Error(id + ': no bgm ' + s.bgm);
  const intro = [];
  for (const [i, t] of s.intro.entries()) {
    const p = i === 0 ? '缓' : '慢', say = sayOf(t), h = createHash('sha1').update(`${say}|${VOICE}|${PACE[p]}`).digest('hex').slice(0, 8), f = `${id}-${i}-${h}.mp3`;
    if (force || !existsSync(A + f)) { await tts(say, p, A + f); made++; await new Promise(r => setTimeout(r, 500)); }
    intro.push({ w: 'narr', p, t, ...(say !== t ? { say } : {}), ...(i === 0 ? { pre: 300 } : { c: 1 }), src: 'audio/intro/' + f, dur: +dur(A + f).toFixed(2) });
  }
  man[id] = { img: { src: c.file, cap: c.cap, lic: c.licence }, bgm: s.bgm, intro };
  console.log(id, s.bgm, s.img, intro.map(x => x.dur + 's').join(' '));
}
writeFileSync(manF, JSON.stringify(man));
console.log(made, 'rendered →', manF);
