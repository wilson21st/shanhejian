#!/usr/bin/env node
// Pre-render the scroll's storyteller lines (data/scroll.json) with Edge neural TTS → data/scroll-audio/<seg>-<n>.mp3.
// Same pinned node-edge-tts as gen-audio.mjs.
//   node gen-scroll-audio.mjs [--force]                                               玄武门: data/scroll.json → data/scroll-audio/
//   node gen-scroll-audio.mjs data/scroll-mawei.json data/scroll-audio-mawei/ [--force]  any other scroll
import { createRequire } from 'node:module';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(process.env.TTS_MODULES_DIR || process.env.HOME + '/dev/openclaw/tools/tts/');
const { EdgeTTS } = require('node-edge-tts');
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const S = JSON.parse(readFileSync(args[0] ? resolve(args[0]) : new URL('./data/scroll.json', import.meta.url)));
const dir = args[1] ? resolve(args[1]) + '/' : new URL('./data/scroll-audio/', import.meta.url).pathname;
mkdirSync(dir, { recursive: true });
const force = process.argv.includes('--force');
const jobs = S.segs.flatMap(s => s.lines.map((l, i) => ({ out: `${dir}${s.id}-${i}.mp3`, ...l })));
let made = 0;
await Promise.all(jobs.map(async x => {
  if (!force && existsSync(x.out) && statSync(x.out).size > 1000) return;
  const v = S.voices[x.who] || S.voices.narr;
  const tts = new EdgeTTS({ voice: v.voice, lang: 'zh-CN', rate: v.rate || '+0%', pitch: v.pitch || '+0Hz', outputFormat: 'audio-24khz-48kbitrate-mono-mp3', timeout: 20000 });
  for (let k = 0; ; k++) {
    try { await tts.ttsPromise(x.t, x.out); made++; return; }
    catch (e) { if (k >= 2) { console.error('FAIL', x.out, e.message); process.exitCode = 1; return; } }
  }
}));
console.log(`${made} rendered, ${jobs.length} lines total`);
