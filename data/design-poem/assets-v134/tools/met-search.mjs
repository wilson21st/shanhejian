// Met open access (CC0) search, Asian Art dept: node met-search.mjs "q1" "q2" …
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = { 'User-Agent': 'Mozilla/5.0 (history-sandbox personal edu)' };
async function j(u) { for (let k = 0; k < 4; k++) { try { const r = await fetch(u, { headers: UA }); if (r.ok) return await r.json(); } catch {} await sleep(3000 * (k + 1)); } return {}; }
for (const q of process.argv.slice(2)) {
  const s = await j(`https://collectionapi.metmuseum.org/public/collection/v1.1/search?departmentId=6&hasImages=true&limit=25&q=${encodeURIComponent(q)}`);
  console.log(`## ${q} (${s.total || 0})`);
  for (const id of (s.objectIDs || []).slice(0, 25)) {
    const o = await j(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    if (!o.isPublicDomain || !/China/i.test(o.culture + o.country)) continue;
    console.log(`  met${id} | ${o.title?.slice(0, 80)} | ${o.objectName} | ${o.artistDisplayName} | ${o.objectDate} | ${o.classification} | ${o.primaryImage ? 'img' : '-'}`);
    await sleep(250);
  }
}
