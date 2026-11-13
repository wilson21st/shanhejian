#!/usr/bin/env node
// 多音字 check for the map poems' recitation (v132; the 还 → hái slip in v1 is why). For every polyphonic character whose
// reading in the poem is fixed, render the line three ways with the same voice: as written, with the character swapped for
// an unambiguous homophone of the RIGHT reading, and of the WRONG one. Whichever swap sounds closer to the line as written
// (log-mel spectrogram, DTW; tools/design-poem/melcmp.py) is what the voice actually says. A line the voice gets wrong gets
// the right swap written to data/design-poem/yin-read.json (TTS-only, the screen keeps the real character); then
//   node tools/design-poem/gen-yin-map.mjs   re-renders just those lines.
//   node tools/design-poem/polyphone-check.mjs [--write]   → prints a table, $HS_WORK/polyphone.txt (default /tmp/hs-work)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cut, tts, sayOf } from './gen-yin-map.mjs';
const root = new URL('../../', import.meta.url).pathname, D = root + 'data/design-poem/', T = '/tmp/polyphone/';
mkdirSync(T, { recursive: true });
// [poem id, fragment as written, the fragment read RIGHT (homophone), read WRONG, the reading we want]
const CHECKS = [
  ['p02', '无为在', '无围在', '无位在', '为 wéi'],
  ['p03', '南冠', '南关', '南贯', '冠 guān'], ['p03', '露重', '露众', '露虫', '重 zhòng'], ['p03', '谁为表', '谁位表', '谁围表', '为 wèi'],
  ['p03', '表予心', '表于心', '表与心', '予 yú'],
  ['p05', '为异客', '围异客', '位异客', '为 wéi'],
  ['p06', '人未还', '人未环', '人未孩', '还 huán'], ['p06', '飞将在', '飞酱在', '飞江在', '将 jiàng'], ['p06', '不教', '不叫', '不交', '教 jiào'],
  ['p07', '处处', '触触', '储储', '处 chù'],
  ['p13', '岱宗夫', '岱宗扶', '岱宗肤', '夫 fú'], ['p13', '曾云', '层云', '增云', '曾 céng'],
  ['p14', '还寝', '环寝', '孩寝', '还 huán'],
  ['p15', '客舍', '客社', '客写', '舍 shè'],
  ['p16', '少小', '绍小', '烧小', '少 shào'], ['p16', '鬓毛衰', '鬓毛崔', '鬓毛摔', '衰 cuī'],
  ['p18', '北风卷', '北风捲', '北风倦', '卷 juǎn'], ['p18', '冷难着', '冷难酌', '冷难招', '着 zhuó'], ['p18', '阑干', '阑甘', '阑赣', '干 gān'],
  ['p18', '马行处', '马形处', '马航处', '行 xíng'],
  ['p20', '独看', '独刊', '独炕', '看 kān'], ['p20', '泪痕干', '泪痕甘', '泪痕赣', '干 gān'],
  ['p22', '出门看', '出门刊', '出门炕', '看 kān'],
  ['p24', '花重', '花众', '花虫', '重 zhòng'], ['p24', '当春', '裆春', '荡春', '当 dāng'],
  ['p25', '漫卷', '漫捲', '漫倦', '卷 juǎn'], ['p25', '好还乡', '好环乡', '好孩乡', '还 huán'], ['p25', '便下', '变下', '骈下', '便 biàn'],
  ['q02', '冰塞川', '冰色川', '冰赛川', '塞 sè'], ['q02', '将登', '江登', '酱登', '将 jiāng'], ['q02', '行路难，行路难', '形路难，形路难', '航路难，航路难', '行 xíng'],
  ['q02', '长风', '常风', '掌风', '长 cháng'],
  ['q03', '重有', '虫有', '众有', '重 chóng'],
  ['q04', '为谁雄', '位谁雄', '围谁雄', '为 wèi'],
  ['q06', '谁为出涕', '谁位出涕', '谁围出涕', '为 wèi'],
  ['q07', '行人', '形人', '航人', '行 xíng'], ['q07', '干云霄', '甘云霄', '赣云霄', '干 gān'],
  ['q09', '号咷', '豪咷', '浩咷', '号 háo'],
  ['q10', '人行', '人形', '人航', '行 xíng'], ['q10', '长不达', '常不达', '掌不达', '长 cháng'],
  ['q11', '丞相', '丞象', '丞箱', '相 xiàng'], ['q11', '两朝', '两潮', '两招', '朝 cháo'], ['q11', '长使', '常使', '掌使', '长 cháng'],
  ['q12', '怒号', '怒豪', '怒浩', '号 háo'], ['q12', '卷我', '捲我', '倦我', '卷 juǎn'], ['q12', '三重', '三虫', '三众', '重 chóng'],
  ['q13', '一行', '一航', '一形', '行 háng'],
  ['q17', '单车', '丹车', '善车', '单 dān'], ['q17', '属国', '鼠国', '嘱国', '属 shǔ'], ['q17', '候骑', '候寄', '候奇', '骑 jì'], ['q17', '燕然', '烟然', '艳然', '燕 yān'],
  ['q18', '返景', '返影', '返井', '景 yǐng'],
  ['q19', '更朝天', '更潮天', '更招天', '朝 cháo'],
  ['q21', '何为者', '何围者', '何位者', '为 wéi'], ['q21', '身否', '身痞', '身缶', '否 pǐ'],
];
const P = Object.fromEntries([...JSON.parse(readFileSync(root + 'data/poems.json')).events, ...JSON.parse(readFileSync(root + 'data/person-poems.json')).poems].map(p => [p.id, p]));
const write = process.argv.includes('--write'), out = [], read = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function render(text, i) { const f = T + createHash('sha1').update(text + '|' + (i % 2)).digest('hex').slice(0, 12) + '.mp3';
  if (!existsSync(f)) { await tts(text, i, f); await sleep(700); } return f; }
for (const [id, frag, right, wrong, want] of CHECKS) {
  const { said } = cut(P[id].poem), i = said.findIndex(s => s.includes(frag));
  if (i < 0) { out.push(`${id} ${frag}: NOT FOUND`); continue; }
  const line = said[i], fo = await render(line, i), fr = await render(line.replace(frag, right), i), fw = await render(line.replace(frag, wrong), i);
  const [dr, dw] = JSON.parse(execFileSync('python3', [root + 'tools/design-poem/melcmp.py', fo, fr, fw]).toString());
  const ok = dr < dw, margin = (dw - dr) / Math.max(dr, dw);
  if (!ok) (read[id] = read[id] || []).push([frag, right]);
  out.push(`${ok ? 'ok  ' : 'FIX '} ${id} ${line}  [${want}]  d(right)=${dr.toFixed(3)} d(wrong)=${dw.toFixed(3)} margin=${margin.toFixed(2)}`);
  console.log(out.at(-1));
}
const report = out.join('\n'); writeFileSync((mkdirSync(process.env.HS_WORK || '/tmp/hs-work', { recursive: true }), (process.env.HS_WORK || '/tmp/hs-work') + '/polyphone.txt'), report + '\n');
if (write) { const cur = JSON.parse(readFileSync(D + 'yin-read.json'));
  for (const [id, l] of Object.entries(read)) for (const r of l) { cur[id] = cur[id] || []; if (!cur[id].some(x => x[0] === r[0])) cur[id].push(r); }
  writeFileSync(D + 'yin-read.json', JSON.stringify(cur, null, 1)); console.log('wrote yin-read.json', JSON.stringify(read)); }
