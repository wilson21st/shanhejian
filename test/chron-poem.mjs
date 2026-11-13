#!/usr/bin/env node
// v133 (Wilson 2026-11-11 14:06: a poem opened from 编年体 looked old, no voice): in the chronicle, tap a poem card itself (a real
// mouse tap on the inscription, not the 吟 button) → the brush show opens over the map (design-poem.html?…&v=133), its card and
// sheet say 有声, and the recitation plays (audio clips > 0, ink > 0). 390×844.   node test/chron-poem.mjs [ids…]
import { chrome, sleep, BASE } from './cdp.mjs';
const POEM_V = (await import('node:fs')).readFileSync(new URL('../js/timeline.js', import.meta.url), 'utf8').match(/POEM_V='(\d+)'/)[1];   // the show URL carries the current version
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ['p23', 'p20', 'p01', 'p12', 'p05', 'p11'];
const c = await chrome({ tag: 'chronpoem', port: [9600, 80], args: ['--window-size=390,844', '--autoplay-policy=no-user-gesture-required'] });
const F = `document.querySelector('#scrollOv iframe')`;
let bad = 0;
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await c.send('Page.navigate', { url: BASE }); await sleep(6000);
  for (const id of IDS) {
    await c.ev(`__m3.tlId("${id}")`); await sleep(1500);
    // headless frames are slow, so the chronicle's camera ease may not reach the place: centre it there, as a user would pan
    await c.ev(`(async()=>{const ev=__m3.poemById("${id}");if(!ev)return;let ll=ev.ll;if(!ll){for(const f of ['data/world.json','data/era.json','data/poems.json']){const j=await fetch(f).then(r=>r.json()).catch(()=>null);const p=j&&j.places&&j.places[ev.place];if(p&&p.ll){ll=p.ll;break}}}
      const vis=[...document.querySelectorAll('.lb.pop.poem')].some(e=>getComputedStyle(e).display!=='none');if(ll&&!vis)__m3.go(ll[0],ll[1],700)})()`);
    // a visible spot of the card's inscription that a finger would really hit (not under the 回目 panel, not the 吟 button)
    let card = null; for (let k = 0; k < 40 && !card; k++) { await sleep(500);
      card = await c.ev(`(()=>{const e=document.querySelector('.lb.pop.poem');if(!e||getComputedStyle(e).display==='none')return null;const r=(e.querySelector('.pv')||e).getBoundingClientRect();
        for(let fy=.3;fy<1;fy+=.1)for(const fx of [.5,.3,.7]){const x=r.x+r.width*fx,y=r.y+r.height*fy,h=document.elementFromPoint(x,y);if(h&&e.contains(h)&&!h.closest('.yinb,.pnx'))return {x,y,label:(e.querySelector('.yinb small')||{}).textContent||''}}return null})()`); }
    if (!card) { bad++; console.log(id, 'FAIL no poem card'); continue; }
    for (const type of ['mousePressed', 'mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: card.x, y: card.y, button: 'left', buttons: type === 'mousePressed' ? 1 : 0, clickCount: 1 });
    let s = null, url = null; const t0 = Date.now();
    for (; Date.now() - t0 < 25000;) { await sleep(1000);
      [url, s] = await c.ev(`(()=>{const f=${F};const w=f&&f.contentWindow;return [f&&f.src,w&&w.__dp?w.__dp.state():null]})()`) || [];
      if (s && s.stat && s.stat.clips > 0 && s.ink > 0) break; }
    const sheet = await c.ev(`!!document.getElementById('wikiOv')`);
    const ok = !!url && new RegExp('v='+POEM_V).test(url) && s && s.stat.clips > 0 && s.ink > 0 && card.label === '有声' && !sheet;
    if (!ok) bad++;
    console.log(id, ok ? 'PASS' : 'FAIL', JSON.stringify({ label: card.label, sheet, url: url && url.replace(/^.*\//, ''), clips: s && s.stat.clips, ink: s && s.ink, beat: s && s.beat, speaking: s && s.speaking, font: s && s.fontId }));
    await c.ev(`postMessage({type:'closeScroll'},'*')`); await sleep(3000);
  }
  console.log('fails', bad, 'errs', c.errs.length, JSON.stringify(c.errs.slice(0, 3)));
} finally { c.kill(); }
process.exit(bad || c.errs.length ? 1 : 0);
