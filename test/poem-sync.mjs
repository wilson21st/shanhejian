#!/usr/bin/env node
// 吟诗 ink ↔ voice sync, for poems opened from the map (design-poem.html?id=…&embed=1) at 390×844, CPU ÷4.
// Plays the recitation with sound (headless autoplay) and logs, per frame, when each character's brush stroke starts
// and when each line's voice clip starts. Per poem:
//   pause   longest gap between two consecutive characters starting (reading order), s   (budget ≤ 1.5)
//   cv      coefficient of variation of those gaps (one clock → near 0)                   (budget ≤ 0.35)
//   back    characters that started before the one before them in reading order           (budget 0)
//   lead    voice start − its column's first stroke, s (ink leads the voice: ≥ 0, budget −0.1…2.5)
//   errs    JS errors (budget 0)
//   node test/poem-sync.mjs [ids…]      default: p13 q05 p06 p23
import { chrome, sleep, BASE } from './cdp.mjs';
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ['p13', 'q05', 'p06', 'p23'];
const c = await chrome({ tag: 'poem-sync', port: [9420, 60], args: ['--window-size=390,844', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__au=[];const _p=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){if(this.volume>0&&/audio\\/yin\\//.test(this.src))__au.push([performance.now(),this.src.split('/').pop()]);return _p.call(this)}` });
  for (const id of IDS) {
    const e0 = c.errs.length;
    await c.send('Page.navigate', { url: `${BASE}design-poem.html?id=${id}&embed=1&bgm=0` });
    for (let k = 0; k < 60 && !(await c.ev('!!(window.__dp&&__dp.ready)')); k++) await sleep(200);
    await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const r = await c.ev(`new Promise(ok=>{const T=new Map(),t0=performance.now();let last=t0;
      const f=()=>{const n=performance.now();document.querySelectorAll('#paper .col i.ink').forEach(e=>{if(T.has(e))return;
          const a=e.getAnimations().find(x=>x.animationName==='write');if(a&&a.currentTime!=null&&a.currentTime>=(a.effect.getTiming().delay||0))T.set(e,n)});
        const all=document.querySelectorAll('#paper .col i').length;if(T.size&&T.size>=all){if(n-last>1500)return ok(done())}else last=n;
        if(n-t0>120000)return ok(done());requestAnimationFrame(f)};
      const done=()=>({ch:[...T].map(([e,t])=>[+e.dataset.l,+e.dataset.p,t]),n:document.querySelectorAll('#paper .col i').length,au:__au,
        hv:document.querySelector('.eh')?.textContent||''});requestAnimationFrame(f)})`);
    await c.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    const ch = r.ch.sort((a, b) => a[0] - b[0] || a[1] - b[1]), gaps = [];
    let back = 0;
    for (let k = 1; k < ch.length; k++) { const g = (ch[k][2] - ch[k - 1][2]) / 1000; if (g < -0.02) back++; gaps.push(g); }
    const m = gaps.reduce((a, b) => a + b, 0) / (gaps.length || 1), cv = Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / (gaps.length || 1)) / (m || 1);
    const pause = Math.max(0, ...gaps);
    const col0 = l => Math.min(...ch.filter(x => x[0] === l).map(x => x[2]));
    const leads = r.au.map(([t, f], i) => (t - col0(i)) / 1000);
    const errs = c.errs.length - e0;
    const bad = r.ch.length < r.n || pause > 1.5 || cv > 0.35 || back || errs || !r.au.length || leads.some(x => x < -0.1 || x > 2.5);
    if (bad) fail++;
    console.log(`${bad ? 'FAIL' : 'ok  '} ${id} ${r.hv} · chars ${r.ch.length}/${r.n} · pause ${pause.toFixed(2)}s · cv ${cv.toFixed(3)} · back ${back} · voice clips ${r.au.length} · lead ${leads.map(x => x.toFixed(2)).join(' ')} · errs ${errs}`);
    if (errs) console.log('   ', c.errs.slice(e0).join('\n    '));
  }
} finally { c.kill(); }
console.log(fail ? `${fail} poem(s) FAIL` : 'all ok');
process.exit(fail ? 1 : 0);
