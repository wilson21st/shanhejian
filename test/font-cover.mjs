#!/usr/bin/env node
// 吟诗 font coverage (v133): every map poem (design-poem.html?id=…&embed=1) written in ONE brush font, no glyph from a fallback.
// Opens each poem with reduced motion (the whole paper at once), then asks Chrome which platform fonts actually drew each
// brush element (CSS.getPlatformFontsForNode): the paper's title, poet, every character, the seal text and the title overlay.
// A poem fails if any of them used a font other than the brush font the page chose, or if two brush fonts were mixed —
// except v136's per-glyph fallback: 纔 浥 鄜 咷 (志莽行书 lacks them) must come from 霞鹜臻楷, exactly once per occurrence.
//   node test/font-cover.mjs [ids…]      default: all 46 poems in poems.json + person-poems.json
import { readFileSync } from 'node:fs';
import { chrome, sleep, BASE } from './cdp.mjs';
const root = new URL('../', import.meta.url).pathname;
const ALL = [...new Set([...JSON.parse(readFileSync(root + 'data/poems.json')).events, ...JSON.parse(readFileSync(root + 'data/person-poems.json')).poems].map(e => e.id))];
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const FB = /ZhenKai|臻楷/, FBCH = /[纔浥鄜咷]/g;
const FAM = { zhimangxing: 'Zhi Mang Xing', mashanzheng: 'Ma Shan Zheng', liujianmaocao: 'Liu Jian Mao Cao', longcang: 'Long Cang', wenkai: 'LXGW WenKai' };
const c = await chrome({ tag: 'font-cover', port: [9480, 60], args: ['--window-size=390,844'] });
let fail = 0, glyphs = 0, missing = 0; const switched = [];
try {
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('DOM.enable'); await c.send('CSS.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const id of IDS) {
    const e0 = c.errs.length;
    await c.send('Page.navigate', { url: `${BASE}design-poem.html?id=${id}&embed=1&mute=1&bgm=0` });
    for (let k = 0; k < 80 && !(await c.ev(`!!(window.__dp&&__dp.ready&&document.querySelector('#paper .col i'))`)); k++) await sleep(150);
    await c.ev('document.fonts.ready.then(()=>1)'); await sleep(150);
    const st = await c.ev('__dp.state()');
    const { root: doc } = (await c.send('DOM.getDocument', { depth: 0 })).result;
    const { nodeIds } = (await c.send('DOM.querySelectorAll', { nodeId: doc.nodeId, selector: '#paper .ttl span, #paper .ttl small, #paper .col i, #paper div.seal, #title .t' })).result;
    const used = new Map(); let bad = [], stray = 0;
    for (const n of nodeIds) {
      const f = (await c.send('CSS.getPlatformFontsForNode', { nodeId: n })).result?.fonts || [];
      if (f.some(x => FB.test(x.familyName))) { const { outerHTML } = (await c.send('DOM.getOuterHTML', { nodeId: n })).result; if (!FBCH.test(outerHTML.replace(/<[^>]*>/g, ''))) stray++; FBCH.lastIndex = 0 }
      for (const x of f) used.set(x.familyName, (used.get(x.familyName) || 0) + x.glyphCount);
      glyphs += f.reduce((a, x) => a + x.glyphCount, 0);
    }
    const want = FAM[st.fontId], nfb = (await c.ev(`[...document.querySelectorAll('#paper .ttl span,#paper .ttl small,#paper .col i,#title .t')].map(e=>e.textContent).join('')`)).match(FBCH)?.length || 0;
    const gotFb = [...used].filter(([k]) => FB.test(k)).reduce((a, [, g]) => a + g, 0);   // a cell counts its ::before bleed copy too
    const other = [...used].filter(([k]) => k !== want && !FB.test(k)); if (stray || !!gotFb !== !!nfb) other.push(['fallback ' + gotFb + ' for ' + nfb + ' glyph(s), stray ' + stray, gotFb]);
    missing += other.reduce((a, [, g]) => a + g, 0);
    const errs = c.errs.length - e0;
    if (other.length || errs || !used.size) { fail++; bad = other; }
    if (st.fontWhy) switched.push(`${id} → ${st.fontId}（${st.fontWhy}）`);
    console.log(`${other.length || errs || !used.size ? 'FAIL' : 'ok  '} ${id} font ${st.fontId}${st.fontWhy ? ' (switched: ' + st.fontWhy + ')' : ''} · ${[...used].map(([k, g]) => k + ' ' + g).join(', ')}${bad.length ? ' · FALLBACK ' + JSON.stringify(bad) : ''}${errs ? ' · errs ' + errs + ' ' + c.errs.slice(e0).join(' | ') : ''}`);
  }
} finally { c.kill(); }
console.log(`poems ${IDS.length} · glyphs drawn ${glyphs} · glyphs from a fallback font ${missing} · switched ${switched.length}: ${switched.join('; ')}`);
console.log(fail ? `${fail} poem(s) FAIL` : 'all ok');
process.exit(fail ? 1 : 0);
