#!/usr/bin/env node
// Performance (non-functional) audit for the map, on the real GPU (headless Chrome uses Metal on this Mac).
// Two device profiles × five scenarios, each measured over a few seconds:
//   idle      the opening view, nothing touched           pan      drag + wheel zoom over the overview
//   play      the timeline playing (cards popping)         city     zoomed on 长安, dragging among city names
//   story     a 说书 card opened: the fly-down and the unroll over the map, then 「← 大地图」 rolls it up (v120)
// Metrics per scenario (from an rAF wrapper injected before the page, the longtask observer and CDP Performance):
//   fps        frames per second actually delivered
//   p95        95th-percentile frame interval (ms) — what a stutter feels like
//   jank       share of frames longer than 50 ms (a visible hitch)
//   js95       95th-percentile main-thread script time inside one animation frame (ms)
//   layout/f   forced or style-driven layouts per frame (layout thrash shows up here)
//   lt         long tasks (>50 ms) during the scenario
// Load: time until the map is interactive. Memory: JS heap growth across the play scenario, and label DOM count.
// Budgets below; any miss fails the run.   node test/perf-audit.mjs [desktop|mobile]
import { chrome, sleep, BASE } from './cdp.mjs';

const PROFILES = {
  // a laptop: 1440×900 at 2×, full CPU
  desktop: { w: 1440, h: 900, dpr: 2, mobile: false, cpu: 1,
    budget: { load: 4000, fps: 55, p95: 22, jank: .01, js95: 8, layout: 1.2, lt: 2, heap: 20 } },
  // a phone proxy: 390×844 at 3×, touch, CPU slowed 4× (Chrome's usual stand-in for a mid phone)
  mobile: { w: 390, h: 844, dpr: 3, mobile: true, cpu: 4,
    budget: { load: 9000, fps: 30, p95: 45, jank: .05, js95: 20, layout: 1.2, lt: 6, heap: 20 } },
};

// injected before any page script: wraps requestAnimationFrame to time each frame's callbacks
const PROBE = `(()=>{const P=window.__perf={on:false,t:[],js:[]};const raf=window.requestAnimationFrame.bind(window);let cur=null;
  window.requestAnimationFrame=cb=>raf(ts=>{const s=performance.now();try{cb(ts)}finally{if(P.on){if(cur!==ts){cur=ts;P.t.push(ts);P.js.push(0)}P.js[P.js.length-1]+=performance.now()-s}}});
  P.lt=[];try{new PerformanceObserver(l=>{if(P.on)for(const e of l.getEntries())P.lt.push(e.duration)}).observe({type:'longtask'})}catch(e){}})();`;

