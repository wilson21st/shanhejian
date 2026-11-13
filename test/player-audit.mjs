#!/usr/bin/env node
// v132 one player (css/player.css + js/player.js): 说书 ×3 and a poem from the map, at 390×844 (mobile), CPU ÷4.
// Each page plays for $SEC s (default 25; questions answered by the first choice). Per page:
//   pic     the picture (#stage) as % of the screen height
//   lines   most lines the subtitle band (#sub) ever showed, counted from the text's own line boxes (budget ≤ 3)
//   frames  median / p95 frame ms and frames > 25 ms while playing
//   errs    JS errors (budget 0)
// then the same page under prefers-reduced-motion (errors, subtitle still advancing, lines ≤ 3). Screenshots → $OUT.
//   node test/player-audit.mjs                   BEFORE=1 HS_URL=http://127.0.0.1:7815/ → only pic % (the old pages)
import { chrome, sleep, BASE } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const SEC = +process.env.SEC || 25, OUT = process.env.OUT || '/tmp/player-audit', BEFORE = process.env.BEFORE === '1';
mkdirSync(OUT, { recursive: true });
const PAGES = [['xuanwumen', 'shuoshu.html?s=xuanwumen&auto=1'], ['weishui', 'shuoshu.html?s=weishui&auto=1'], ['mawei', 'shuoshu.html?s=mawei&auto=1'],
  ['poem-q05', 'design-poem.html?id=q05&embed=1&bgm=0'], ['poem-baidi', 'design-poem.html?p=baidi&auto=1&bgm=0']];
const c = await chrome({ tag: 'player-audit', port: [9480, 60], args: ['--window-size=390,844', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
const shot = async n => { const r = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.result.data, 'base64')); };
const SAMPLE = `new Promise(ok=>{const F=[],L=[],T=new Set();let p=performance.now();const t0=p;
  const lines=()=>{const t=document.querySelector('#sub .tx');if(!t||!t.textContent.trim())return 0;const r=document.createRange();r.selectNodeContents(t);
    const tops=[];for(const b of r.getClientRects()){if(b.width<1)continue;if(!tops.some(y=>Math.abs(y-b.top)<b.height/2))tops.push(b.top)}return tops.length};
  const f=n=>{F.push(n-p);p=n;L.push(lines());const s=document.querySelector('#sub .tx');if(s)T.add(s.textContent);
    if(window.__ss){const w=__ss.state();if(w.waiting&&!w.speaking)__ss.choose(0)}
    if(document.getElementById('choices')?.childElementCount&&window.__dp){const w=__dp.state();if(w.waiting&&w.waiting.length>1&&!/回地图|换一首/.test(w.waiting[0]))__dp.choose(0)}
    if(n-t0<${SEC * 1000})requestAnimationFrame(f);else ok({F:F.slice(5),maxL:Math.max(0,...L),texts:T.size})};requestAnimationFrame(f)})`;
const PIC = `(()=>{const s=document.getElementById('stage').getBoundingClientRect();return +(100*s.height/innerHeight).toFixed(1)})()`;
const ready = () => c.ev(`!!((window.__ss&&document.getElementById('start').classList.contains('off'))||(window.__dp&&__dp.ready&&document.getElementById('start').classList.contains('off')))`);
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  for (const rm of BEFORE ? [false] : [false, true]) {
    await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: rm ? 'reduce' : 'no-preference' }] });
    for (const [name, url] of PAGES) {
      const e0 = c.errs.length;
      await c.send('Page.navigate', { url: BASE + url });
      for (let k = 0; k < 50 && !(await ready()); k++) await sleep(200);
      await sleep(3000);
      if (BEFORE) { console.log(`before ${name} pic ${await c.ev(PIC)}%`); await shot('before-' + name); continue; }
      await c.send('Emulation.setCPUThrottlingRate', { rate: rm ? 1 : 4 });
      const r = await c.ev(SAMPLE);
      await c.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const pic = await c.ev(PIC), st = await c.ev('PL.stat()'), F = r.F.sort((a, b) => a - b);
      const med = F[F.length >> 1], p95 = F[Math.floor(F.length * .95)], slow = F.filter(x => x > 25).length, errs = c.errs.length - e0;
      const bad = errs || r.maxL > 3 || st.maxLines > 3 || r.texts < 2;
      if (bad) fail++;
      console.log(`${bad ? 'FAIL' : 'ok  '} ${rm ? 'reduced ' : ''}${name} · pic ${pic}% · lines max ${r.maxL} (PL ${st.maxLines}, paged ${st.pages}, subs ${st.subs}, cards ${st.cards})` +
        (rm ? '' : ` · frames median ${med.toFixed(1)} p95 ${p95.toFixed(1)} >25ms ${slow}/${F.length}`) + ` · errs ${errs}`);
      if (errs) console.log('   ', c.errs.slice(e0).join('\n    '));
      await shot((rm ? 'rm-' : '') + name);
    }
  }
} finally { c.kill(); }
console.log(fail ? `${fail} FAIL` : 'all ok');
process.exit(fail ? 1 : 0);
