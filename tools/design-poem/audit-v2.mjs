#!/usr/bin/env node
// Audit for 吟诗 v2 (voices · fonts · music), at $W×$H (default 390×844). Fails on JS errors or any 4xx/5xx.
// 1. every voice in yin.json × every poem: each clip loads (200) and its decoded length matches yin.json's d within 0.15 s
//    and its marks are increasing and inside the clip.
// 2. every font × every poem: the font face loads and covers every glyph on the paper (document.fonts.check), the poem is
//    written out (?from=2, muted, fast) with every character inked; one paper screenshot per font → $OUT.
// 3. music under a strict autoplay policy: silent before the 吟 tap; a genuine touch on 吟 starts it; it ducks to ≤ 0.08 while
//    the voice speaks and comes back up between lines and while the brush writes; ♪ turns it off and remembers that.
//   W=1280 H=800 OUT=/tmp/dp2 node tools/design-poem/audit-v2.mjs
import { chrome, sleep, BASE } from '../../test/cdp.mjs';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const W = +process.env.W || 390, H = +process.env.H || 844, OUT = process.env.OUT || `/tmp/design-poem-v2-${W}`; mkdirSync(OUT, { recursive: true });
const D = new URL('../../data/design-poem/', import.meta.url), list = JSON.parse(readFileSync(new URL('list.json', D))), yin = JSON.parse(readFileSync(new URL('yin.json', D)));
const FONTS = ['zhimangxing', 'mashanzheng', 'liujianmaocao', 'longcang', 'wenkai'];
const c = await chrome({ tag: 'design-poem-v2', port: [9750, 150], keepEvents: true, args: ['--no-first-run', '--autoplay-policy=document-user-activation-required'] });
const fail = [], ok = [];
const shot = async (n, clip) => { const r = await c.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}) }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.result.data, 'base64')); };
const go = async url => { await c.send('Page.navigate', { url }); for (let k = 0; k < 60 && !(await c.ev('!!(window.__dp&&__dp.ready)')); k++) await sleep(200); };
const tap = async sel => { const p = await c.ev(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
  for (const type of ['touchStart', 'touchEnd']) await c.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: p[0], y: p[1] }] }); };
