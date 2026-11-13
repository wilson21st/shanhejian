// Download BGM candidates → /tmp/bgmraw/<id>.<ext> + raw-meta.json (source, licence, author, page)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { info } from './commons.mjs';
import { execFileSync } from 'node:child_process';
const UA = { 'User-Agent': 'Mozilla/5.0 (history-sandbox personal edu)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const dir = new URL('../raw/bgm/', import.meta.url).pathname; mkdirSync(dir, { recursive: true });
const L = JSON.parse(readFileSync(new URL('./bgm-candidates.json', import.meta.url)));
const metaF = dir + 'raw-meta.json';
const meta = existsSync(metaF) ? JSON.parse(readFileSync(metaF)) : {};
const unhtml = s => s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
const SKIP = (process.env.SKIP || "").split(",");
for (const c of L.filter(c => (!process.env.SRC || c.src === process.env.SRC) && !SKIP.includes(c.id))) {
  if (meta[c.id]?.file && existsSync(dir + meta[c.id].file)) continue;
  let m;
  if (c.src === 'commons') {
    const [i] = await info(c.title);
    m = { source: 'Wikimedia Commons', title: c.title, page: i.page, url: i.url, licence: i.licence, author: i.author, desc: i.desc };
  } else {
    const [u, id] = c.u.split('/');
    const page = `https://freesound.org/people/${u}/sounds/${id}/`;
    const t = await (await fetch(page, { headers: UA })).text();
    const lic = (t.match(/(Creative Commons 0|Attribution NonCommercial [0-9.]+|Attribution [0-9.]+)/) || [])[1];
    const url = (t.match(/https:\/\/cdn\.freesound\.org\/previews\/[^"]+-hq\.mp3/) || [])[0];
    const name = unhtml((t.match(/<title>Freesound - ([^<]*) by [^<]*<\/title>/) || [])[1] || '');
    const desc = unhtml(((t.match(/id="soundDescriptionSection"[\s\S]*?<p>([\s\S]*?)<\/p>/) || [])[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 300);
    m = { source: 'Freesound', title: name, page, url, licence: lic === 'Creative Commons 0' ? 'CC0 1.0' : lic?.replace('Attribution', 'CC BY'), author: u, desc, note: 'Freesound public HQ preview (128 kbps mp3), no login' };
  }
  const ext = m.url.match(/\.(\w+)$/)[1];
  // curl: capped at 6 MB / 120 s (≈6 min of a 128k preview is plenty for a bed; partial file still decodes)
  try { execFileSync('curl', ['-s', '-A', 'Mozilla/5.0', '--max-time', '120', '-r', '0-6000000', '-o', dir + c.id + '.' + ext, m.url]); } catch (e) { if (!existsSync(dir + c.id + '.' + ext)) { console.log('FAIL', c.id); continue; } m.partial = true; }
  meta[c.id] = { ...m, file: c.id + '.' + ext };
  writeFileSync(metaF, JSON.stringify(meta, null, 1));
  console.log(c.id, m.licence, m.title);
  await sleep(1200);
}
