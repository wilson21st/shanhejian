#!/usr/bin/env node
// Entry hit audit (v139, Wilson 2026-11-13: 一入去只有「吟诗」按得到，返回大地图都按唔到). Other audits press buttons with
// el.click(), which skips hit-testing, so a full-screen layer over a button never showed. This one opens each scroll from the
// map the way a tap does — with autoplay refused, as on an iPhone, so the 吟 / 开书 start layer is up — and then
//   1. hit-tests every visible button and link inside the scroll at its centre (elementFromPoint must be that control)
//   2. taps with real input events (touch on the phone, mouse on desktop): 🔊 flips to 🔇, ❚❚ starts the poem,
//      and ✕ 回地图 / ← 大地图 rolls the scroll up.
// Cases: poem p23 (recorded voice, start layer), poem p05 (written, no start layer), 说书 玄武门 (开书 layer).
// Phone 390×844 touch and desktop 1440×900.   node test/entry-hit-audit.mjs
import { chrome, sleep, BASE } from './cdp.mjs';
const VIEWS = [['phone', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }], ['desktop', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }]];
const c = await chrome({ tag: 'entryhit', port: [9300, 200], args: ['--autoplay-policy=document-user-activation-required'] }), { send, ev } = c;
let bad = 0, n = 0; const ok = (t, msg) => { n++; if (!t) bad++; console.log(`${t ? '✓' : '✗'} ${msg}`); };
const waitFor = async (expr, ms = 15000) => { for (let k = 0; k < ms / 100; k++) { if (await ev(expr)) return true; await sleep(100); } return false; };
const D = 'document.querySelector("#scrollOv iframe").contentDocument';
// every visible, enabled control in the scroll, with its centre and what is actually under that centre
const HITS = `(()=>{const d=${D},w=d.defaultView,o=[];for(const b of d.querySelectorAll('button,a,[role=button]')){const r=b.getBoundingClientRect(),s=w.getComputedStyle(b);
  if(!r.width||!r.height||s.visibility==='hidden'||s.display==='none'||b.disabled||b.closest('[hidden],.off,#set:not(.on),#cmp'))continue;
  const x=r.left+r.width/2,y=r.top+r.height/2;if(x<0||y<0||x>w.innerWidth||y>w.innerHeight)continue;
  let vis=1;for(let e=b;e;e=e.parentElement){const cs=w.getComputedStyle(e);if(+cs.opacity===0){vis=0;break}}if(!vis)continue;
  const h=d.elementFromPoint(x,y);o.push({t:(b.id?'#'+b.id+' ':'')+(b.textContent||b.getAttribute('aria-label')||'').trim().slice(0,12),x:Math.round(x),y:Math.round(y),
    hit:!!h&&(h===b||b.contains(h)),under:h?(h.id?'#'+h.id:h.tagName.toLowerCase()+(h.className&&typeof h.className==='string'?'.'+h.className.split(' ')[0]:'')):null})}
  return JSON.stringify(o)})()`;
async function tap(x, y, touch) {
  if (touch) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] }); await sleep(60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
  else { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 }); }
  await sleep(300);
}
const ctr = sel => ev(`(()=>{const e=${D}.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return JSON.stringify([r.left+r.width/2,r.top+r.height/2])})()`).then(s => s && JSON.parse(s));
async function open(vn, how) {
  await send('Page.navigate', { url: BASE + 'index.html?entryhit=' + Date.now() });
  await waitFor('!!(window.__m3&&__m3.tlId&&document.getElementById("rng").max>0)', 40000); await sleep(2000);
  if (how === 'story') { await ev('__m3.tlId("e0629")'); await sleep(3500); await ev('document.querySelector(".lb.scrollc").click()'); }
  else await ev(`__m3.poem(${JSON.stringify(how)})`);
  const o = await waitFor('!!document.querySelector("#scrollOv.open")', 20000);
  await waitFor(`!!(${D}.readyState==="complete"&&(${D}.defaultView.__dp?${D}.defaultView.__dp.ready:${D}.getElementById("stitle")&&${D}.getElementById("stitle").textContent))`, 10000);
  await sleep(1800); return o;
}
try {
  await send('Page.enable'); await send('Runtime.enable');
  for (const [vn, vm] of VIEWS) {
    await send('Emulation.setDeviceMetricsOverride', vm); await send('Emulation.setTouchEmulationEnabled', { enabled: vm.mobile });
    for (const [how, back, label] of [['p23', '#top .xb', 'poem p23 (有声)'], ['p05', '#top .xb', 'poem p05 (书写)'], ['story', '#home', '说书 玄武门']]) {
      ok(await open(vn, how), `${vn} ${label}: scroll opens`);
      const gate = await ev(`!${D}.getElementById("start").classList.contains("off")`);
      console.log(`  start layer up: ${gate}`);
      const H = JSON.parse(await ev(HITS) || '[]'), miss = H.filter(h => !h.hit);
      ok(H.length >= 2 && !miss.length, `${vn} ${label}: ${H.length} visible controls hit-testable${miss.length ? ' — blocked: ' + miss.map(h => `${h.t} (under ${h.under})`).join(', ') : ''}`);
      // 🔊 → 🔇 with a real tap
      const s = await ctr('#snd'); if (s) { const t0 = await ev(`${D}.getElementById("snd").textContent`); await tap(s[0], s[1], vm.mobile);
        const t1 = await ev(`${D}.getElementById("snd").textContent`); ok(t0 !== t1, `${vn} ${label}: tap 🔊 toggles (${t0} → ${t1})`); await tap(s[0], s[1], vm.mobile); }
      if (how === 'p23' && gate) { const p = await ctr('#pp'); await tap(p[0], p[1], vm.mobile);
        ok(await waitFor(`${D}.getElementById("start").classList.contains("off")`, 3000), `${vn} ${label}: tap ❚❚ before 吟 starts the poem`);
        ok(/暂停/.test(await ev(`${D}.getElementById("pp").textContent`)), `${vn} ${label}: …and it is not left paused`); }
      if (how === 'story' && gate) { const p = await ctr('#pp'); await tap(p[0], p[1], vm.mobile);
        ok(await waitFor(`${D}.getElementById("start").classList.contains("off")`, 3000), `${vn} ${label}: tap ❚❚ before 开书 opens the book`);
        ok(!(await ev(`${D}.defaultView.__ss.state().paused`)), `${vn} ${label}: …and it is not left paused`); }
      // the way home, with a real tap
      const b = await ctr(back); ok(!!b, `${vn} ${label}: back control ${back} exists`);
      if (b) { await tap(b[0], b[1], vm.mobile); ok(await waitFor('!document.getElementById("scrollOv")', 5000), `${vn} ${label}: tap ${back} rolls the scroll up`); }
      // and once more with the start layer still up: back must work before anything else is pressed
      if (gate) { await open(vn, how); const b2 = await ctr(back); await tap(b2[0], b2[1], vm.mobile);
        ok(await waitFor('!document.getElementById("scrollOv")', 5000), `${vn} ${label}: tap ${back} first thing (start layer up) rolls the scroll up`); }
    }
  }
} finally { c.kill(); }
console.log(bad ? `FAIL ${bad}/${n}` : `PASS ${n}/${n}`); process.exit(bad ? 1 : 0);
