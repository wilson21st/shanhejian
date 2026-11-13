#!/usr/bin/env node
// The 说书 verse cards (定场诗, quoted 诗) are set in 马善政 Ma Shan Zheng, a free brush font (SIL OFL 1.1, Google Fonts;
// licence in data/shuoshu/font/OFL-MaShanZheng.txt). The full font is 5.8 MB, so the page loads a subset holding only the
// characters of every story's verses and their titles: data/shuoshu/font/poem.woff2 (self-hosted, no CDN).
// Rerun after adding or changing a verse:   node tools/shuoshu/poem-font.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const root = new URL('../../data/shuoshu/', import.meta.url).pathname;
const chars = new Set('·《》');
for (const { id } of JSON.parse(readFileSync(root + 'stories.json'))) {
  const S = JSON.parse(readFileSync(`${root}${id}/story.json`));
  for (const v of Object.values(S.verses || {})) for (const c of v.title + v.lines.join('')) chars.add(c);
}
const text = [...chars].sort().join('');
writeFileSync('/tmp/poem-font-chars.txt', text);
execFileSync('pyftsubset', [new URL('./fonts/MaShanZheng-Regular.ttf', import.meta.url).pathname, '--text-file=/tmp/poem-font-chars.txt',
  '--flavor=woff2', '--layout-features=*', '--no-hinting', `--output-file=${root}font/poem.woff2`]);
writeFileSync(`${root}font/poem-chars.txt`, text + '\n');
console.log(`poem.woff2: ${chars.size} glyphs`);
