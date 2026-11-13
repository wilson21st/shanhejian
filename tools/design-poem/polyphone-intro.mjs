#!/usr/bin/env node
// v133 多音字 check for the map poems' 引子 (gen-intro-map.mjs), same method as polyphone-check.mjs: the rendered clip vs the
// line re-rendered with the character swapped for a homophone of the RIGHT and of the WRONG reading (log-mel DTW, melcmp.py).
// FIX rows → add the right swap to SAY in gen-intro-map.mjs and re-render (node tools/design-poem/gen-intro-map.mjs <id>).
//   node tools/design-poem/polyphone-intro.mjs   → table on stdout
import { readFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = new URL('../../', import.meta.url).pathname, D = root + 'data/design-poem/', T = '/tmp/polyphone-intro/';
mkdirSync(T, { recursive: true });
const { render } = await import(root + 'tools/shuoshu/tts/edge.mjs');
const VOICE = 'zh-CN-YunjianNeural', PACE = { 缓: ['+0%', '-1Hz'], 慢: ['-8%', '-2Hz'] };
const trimAf = 'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.08,areverse';
// [poem id, fragment as written, read RIGHT (homophone), read WRONG, wanted reading]
const CHECKS = [
  ['p05', '重阳', '虫阳', '众阳', '重 chóng'], ['q14', '重阳', '虫阳', '众阳', '重 chóng'], ['q16', '重逢', '虫逢', '众逢', '重 chóng'],
  ['q16', '李龟年', '李规年', '李君年', '龟 guī'],
  ['q02', '供奉', '共奉', '工奉', '供 gòng'], ['q02', '为他', '位他', '围他', '为 wèi'],
  ['p15', '为出使', '位出使', '围出使', '为 wèi'], ['p15', '送行', '送形', '送航', '行 xíng'],
  ['p13', '落了第', '洛了第', '辣了第', '落 luò'], ['q20', '落了第', '洛了第', '辣了第', '落 luò'], ['p17', '落魄', '洛魄', '烙魄', '落 luò'],
  ['q10', '流落', '流洛', '流烙', '落 luò'], ['p09', '正落', '正洛', '正辣', '落 luò'],
  ['q15', '乘一叶', '成一叶', '剩一叶', '乘 chéng'], ['q11', '柏树', '百树', '博树', '柏 bǎi'], ['q21', '曲阜', '区阜', '取阜', '曲 qū'],
  ['q06', '当涂', '裆涂', '荡涂', '当 dāng'], ['p22', '到处', '到触', '到储', '处 chù'], ['q12', '一处', '一触', '一储', '处 chù'],
  ['q08', '吓人', '下人', '赫人', '吓 xià'], ['p08', '客舍', '客社', '客写', '舍 shè'], ['p06', '还是', '孩是', '环是', '还 hái'],
];
const MS = JSON.parse(readFileSync(D + 'map-shows.json'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function tts(text, p) {
  const f = T + createHash('sha1').update(text + '|' + p).digest('hex').slice(0, 12) + '.mp3';
  if (existsSync(f)) return f;
  for (let k = 0; ; k++) { try {
    await render({ text, voice: VOICE, rate: PACE[p][0], pitch: PACE[p][1], out: f });
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', f, '-af', trimAf, '-ac', '1', '-ar', '24000', '-b:a', '48k', f + '.t.mp3']); renameSync(f + '.t.mp3', f);
    await sleep(600); return f;
  } catch (e) { if (k >= 4) throw e; await sleep(4000 * (k + 1)); } }
}
let fix = 0;
for (const [id, frag, right, wrong, want] of CHECKS) {
  const c = (MS[id]?.intro || []).find(x => x.t.includes(frag));
  if (!c) { console.log(`${id} ${frag}: NOT FOUND`); continue; }
  // a line already swapped by SAY says the RIGHT homophone where the fragment was: swap from that
  const said = c.say || c.t, at = said.includes(frag) ? frag : right, fo = D + c.src, fr = await tts(said.replace(at, right), c.p), fw = await tts(said.replace(at, wrong), c.p);
  const [dr, dw] = JSON.parse(execFileSync('python3', [root + 'tools/design-poem/melcmp.py', fo, fr, fw]).toString());
  const ok = dr < dw; if (!ok) fix++;
  console.log(`${ok ? 'ok  ' : 'FIX '} ${id} ${c.t}  [${want}]  d(right)=${dr.toFixed(3)} d(wrong)=${dw.toFixed(3)} margin=${((dw - dr) / Math.max(dr, dw)).toFixed(2)}`);
}
console.log(fix ? fix + ' to fix' : 'all ok');
