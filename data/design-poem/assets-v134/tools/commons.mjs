// Commons API helper with backoff. node commons.mjs cat "<Category>" | search "<q>" [ns] | info "File:…"
const UA = { 'User-Agent': 'history-sandbox/1.0 (edu project; https://github.com/wilson21st/shanhejian)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function api(p) {
  await sleep(1500);
  for (let k = 0; k < 8; k++) {
    const r = await fetch('https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...p }), { headers: UA });
    const t = await r.text();
    if (r.ok && t.startsWith('{')) return JSON.parse(t);
    await sleep(8000 * (k + 1));
  }
  throw new Error('api failed ' + JSON.stringify(p));
}
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
export async function info(titles) {
  const j = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size|extmetadata|mime', iiurlwidth: 400, titles: [].concat(titles).join('|') });
  return Object.values(j.query.pages).map(pg => { const i = pg.imageinfo?.[0] || {}, m = i.extmetadata || {};
    return { title: pg.title, url: i.url?.split("?")[0], thumb: i.thumburl?.split("?")[0], w: i.width, h: i.height, mime: i.mime, dur: i.duration, size: i.size, page: i.descriptionurl,
      licence: strip(m.LicenseShortName?.value), author: strip(m.Artist?.value).slice(0, 160), desc: strip(m.ImageDescription?.value).slice(0, 200), date: strip(m.DateTimeOriginal?.value).slice(0, 40) }; });
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const [cmd, q, ns = '6'] = process.argv.slice(2);
  if (cmd === 'cat') { const j = await api({ action: 'query', list: 'categorymembers', cmlimit: 500, cmtitle: 'Category:' + q }); for (const x of j.query.categorymembers) console.log(x.title); }
  if (cmd === 'search') { const j = await api({ action: 'query', list: 'search', srnamespace: ns, srlimit: 50, srsearch: q }); for (const x of j.query.search) console.log(x.title); }
  if (cmd === 'info') { for (const x of await info(q.split('|'))) console.log(JSON.stringify(x)); }
}