try {
  await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Network.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: W < 700 });
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  // 1. clips
  await go(BASE + 'design-poem.html?p=baidi&mute=1');
  for (const v of yin.voices) for (const p of list) {
    const r = await c.ev(`Promise.all(${JSON.stringify(yin[p.id][v.id])}.map(x=>fetch('data/design-poem/audio/yin/'+x.f).then(async q=>{if(!q.ok)return x.f+' '+q.status;
      const b=await new (window.AudioContext||webkitAudioContext)().decodeAudioData(await q.arrayBuffer());const e=[];
      if(Math.abs(b.duration-x.d)>.15)e.push(x.f+' length '+b.duration.toFixed(2)+' vs '+x.d);
      if(x.m.some((t,k)=>k&&t<=x.m[k-1])||x.m[x.m.length-1]>=x.d)e.push(x.f+' marks '+x.m);return e.join('; ')}))).then(a=>a.filter(Boolean))`);
    if (r.length) fail.push(`${v.id}/${p.id}: ${r.join(' | ')}`); else ok.push(`${v.id}/${p.id} ${yin[p.id][v.id].length} clips`);
  }
  // 2. fonts
  for (const f of FONTS) for (const p of list) {
    await go(`${BASE}design-poem.html?p=${p.id}&font=${f}&from=2&mute=1&speed=8&bgm=0`);
    await c.ev(`document.getElementById('go').click()`);
    let s; for (let k = 0; k < 150; k++) { await sleep(200); s = await c.ev('__dp.state()'); if (s.beat >= 3 && s.waiting) break; }
    await sleep(1200);
    const g = await c.ev(`(async()=>{const fam=getComputedStyle(document.documentElement).getPropertyValue('--brush').trim();await document.fonts.load('40px '+fam,'鹤');
      const txt=[...document.querySelectorAll('#paper .col i,#paper .ttl span')].map(e=>e.textContent).join('');
      const e=[];if(!document.fonts.check('40px '+fam,txt))e.push('font '+fam+' does not cover '+txt.length+' glyphs');
      const un=[...document.querySelectorAll('#paper .col i')].filter(i=>getComputedStyle(i).opacity<.9).length;if(un)e.push(un+' chars not inked');
      const cols=[...document.querySelectorAll('#paper .col')].map(c=>[...c.children].map(i=>[i.offsetLeft,i.offsetTop]));
      cols.forEach((c,k)=>{if(c.some(r=>r[0]!==c[0][0]))e.push('col '+k+' not on grid')});
      const st=document.getElementById('stage').getBoundingClientRect(),pp=document.getElementById('paper').getBoundingClientRect();
      if(pp.left<st.left-1||pp.right>st.right+1||pp.top<st.top-1||pp.bottom>st.bottom+1)e.push('paper outside stage');
      return {e,fam,clip:{x:st.left,y:st.top,width:st.width,height:st.height}}})()`);
    if (s.beat < 3) g.e.push('stuck at beat ' + s.beat);
    if (g.e.length) fail.push(`${f}/${p.id}: ${g.e.join('; ')}`); else ok.push(`${f}/${p.id} font ok`);
    await shot(`font-${f}-${p.id}`, g.clip);
  }
  // 3. music: real speed, the strict autoplay policy, genuine touches
  await go(`${BASE}design-poem.html?p=baidi&voice=${yin.voices.some(v => v.id === 'cv3') ? 'cv3' : 'shaped'}&from=2`);
  await c.ev(`localStorage.removeItem('dp.bgm')`);
  const b0 = await c.ev('__dp.state().bgm'); if (b0.playing) fail.push('music before any tap');
  await tap('#go'); const seen = { duck: [], up: [] };
  for (let k = 0; k < 160; k++) { await sleep(250); const s = await c.ev('__dp.state()');
    if (s.beat >= 3) break;
    if (s.bgm.mode === 'duck' && s.speaking) seen.duck.push(s.bgm.gain); if (s.bgm.mode === 'up') seen.up.push(s.bgm.gain); }
  const b1 = await c.ev('__dp.state().bgm');
  const duckMin = Math.min(...seen.duck.slice(4)), upMax = Math.max(...seen.up);
  if (!b1.playing || b1.ac !== 'running') fail.push('music not playing after the 吟 tap: ' + JSON.stringify(b1));
  if (!(duckMin <= 0.085)) fail.push('music did not duck under the voice (min ' + duckMin + ')');
  if (!(upMax >= 0.2)) fail.push('music did not rise between lines (max ' + upMax + ')');
  ok.push(`music: ${seen.duck.length} ducked samples (min ${duckMin}), ${seen.up.length} raised (max ${upMax})`);
  await tap('#gear'); await sleep(300); await tap('#bgmBtn'); await sleep(2500);
  const b2 = await c.ev('({b:__dp.state().bgm,ls:localStorage.getItem("dp.bgm")})');
  if (b2.b.on || b2.b.gain > 0.02 || b2.ls !== '0') fail.push('♪ off did not silence/remember: ' + JSON.stringify(b2)); else ok.push('♪ off: gain ' + b2.b.gain + ', remembered');
  await c.ev(`localStorage.removeItem('dp.bgm')`);
  const bad = c.events.filter(e => e.method === 'Network.responseReceived' && e.params.response.status >= 400).map(e => e.params.response.status + ' ' + e.params.response.url);
  if (bad.length) fail.push('HTTP errors: ' + [...new Set(bad)].join(' | '));
} finally { c.kill(); }
if (c.errs.length) fail.push('JS errors: ' + c.errs.join(' | '));
writeFileSync(`${OUT}/audit.txt`, ok.join('\n') + '\n' + (fail.length ? 'FAIL\n- ' + fail.join('\n- ') : 'PASS'));
console.log(ok.length, 'checks ok'); console.log(fail.length ? 'FAIL\n- ' + fail.join('\n- ') : `PASS ${yin.voices.length} voices × ${FONTS.length} fonts × ${list.length} poems at ${W}x${H}, shots in ${OUT}`);
process.exitCode = fail.length ? 1 : 0;
