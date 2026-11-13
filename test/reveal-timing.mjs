#!/usr/bin/env node
// 人物 ▶ playback timing: plays 李白 from his first stop at 390×844 (CPU ÷4) and samples, every frame, the protagonist
// portrait's screen position and the year label. Fails when the portrait teleports or the year runs backward.
//
//   node test/reveal-timing.mjs [seconds=40]      # server on 127.0.0.1:7814 (HS_URL overrides)
//
// Metrics (playing frames only):
//   jump    largest per-frame move of the portrait in px, and how many frames moved > 12 px (budget: max ≤ 40, > 12 on ≤ 1%)
//   back    frames where the year went backward (budget 0)
//   stall   longest stretch (s) with neither the portrait moving > 0.5 px nor the year changing (budget ≤ 4.5 s)
//   drop    frames longer than 25 ms (reported) and p95 frame time
//   hidden  frames with the portrait hidden while playing (budget 0)
import { chrome, sleep, BASE } from './cdp.mjs';

const SEC = +process.argv[2] || 40;
const c = await chrome({ tag: 'reveal-timing', port: [9250, 90], args: ['--window-size=390,844'] });
let fail = 0;
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
  await c.send('Page.navigate', { url: BASE }); await sleep(5000);
  await c.ev('__m3.person("libai",0)'); await sleep(2500);
  await c.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const r = await c.ev(`new Promise(ok=>{const pm=document.querySelector('.pmark:not(.o)'),tld=document.getElementById('tld'),S=[];
    document.getElementById('play').click();const t0=performance.now();
    const f=n=>{const tr=pm.hidden?null:pm.style.translate.split(' ').map(parseFloat),y=+(tld.textContent.match(/公元(\\d+)年/)||[])[1];
      S.push([n,tr,y,document.getElementById('play').textContent==='⏸']);if(n-t0<${SEC * 1000})requestAnimationFrame(f);else ok(S)};requestAnimationFrame(f)})`);
  await c.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  let maxJ = 0, big = 0, back = 0, hid = 0, drop = 0, n = 0, still = 0, maxStill = 0; const dts = [];
  for (let k = 1; k < r.length; k++) {
    const [t, q, y, on] = r[k], [t1, q1, y1] = r[k - 1]; if (!on) continue; n++;
    const dt = t - t1; dts.push(dt); if (dt > 25) drop++;
    if (!q) { hid++; continue; }
    const j = q1 ? Math.hypot(q[0] - q1[0], q[1] - q1[1]) : 0; if (j > maxJ) maxJ = j; if (j > 12) big++;
    if (y < y1) back++;
    if (j > .5 || y !== y1) still = 0; else { still += dt; if (still > maxStill) maxStill = still; }
  }
  dts.sort((a, b) => a - b);
  const yrs = r.filter(s => s[3]).map(s => s[2]), M = { frames: n, maxJump: +maxJ.toFixed(1), over12: big, over12pct: +(big / n * 100).toFixed(1), back, stallS: +(maxStill / 1000).toFixed(2), drop, p95ms: +dts[Math.floor(dts.length * .95)].toFixed(1), hidden: hid, years: `${yrs[0]}→${yrs[yrs.length - 1]}`, errs: c.errs.length };
  console.log(JSON.stringify(M));
  const bad = [];
  if (M.maxJump > 40) bad.push(`max jump ${M.maxJump}px > 40`); if (M.over12pct > 1) bad.push(`${M.over12pct}% frames > 12px`);
  if (back) bad.push(`year backward ${back}×`); if (M.stallS > 4.5) bad.push(`stall ${M.stallS}s`); if (hid) bad.push(`portrait hidden ${hid} frames`); if (c.errs.length) bad.push('js errors: ' + c.errs[0]);
  fail = bad.length; console.log(fail ? 'FAIL: ' + bad.join('; ') : 'PASS: playback is continuous');
} finally { c.kill(); }
process.exit(fail ? 1 : 0);
