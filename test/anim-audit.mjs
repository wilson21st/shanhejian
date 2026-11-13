#!/usr/bin/env node
// Animation smoothness audit for the six event-card icons (kAnim in index.html: 战 政 外 治 文 天).
// For every running CSS animation it pauses the animation and steps currentTime frame by frame (60 fps) across all
// iterations, reading the computed transform / opacity / stroke-dashoffset. Any single-frame change above the limits
// below is a visible jump — most often the snap back to 0% when a loop restarts (keyframes whose 0% and 100% differ).
//   node test/anim-audit.mjs        # server on 127.0.0.1:7814 (HS_URL overrides)
import { chrome, sleep, BASE } from './cdp.mjs';
// matrix numbers are parsed with exponents (4.15e-06) kept whole — splitting them made phantom 30px jumps
// per-frame limits at 60 fps — beyond these the eye reads a jump, not motion
const LIMIT = { angle: 6, scale: 0.09, tx: 1.6, ty: 1.6, opacity: 0.2, dash: 0.1 };

const PROBE = (LIMIT) => {
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99;background:#fff';
  const kinds = ['mil', 'pol', 'dip', 'gov', 'cul', 'nat'];
  box.innerHTML = kinds.map(k => `<span data-k="${k}">${__m3.kAnim(k, '#333')}</span>`).join(''); document.body.appendChild(box);
  const read = el => { const cs = getComputedStyle(el), m = cs.transform; let a = 0, sc = 1, tx = 0, ty = 0;
    if (m && m !== 'none') { const v = m.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number); a = Math.atan2(v[1], v[0]) * 180 / Math.PI; sc = Math.hypot(v[0], v[1]); tx = v[4]; ty = v[5]; }
    return { angle: a, scale: sc, tx, ty, opacity: +cs.opacity, dash: parseFloat(cs.strokeDashoffset) || 0 }; };
  const out = [];
  for (const span of box.children) for (const el of span.querySelectorAll('*')) for (const an of el.getAnimations()) {
    const t = an.effect.getComputedTiming(), dur = t.duration, n = t.iterations, end = (t.delay || 0) + dur * n;
    an.pause(); let prev = null, worst = {}, worstAt = {};
    for (let ms = 0; ms <= end + 1; ms += 1000 / 60) { an.currentTime = Math.min(ms, end); const r = read(el);
      if (prev) for (const k in r) { let d = Math.abs(r[k] - prev[k]); if (k === 'angle') d = Math.min(d, 360 - d); if (d > (worst[k] || 0)) { worst[k] = d; worstAt[k] = Math.round(ms); } }
      prev = r; }
    const bad = Object.keys(worst).filter(k => worst[k] > LIMIT[k]);
    out.push({ kind: span.dataset.k, el: (el.getAttribute('class') || el.tagName), anim: an.animationName, dur, n,
      worst: Object.fromEntries(Object.entries(worst).filter(([, v]) => v > 1e-3).map(([k, v]) => [k, +v.toFixed(3)])),
      bad: bad.map(k => `${k} ${worst[k].toFixed(2)} > ${LIMIT[k]} at ${worstAt[k]}ms`) });
  }
  box.remove(); return out;
};

const cdp = await chrome({ tag: 'anim-audit', port: [9733, 200], args: ['--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), { send } = cdp;
let code = 1;
try {
  await send('Page.enable'); await send('Page.navigate', { url: BASE + '?anim=' + Date.now() });
  for (let k = 0; k < 100; k++) { await sleep(300); const q = await send('Runtime.evaluate', { expression: '!!(window.__m3&&__m3.kAnim)', returnByValue: true }); if (q.result?.result?.value) break; }
  const r = await send('Runtime.evaluate', { expression: `(${PROBE})(${JSON.stringify(LIMIT)})`, returnByValue: true });
  const rows = r.result?.result?.value; if (!rows) throw new Error(JSON.stringify(r.result?.exceptionDetails || r).slice(0, 300));
  let bad = 0;
  for (const x of rows) { const tag = x.bad.length ? '✗' : '✓'; if (x.bad.length) bad++;
    console.log(`${tag} ${x.kind.padEnd(4)} ${x.el.padEnd(6)} ${x.anim.padEnd(6)} ${x.dur}ms×${x.n}  ${x.bad.length ? x.bad.join('; ') : JSON.stringify(x.worst)}`); }
  console.log(bad ? `FAIL: ${bad} animation(s) jump between frames` : `PASS: ${rows.length} animations, no frame-to-frame jump`);
  code = bad ? 1 : 0;
} finally { cdp.kill(); }
process.exit(code);
