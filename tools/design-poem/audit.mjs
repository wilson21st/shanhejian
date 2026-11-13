#!/usr/bin/env node
// Audit for the 吟诗 mock: every poem in data/design-poem/list.json, at $W×$H (default 390×844), muted + $SPEED (default 6).
// Plays each show by taps (first choice each time, one 字词 tapped), screenshots every stop, fails on JS errors, any 4xx/5xx,
// horizontal overflow, the brush font not loaded, or the poem not on a grid (same x down a column, same y across columns),
// the paper outside the stage, or a column not fully inked. Screenshots → $OUT.
//   W=1280 H=800 OUT=/tmp/dp node tools/design-poem/audit.mjs
import { chrome, sleep, BASE } from '../../test/cdp.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const W = +process.env.W || 390, H = +process.env.H || 844, SPEED = +process.env.SPEED || 6;
const OUT = process.env.OUT || `/tmp/design-poem-${W}`; mkdirSync(OUT, { recursive: true });
const list = JSON.parse(readFileSync(new URL('../../data/design-poem/list.json', import.meta.url)));
const c = await chrome({ tag: 'design-poem', port: [9700, 200], keepEvents: true });
const fail = [], bad = [];
const shot = async n => { const r = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.result.data, 'base64')); };
const overflow = () => c.ev(`(()=>{const b=[];for(const e of document.querySelectorAll('#app *,#list *')){const r=e.getBoundingClientRect();if(!r.width||e.closest('.sl'))continue;
  if(r.right>innerWidth+1||r.left<-1)b.push((e.className||e.tagName)+' '+(e.textContent||'').slice(0,10))}return b.slice(0,5)})()`);
try {
  await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 });
  const status = () => c.events.filter(e => e.method === 'Network.responseReceived' && e.params.response.status >= 400).map(e => e.params.response.status + ' ' + e.params.response.url);
  await c.send('Page.navigate', { url: BASE + 'design-poem.html' }); await sleep(1500);
  await shot('0-list'); const o = await overflow(); if (o.length) fail.push('list overflow ' + o);
  for (const p of list) {
    await c.send('Page.navigate', { url: `${BASE}design-poem.html?p=${p.id}&mute=1&speed=${SPEED}` });
    for (let k = 0; k < 40 && !(await c.ev('window.__dp&&__dp.ready')); k++) await sleep(250);
    await sleep(800); await shot(`${p.id}-0-start`);
    await c.ev(`document.getElementById('go').click()`);
    const seen = new Set(); let last = Date.now(), n = 0;
    for (;;) {
      const s = await c.ev('__dp.state()');
      if (!s) { fail.push(p.id + ': no state'); break; }
      if (s.waiting) {
        const tag = `${p.id}-${s.beat + 1}-${++n}`;
        if (s.beat === 3 && !seen.has('word')) { seen.add('word'); await c.ev('__dp.word(1)'); await sleep(400); }
        if (s.beat === 2 || s.beat === 3) { // the poem: grid + ink + font
          const g = await c.ev(`(()=>{const cols=[...document.querySelectorAll('#paper .col')].map(c=>[...c.children].map(i=>({left:i.offsetLeft,top:i.offsetTop})));  // layout boxes: v2 tilts each character on purpose
            const st=document.getElementById('stage').getBoundingClientRect(),pp=document.getElementById('paper').getBoundingClientRect(),e=[];
            cols.forEach((c,k)=>{if(c.some(r=>Math.abs(r.left-c[0].left)>1))e.push('col '+k+' not straight')});
            for(let row=0;row<cols[0].length;row++){const y=cols.map(c=>c[row]&&c[row].top).filter(v=>v!=null);if(Math.max(...y)-Math.min(...y)>1)e.push('row '+row+' not level')}
            if(pp.left<st.left-1||pp.right>st.right+1||pp.top<st.top-1||pp.bottom>st.bottom+1)e.push('paper outside stage');
            const un=[...document.querySelectorAll('#paper .col i')].filter(i=>getComputedStyle(i).opacity<.9).length;if(un)e.push(un+' chars not inked');
            return e})()`);
          if (g.length) fail.push(`${p.id} beat ${s.beat}: ${g.join('; ')}`);
          if (!s.font) fail.push(p.id + ': brush font not loaded');
        }
        await shot(tag); seen.add(s.beat);
        if (s.beat >= 6) break;
        await c.ev('__dp.choose(0)'); last = Date.now();
      }
      if (Date.now() - last > 90000) { fail.push(`${p.id}: stuck at beat ${s.beat}`); break; }
      await sleep(200);
    }
    const o = await overflow(); if (o.length) fail.push(`${p.id} overflow ${o}`);
    const st = await c.ev('__dp.state()');
    console.log(p.id, 'beats seen', [...seen].filter(x => typeof x === 'number').join(','), 'stat', JSON.stringify(st.stat));
    if (st.stat.ink < (await c.ev('document.querySelectorAll("#paper i").length'))) fail.push(p.id + ': ink count low');
  }
  bad.push(...status());
} finally { c.kill(); }
if (c.errs.length) fail.push('JS errors: ' + c.errs.join(' | '));
if (bad.length) fail.push('HTTP errors: ' + [...new Set(bad)].join(' | '));
console.log(fail.length ? 'FAIL\n- ' + fail.join('\n- ') : `PASS ${list.length} poems at ${W}x${H}, shots in ${OUT}`);
process.exitCode = fail.length ? 1 : 0;
