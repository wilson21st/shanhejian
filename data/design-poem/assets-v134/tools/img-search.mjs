// Batch Commons image search: node img-search.mjs queries.txt > out.txt
// queries.txt lines: "<tag>\t<query>"; prints tag | title | WxH | licence | short desc
import { readFileSync } from 'node:fs';
import { api, info } from './commons.mjs';
const lines = readFileSync(process.argv[2], 'utf8').trim().split('\n').filter(l => l && !l.startsWith('#'));
const seen = new Set();
for (const l of lines) {
  const [tag, q] = l.split('\t');
  let j; try { j = await api({ action: 'query', list: 'search', srnamespace: 6, srlimit: 15, srsearch: q + ' filetype:bitmap' }); } catch { console.log('## ERR', tag, q); continue; }
  const ts = j.query.search.map(x => x.title).filter(t => !seen.has(t));
  ts.forEach(t => seen.add(t));
  console.log(`## ${tag}\t${q}\t(${ts.length})`);
  for (let i = 0; i < ts.length; i += 15) {
    for (const x of await info(ts.slice(i, i + 15))) {
      const ok = /public domain|^cc0|^pd/i.test(x.licence) || /^cc by \d/i.test(x.licence);
      if (!ok || Math.min(x.w, x.h) < 500) continue;
      console.log(`  ${x.title.slice(5, 110)} | ${x.w}x${x.h} | ${x.licence} | ${x.desc.slice(0, 90)}`);
    }
  }
}
