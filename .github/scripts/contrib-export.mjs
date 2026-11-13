#!/usr/bin/env node
// contrib-export.mjs <in> <out>: check a GET /api/contrib payload and write it as data/contrib-d1.json, stable
// (sorted by id, no timestamp of its own) so an unchanged store makes no commit. Run by .github/workflows/contrib-export.yml.
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2);
const j = JSON.parse(readFileSync(inp, 'utf8'));
for (const k of ['places', 'events', 'poems', 'shuoshu']) if (!(k in j)) { console.error(`payload has no "${k}"`); process.exit(1); }
const byId = a => [...a].sort((x, y) => x.id < y.id ? -1 : 1);
const snap = { note: 'Snapshot of https://shanhejian.pages.dev/api/contrib (community contributions added through /mcp). Written nightly by .github/workflows/contrib-export.yml; the site reads the live API first.',
  places: Object.fromEntries(Object.entries(j.places).sort()), events: byId(j.events), poems: byId(j.poems), shuoshu: byId(j.shuoshu) };
writeFileSync(out, JSON.stringify(snap, null, 1) + '\n');
console.log(`events ${snap.events.length}, poems ${snap.poems.length}, shuoshu ${snap.shuoshu.length}, places ${Object.keys(snap.places).length}`);
