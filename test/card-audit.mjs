#!/usr/bin/env node
// Card placement audit (Wilson 2026-11-05: "信息框永远固定喺左手边…要喺相应嘅地方…发生地点要 glow…定义 evaluation metrics").
// Walks every timeline step on a phone and a desktop viewport, with the camera over the event's place, and measures the
// event card against its place. Metrics (each a share of steps; budget in brackets):
//   on-place   the place lies within the card's horizontal span, ±8px            [≥95%; misses only at a screen edge]
//   above      the card's bottom edge is above the place, so the card never hides it  [100%]
//   lead       a lead line runs from the card's bottom edge to the place (±4px)      [100%]
//   glow       a glow sits on the place (±4px) and no card covers its centre          [100%]
//   capital    no card overlaps the capital plaque                                    [100%]
//   on-screen  the card is fully inside the viewport                                  [100%]
//   no-stack   no two cards overlap                                                    [100%]
//   centred    every part of the place marker (rings, dot, shadow) is centred on the place, ±1px  [100%]
//   steady     camera still: the new card's placed position never jumps more than 4px between two frames in
//              its first 1.5s, and it never appears first somewhere it then leaves (pop-in slide excluded) [100%]
//   dx median  median |card centre − place| in px (reported, lower is better)
//   node test/card-audit.mjs [phone|desktop]
import { chrome, sleep, BASE } from './cdp.mjs';
const VIEWS = { phone: { w: 390, h: 844, dpr: 2, mobile: true, dist: 520 }, desktop: { w: 1440, h: 900, dpr: 1, mobile: false, dist: 700 } };
const BUDGET = { 'on-place': .95, above: 1, lead: 1, glow: 1, centred: 1, capital: 1, 'on-screen': 1, 'no-stack': 1, steady: 1 };
async function run(name) {
  const V = VIEWS[name];
  const cdp = await chrome({ tag: 'card', port: [9400, 200] }), { send, ev } = cdp;
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: V.dpr, mobile: V.mobile });
    await send('Page.enable'); await send('Page.navigate', { url: BASE + '?cards=' + Date.now() + (process.env.HS_QS || '') });
    for (let k = 0; k < 100; k++) { await sleep(300); if (await ev('!!(window.__m3&&__m3.cards)')) break }
    await ev('__m3.story(false);__m3.yaw(0)');
    const steps = await ev('__m3.steps()'), hit = Object.fromEntries(Object.keys(BUDGET).map(k => [k, 0])), miss = Object.fromEntries(Object.keys(BUDGET).map(k => [k, []])), dxs = [], jumps = []; let n = 0;
    for (const st of steps) {
      if (!st.ll) continue;
      // park the camera over the place first, so the only motion left is the card's own
      await ev(`__m3.go(${st.ll[0]},${st.ll[1]},${V.dist})`); await sleep(st.step ? 700 : 1200);
      const jump = await ev(`new Promise(res=>{__m3.tl(${st.step});const t0=performance.now(),xs=[];let prev=null,mx=0,first=null;
        (function f(){const e=[...document.querySelectorAll('.lb.pop')].pop();if(e&&getComputedStyle(e).display!=='none'){const tr=(e.style.translate||'').split(' ').map(parseFloat),o=+getComputedStyle(e).opacity;
          // the card's placed position (its translate), not its painted box: the 12px pop-in slide is by design, and on a
          // busy first load one dropped frame can advance it ~10px at once, which is not the card moving
          if(o>0.05&&tr.length===2&&!isNaN(tr[1])){const c=tr;if(!first)first=c;if(prev)mx=Math.max(mx,Math.hypot(c[0]-prev[0],c[1]-prev[1]));prev=c}}
          if(performance.now()-t0<1500)requestAnimationFrame(f);else res({mx,drift:first&&prev?Math.hypot(prev[0]-first[0],prev[1]-first[1]):0})})()})`);
      await sleep(100);
      const S = await ev('__m3.cards()'); const c = S.cards.find(c => c.step === st.step) || S.cards[S.cards.length - 1]; if (!c) continue; n++;
      const [l, t, r, b] = c.r, inX = c.ax >= l - 8 && c.ax <= r + 8, edge = c.ax < (r - l) / 2 + 12 || c.ax > S.vw - (r - l) / 2 - 12;
      const ok = {
        'on-place': inX || edge,
        above: b <= c.ay - 4,
        lead: S.leads.some(([x1, y1, x2, y2]) => Math.abs(x2 - c.ax) < 4 && Math.abs(y2 - c.ay) < 4 && y1 >= b - 3 && y1 <= b + 3 && x1 >= l - 1 && x1 <= r + 1),
        glow: S.glow.some(([x, y]) => Math.abs(x - c.ax) < 4 && Math.abs(y - c.ay) < 4) && !S.cards.some(k => c.ax > k.r[0] && c.ax < k.r[2] && c.ay > k.r[1] && c.ay < k.r[3]),
        capital: !S.cap || !S.cards.some(k => k.r[0] < S.cap[2] - 1 && k.r[2] > S.cap[0] + 1 && k.r[1] < S.cap[3] - 1 && k.r[3] > S.cap[1] + 1),
        'on-screen': l >= 0 && t >= 0 && r <= S.vw && b <= S.vh,
        centred: S.pinOff <= 1,
        steady: jump.mx <= 4 && jump.drift <= 4,
        'no-stack': !S.cards.some((a, i) => S.cards.some((k, j) => j > i && a.r[0] < k.r[2] - 2 && a.r[2] > k.r[0] + 2 && a.r[1] < k.r[3] - 2 && a.r[3] > k.r[1] + 2)),
      };
      dxs.push(Math.abs((l + r) / 2 - c.ax)); jumps.push(jump.mx);
      for (const k in ok) if (ok[k]) hit[k]++; else if (miss[k].length < 4) miss[k].push(`${st.id} ${c.t}${k === 'steady' ? ` (${jump.mx.toFixed(0)}px/${jump.drift.toFixed(0)}px)` : ''}`);
    }
    dxs.sort((a, b) => a - b); jumps.sort((a, b) => a - b);
    return { name, n, hit, miss, dx: dxs[Math.floor(dxs.length / 2)] || 0, jmax: jumps[jumps.length - 1] || 0, j95: jumps[Math.floor(jumps.length * .95)] || 0 };
  } finally { cdp.kill() }
}
let bad = 0;
for (const name of process.argv[2] ? [process.argv[2]] : Object.keys(VIEWS)) {
  const o = await run(name); console.log(`\n== ${name}: ${o.n} steps, median |card centre − place| ${o.dx.toFixed(0)}px, largest frame-to-frame card jump p95 ${o.j95.toFixed(1)}px / max ${o.jmax.toFixed(1)}px`);
  for (const k in BUDGET) { const sh = o.hit[k] / Math.max(1, o.n), pass = sh >= BUDGET[k]; if (!pass) bad++;
    console.log(`${pass ? '✓' : '✗'} ${k.padEnd(10)} ${(sh * 100).toFixed(0).padStart(3)}%  (≥${BUDGET[k] * 100}%)${pass ? '' : '  e.g. ' + o.miss[k].join(' | ')}`) }
}
console.log(bad ? `\nFAIL: ${bad} metric(s) under budget` : '\nPASS: every card sits on its place');
process.exit(bad ? 1 : 0);
