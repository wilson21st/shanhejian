#!/usr/bin/env node
// Slide images for a 说书 story from Wikimedia Commons (public domain / CC only; anything else is skipped), resized for
// phones → data/shuoshu/<id>/img/, plus credits.json and CREDITS.md in the story folder.
// List: tools/shuoshu/<id>-images.json = [[slideId, "File:…", thumbWidth (0 = original), "中文说明"], …]
// or ["slideId", {"from": "<other story id>"}, 0, "说明"] to reuse an image (and its credit) from another story.
// Optional 5th element {crop:[x0,x1]}: keep only that horizontal slice (fractions of the width) — for very long handscrolls.
//   node tools/shuoshu/fetch-images.mjs <id>
import { writeFileSync, existsSync, statSync, copyFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const id = process.argv[2]; if (!id) { console.error('usage: fetch-images.mjs <story id>'); process.exit(2); }
const root = new URL('../../data/shuoshu/', import.meta.url).pathname;
const OUT = `${root}${id}/img/`; mkdirSync(OUT, { recursive: true });
const UA = { 'User-Agent': 'history-sandbox/1.0 (edu project; https://github.com/wilson21st/shanhejian)' };
const L = JSON.parse(readFileSync(new URL(`./${id}-images.json`, import.meta.url)));
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const sleep = ms => new Promise(x => setTimeout(x, ms));
const credits = [];
for (const [sid, title, w, cap, opt = {}] of L) {
  const out = OUT + sid + '.jpg';
  if (typeof title === 'object') { // reuse
    const other = JSON.parse(readFileSync(`${root}${title.from}/credits.json`)).find(c => c.id === (title.id || sid));
    copyFileSync(`${root}${title.from}/img/${other.file}`, out);
    credits.push({ ...other, id: sid, file: sid + '.jpg', cap: cap || other.cap }); console.log(sid, 'reused from', title.from); continue;
  }
  const p = { action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|size|extmetadata', titles: title };
  if (w) p.iiurlwidth = w;
  let j; for (let k = 0; k < 5; k++) { const r = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams(p), { headers: UA }); if (r.ok) { j = await r.json(); break; } await sleep(4000 * (k + 1)); }
  const pg = Object.values(j.query.pages)[0], i = pg.imageinfo?.[0];
  if (!i) { console.log('MISSING', sid, title); process.exitCode = 1; continue; }
  const m = i.extmetadata || {}, lic = strip(m.LicenseShortName?.value);
  if (!/public domain|^cc|^pd/i.test(lic)) { console.log('SKIP licence', sid, lic); process.exitCode = 1; continue; }
  const url = (w && i.thumburl) || i.url;
  if (!existsSync(out)) {
    const raw = '/tmp/ss-' + id + '-' + sid + (url.match(/\.(png|jpe?g|tiff?)(\?|$)/i)?.[0].replace('?', '') || '.jpg');
    for (let k = 0; k < 5; k++) { const r = await fetch(url, { headers: UA }); if (r.ok) { writeFileSync(raw, Buffer.from(await r.arrayBuffer())); break; } console.log('retry', sid, r.status); await sleep(5000 * (k + 1)); }
    if (opt.crop) { // slice of a handscroll: crop the full-height strip [x0,x1] of the width
      const [pw, ph] = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', raw]).toString().match(/\d+(?=\n)/g).map(Number);
      const x0 = Math.round(pw * opt.crop[0]), cw = Math.round(pw * (opt.crop[1] - opt.crop[0]));
      execFileSync('sips', ['-c', String(ph), String(cw), '--cropOffset', '0', String(x0), raw, '--out', raw], { stdio: 'ignore' });
    }
    const max = opt.crop ? 1600 : (w || i.width) > 2000 ? 2000 : 1280;
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '72', '-Z', String(max), raw, '--out', out], { stdio: 'ignore' });
  }
  credits.push({ id: sid, file: sid + '.jpg', cap, title: pg.title, page: i.descriptionurl, licence: lic, author: strip(m.Artist?.value).slice(0, 120), kb: Math.round(statSync(out).size / 1024),
    px: execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', out]).toString().match(/\d+(?=\n)/g).map(Number) });
  console.log(sid, lic, credits.at(-1).kb + 'KB', credits.at(-1).px.join('x'));
  await sleep(1200);
}
writeFileSync(`${root}${id}/credits.json`, JSON.stringify(credits, null, 1));
writeFileSync(`${root}${id}/CREDITS.md`, `# 说书 · ${id} slide images\n\nAll from Wikimedia Commons; only public-domain or Creative Commons files are used. Resized and recompressed for phones; long handscrolls are also cut into slices (\`crop\` in the image list). No other edits. Files live in \`img/\`.\n\n` +
  credits.map(c => `- **${c.file}** — ${c.cap}. ${c.title} — ${c.author || 'unknown'} — **${c.licence}** — ${c.page}`).join('\n') + '\n');
console.log('done', credits.length);