async function run(name) {
  const PF = PROFILES[name];
  const cdp = await chrome({ tag: 'perf', port: [9100, 300],
    args: ['--no-first-run', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc', `--window-size=${PF.w},${PF.h}`] }), { send, ev } = cdp;
  const out = { name, rows: [], fails: [] };
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: PF.w, height: PF.h, deviceScaleFactor: PF.dpr, mobile: PF.mobile });
    if (PF.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Emulation.setCPUThrottlingRate', { rate: PF.cpu });
    await send('Performance.enable'); await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
    const t0 = Date.now(); await send('Page.navigate', { url: BASE + (process.env.HS_PAGE || '') + '?perf=' + Date.now() + (process.env.HS_QS || '') });
    for (let k = 0; k < 300; k++) { await sleep(100); if (await ev('!!(window.__m3&&window.__m3.tlId)')) break; }
    const load = Date.now() - t0; await sleep(2500);
    const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).result.metrics.map(m => [m.name, m.value]));
    // input helpers: a drag is a press, ~N moves one frame apart, a release (touch on the phone profile)
    // desktop: the map pans with the RIGHT button (left turns it, Wilson 2026-11-07 20:01); the scroll overlay drags with the left
    const drag = async (x0, y0, x1, y1, n = 40, btn = 'right') => { const bs = btn === 'right' ? 2 : 1;
      if (PF.mobile) { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
        for (let i = 1; i <= n; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n }] }); await sleep(16); }
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); return; }
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: btn, buttons: bs, clickCount: 1 });
      for (let i = 1; i <= n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, button: btn, buttons: bs }); await sleep(16); }
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: btn, clickCount: 1 }); };
    const wheel = async (dy, n = 12) => { for (let i = 0; i < n; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: PF.w / 2, y: PF.h / 2, deltaX: 0, deltaY: dy }); await sleep(30); } };
    const W = PF.w, H = PF.h;
    const SC = {
      idle: async () => { await sleep(4000); },
      pan: async () => { await drag(W * .3, H * .5, W * .7, H * .45); await wheel(-120); await drag(W * .7, H * .4, W * .35, H * .55); await wheel(120); },
      play: async () => { await ev('__m3.tlId("s581")'); await sleep(500); await ev('__m3.play()'); await sleep(8000); await ev('__m3.play()'); },
      city: async () => { await ev('__m3.go(108.9,34.3,320)'); await sleep(1500); await drag(W * .3, H * .5, W * .7, H * .5); await drag(W * .7, H * .5, W * .3, H * .45); },
      story: async () => { await ev('__m3.tlId("s756")'); await sleep(2000); await ev('document.querySelector(".lb.scrollc").click()');
        for (let k = 0; k < 60 && !(await ev('!!document.querySelector("#scrollOv.open")')); k++) await sleep(100);
        await sleep(2500); await ev('document.querySelector("#scrollOv iframe").contentDocument.getElementById("home").click()'); await sleep(2500); },
    };
    let heap0 = 0, heap1 = 0, dom0 = 0, dom1 = 0;
    for (const [sc, fn] of Object.entries(SC)) {
      if (sc === 'play') { await ev('window.gc&&gc()'); heap0 = (await metrics()).JSHeapUsedSize; dom0 = await ev('document.querySelectorAll("#lab .lb").length'); }
      const m0 = await metrics(); await ev('Object.assign(__perf,{on:true,t:[],js:[],lt:[]})');
      await fn();
      const r = await ev('(()=>{__perf.on=false;return {t:__perf.t,js:__perf.js,lt:__perf.lt}})()'); const m1 = await metrics();
      if (sc === 'play') { await ev('window.gc&&gc()'); heap1 = (await metrics()).JSHeapUsedSize; dom1 = await ev('document.querySelectorAll("#lab .lb").length'); }
      const dt = r.t.slice(1).map((t, i) => t - r.t[i]).sort((a, b) => a - b), js = [...r.js].sort((a, b) => a - b);
      const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN;
      const span = (r.t[r.t.length - 1] - r.t[0]) / 1000, n = r.t.length;
      const row = { sc, fps: n / Math.max(span, .001), p95: q(dt, .95), jank: dt.filter(x => x > 50).length / Math.max(1, dt.length), js95: q(js, .95),
        layout: (m1.LayoutCount - m0.LayoutCount) / Math.max(1, n), lt: r.lt.length };
      out.rows.push(row);
      const B = PF.budget;
      if (row.fps < B.fps) out.fails.push(`${sc} fps ${row.fps.toFixed(1)} < ${B.fps}`);
      if (row.p95 > B.p95) out.fails.push(`${sc} p95 ${row.p95.toFixed(1)}ms > ${B.p95}`);
      if (row.jank > B.jank) out.fails.push(`${sc} jank ${(row.jank * 100).toFixed(1)}% > ${B.jank * 100}%`);
      if (row.js95 > B.js95) out.fails.push(`${sc} js95 ${row.js95.toFixed(1)}ms > ${B.js95}`);
      if (row.layout > B.layout) out.fails.push(`${sc} layout/frame ${row.layout.toFixed(2)} > ${B.layout}`);
      if (row.lt > B.lt) out.fails.push(`${sc} long tasks ${row.lt} > ${B.lt}`);
    }
    out.load = load; out.heap = (heap1 - heap0) / 1048576; out.dom = [dom0, dom1];
    if (load > PF.budget.load) out.fails.push(`load ${load}ms > ${PF.budget.load}`);
    if (out.heap > PF.budget.heap) out.fails.push(`heap +${out.heap.toFixed(1)}MB > ${PF.budget.heap}`);
    if (dom1 > dom0 + 15) out.fails.push(`label DOM grew ${dom0}→${dom1}`);
    out.info = await ev('window.__m3.info?__m3.info():null');
  } finally { cdp.kill(); await sleep(400); }
  return out;
}

const which = process.argv[2] ? [process.argv[2]] : Object.keys(PROFILES);
let bad = 0;
for (const name of which) {
  const o = await run(name), B = PROFILES[name].budget;
  console.log(`\n== ${name} (${PROFILES[name].w}×${PROFILES[name].h} @${PROFILES[name].dpr}x, CPU ÷${PROFILES[name].cpu}) — load ${o.load}ms, heap +${o.heap.toFixed(1)}MB, labels ${o.dom.join('→')}${o.info ? ', ' + JSON.stringify(o.info) : ''}`);
  console.log('scenario   fps    p95ms  jank   js95ms  layout/f  longtasks');
  for (const r of o.rows) console.log(`${r.sc.padEnd(9)} ${r.fps.toFixed(1).padStart(5)}  ${r.p95.toFixed(1).padStart(6)}  ${(r.jank * 100).toFixed(1).padStart(4)}%  ${r.js95.toFixed(1).padStart(6)}  ${r.layout.toFixed(2).padStart(7)}  ${String(r.lt).padStart(5)}`);
  console.log(`budget    ≥${B.fps}   ≤${B.p95}   ≤${B.jank * 100}%   ≤${B.js95}    ≤${B.layout}     ≤${B.lt}`);
  if (o.fails.length) { bad++; console.log('✗ ' + o.fails.join('\n✗ ')); } else console.log('✓ all budgets met');
}
console.log(bad ? `\nFAIL: ${bad} profile(s) over budget` : '\nPASS: every profile within budget');
process.exit(bad ? 1 : 0);
