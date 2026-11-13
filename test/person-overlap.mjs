#!/usr/bin/env node
// v133 人物传 card ↔ portrait (Wilson 2026-11-11 13:14: the card kept covering the protagonist's round portrait).
// Phone 390×844: for each person, ▶ the whole life at 2× from the first stop and, every frame, intersect the portrait
// (.pmark) with every map card on show (.lb.pop, displayed). Counts frames where any card overlaps the portrait by more
// than 1 px, and frames where a card pokes off the screen. PASS = 0 and 0 for every person.
//   node test/person-overlap.mjs [ids…]      default: lishimin libai dufu wangwei
import { chrome, sleep, BASE } from './cdp.mjs';
const IDS = process.argv.slice(2).filter(a => !a.startsWith('--')), CAP = 260;
const ids = IDS.length ? IDS : ['lishimin', 'libai', 'dufu', 'wangwei'];
const c = await chrome({ tag: 'person-overlap', port: [9700, 80], args: ['--window-size=390,844', '--autoplay-policy=no-user-gesture-required'] });
let bad = 0;
const SAMPLER = `(()=>{const S=window.__ov={frames:0,over:0,off:0,ex:[],exOff:[],cards:0};const R=e=>e.getBoundingClientRect();
  const f=()=>{const pm=document.querySelector('.pmark');if(pm&&!pm.hidden){S.frames++;const a=R(pm);let o=false,off=false;
    for(const e of document.querySelectorAll('#lab .lb.pop')){if(e.style.display==='none'||e.style.visibility==='hidden')continue;const b=R(e);if(!b.width||+getComputedStyle(e).opacity<.05)continue;S.cards++;
      const ix=Math.min(a.right,b.right)-Math.max(a.left,b.left),iy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
      if(ix>1&&iy>1){o=true;if(S.ex.length<6)S.ex.push({t:e.innerText.replace(/\\s+/g,' ').slice(0,24),ix:+ix.toFixed(0),iy:+iy.toFixed(0),drag:e.classList.contains('dragging'),op:getComputedStyle(e).opacity})}
      if(b.left<-1||b.top<-1||b.right>innerWidth+1||b.bottom>innerHeight+1){off=true;if(S.exOff.length<6)S.exOff.push({t:e.innerText.replace(/\\s+/g," ").slice(0,24),r:[b.left,b.top,b.right,b.bottom].map(Math.round),op:getComputedStyle(e).opacity})}}
    if(o)S.over++;if(off)S.off++}S.raf=requestAnimationFrame(f)};f()})()`;
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  for (const id of ids) {
    const e0 = c.errs.length;
    await c.send('Page.navigate', { url: BASE }); await sleep(5000);
    await c.ev(`__m3.person(${JSON.stringify(id)},0)`); await sleep(2500);
    await c.ev(`document.getElementById('spd').click()`);   // 1× → 2×
    await c.ev(SAMPLER); await c.ev('__m3.play()');
    const t0 = Date.now(); let st;
    for (;;) { await sleep(2000); st = await c.ev('__m3.pstate()');
      const n = await c.ev(`document.querySelectorAll('#lab .lb.pop').length`);
      if (!st.playing && Date.now() - t0 > 8000) break; if (Date.now() - t0 > CAP * 1000) break; void n; }
    const S = await c.ev('(()=>{cancelAnimationFrame(__ov.raf);return __ov})()');
    const ok = S.over === 0 && S.off === 0 && c.errs.length === e0;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${id}: ${S.frames} frames (${((Date.now() - t0) / 1000).toFixed(0)} s, stop ${st.i}${st.playing ? ' still playing at cap' : ' end'}), card-frames ${S.cards}, overlap frames ${S.over}, off-screen frames ${S.off}, js errors ${c.errs.length - e0}${S.ex.length ? ' e.g. ' + JSON.stringify(S.ex) : ''}${S.exOff.length ? ' off e.g. ' + JSON.stringify(S.exOff) : ''}`);
  }
} finally { c.kill(); }
console.log(bad ? `person-overlap: ${bad} FAIL` : 'person-overlap: PASS');
process.exitCode = bad ? 1 : 0;
