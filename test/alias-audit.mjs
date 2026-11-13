#!/usr/bin/env node
// Jaggies audit (Wilson 2026-11-07: "沙盘一左一右有锯齿"). The map's left and right edges are the two 绫 rolls lying across the
// desk; seen in perspective they are long slanted lines, and without anti-aliasing their outline is a staircase. For each roll
// this finds the outer silhouette along the projected roll (one perpendicular profile per screen pixel along it: the
// gradient-weighted centre of the strongest edge in a band just outside the roll's axis), fits a smooth line through those edge
// positions (a ±12-sample moving average), and reports the RMS of what is left (worst 10% trimmed), in render-target px (the page draws at its render scale and
// stretches to the screen). A clean anti-aliased edge leaves
// ~0.05 px; a staircase leaves ~0.3 px of a device pixel. Also scores the mount's near and far edges the same way.
//   node test/alias-audit.mjs [phone|desktop|all] [stage: song|default|all] [shotDir]
import { chrome, sleep, BASE } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { decodePNG } from './png.mjs';
const VIEWS = { phone: { w: 390, h: 844, dpr: 3, mobile: true }, desktop: { w: 1440, h: 900, dpr: 1, mobile: false }, win125: { w: 1536, h: 864, dpr: 1.25, mobile: false } };
const [VA = 'all', SA = 'all', OUT] = process.argv.slice(2);
// render px RMS. The default page's rolls lie on a painted paper sky of nearly their own tone, and its fibre texture leaves
// ~0.18 px of wobble even with every ink line switched off (checked 2026-11-07), so it gets a looser budget; a staircase is 0.3–1.5
const BUDGETS = { song: .12, default: .25 };
if (OUT) mkdirSync(OUT, { recursive: true });
// the rolls: axis at x = ±(MW/2+78+4), y 6, radius 12, z ±(MH/2+34+2); the mount's long edges at z ±(MH/2+34), y −6
const PWd = 1400 + 156, PHd = 816 + 68, RX = PWd / 2 + 4, RZ = PHd / 2 + 2;
const EDGES = { left: { a: [-RX, 6, -RZ], b: [-RX, 6, RZ], out: [-1, 0, 0], r: 12 }, right: { a: [RX, 6, -RZ], b: [RX, 6, RZ], out: [1, 0, 0], r: 12 } };
const POSES = {
  out: '__m3.yaw(0);__m3.tilt(0);__m3.go(107.5,35,9e9)',
  mid: '__m3.yaw(0);__m3.tilt(0);__m3.go(107.5,35,1500)',
  turned: '__m3.yaw(.45);__m3.tilt(0);__m3.go(107.5,35,1700)',
  low: '__m3.yaw(-.25);__m3.go(107.5,35,1800);__m3.tilt(-1)',
  side: '__m3.yaw(1.45);__m3.tilt(0);__m3.go(107.5,35,9e9)', // turned a quarter: the rolls run across a phone's screen
};
function jag(img, scale, A, B, O) {
  // A, B: projected roll axis ends; O: projected point one radius outward from A (sets the band and the outward side)
  const { w: W, h: H, lum } = img, ax = A[0] * scale, ay = A[1] * scale, bx = B[0] * scale, by = B[1] * scale;
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L; let nx = -uy, ny = ux;
  const ro = (O[0] * scale - ax) * nx + (O[1] * scale - ay) * ny; if (ro < 0) { nx = -nx; ny = -ny }
  const rp = Math.max(2, Math.abs(ro)), lo = rp * .3, hi = rp * 2.2 + 6;
  const S = (x, y) => { const i = Math.floor(x), j = Math.floor(y); if (i < 0 || j < 0 || i >= W - 1 || j >= H - 1) return NaN; const fx = x - i, fy = y - j;
    return (lum[j * W + i] * (1 - fx) + lum[j * W + i + 1] * fx) * (1 - fy) + (lum[(j + 1) * W + i] * (1 - fx) + lum[(j + 1) * W + i + 1] * fx) * fy };
  const pos = [], str = [];
  for (let t = L * .12; t < L * .88; t += 1) {
    const cx = ax + ux * t, cy = ay + uy * t, prof = [];
    for (let s = lo; s <= hi; s += .25) prof.push([s, S(cx + nx * s, cy + ny * s)]);
    if (prof.some(p => isNaN(p[1]))) { pos.push(NaN); str.push(0); continue }
    // strongest edge: the largest luminance step over 1 px; its gradient-weighted centre within ±1.5 px
    let best = 0, bs = 0; for (let k = 4; k < prof.length; k++) { const g = Math.abs(prof[k][1] - prof[k - 4][1]); if (g > best) { best = g; bs = (prof[k][0] + prof[k - 4][0]) / 2 } }
    str.push(best); if (best < 12) { pos.push(NaN); continue }
    let sw = 0, sx = 0; for (let k = 1; k < prof.length; k++) { const s = (prof[k][0] + prof[k - 1][0]) / 2; if (Math.abs(s - bs) > 1.5) continue; const g = Math.abs(prof[k][1] - prof[k - 1][1]); sw += g; sx += g * s }
    pos.push(sw ? sx / sw : NaN);
  }
  // profiles where something else crosses the roll (the 带, a label) have an edge of a different strength: left out
  const ms = [...str].filter(Boolean).sort((a, b) => a - b)[Math.floor(str.filter(Boolean).length / 2)] || 0;
  for (let i = 0; i < pos.length; i++) if (str[i] < ms * .6 || str[i] > ms * 1.6) pos[i] = NaN;
  const res = []; for (let i = 0; i < pos.length; i++) { if (isNaN(pos[i])) continue; let s = 0, n = 0; for (let k = -12; k <= 12; k++) { const v = pos[i + k]; if (v !== undefined && !isNaN(v)) { s += v; n++ } } if (n > 12) res.push(pos[i] - s / n) }
  const good = res.length / Math.max(1, pos.length);
  // trimmed: the worst 10% are dropped, so a feature crossing the roll (the 带 ribbon, a label) does not count; a staircase is everywhere
  const tr = res.map(Math.abs).sort((a, b) => a - b).slice(0, Math.ceil(res.length * .9));
  return { rms: tr.length ? Math.sqrt(tr.reduce((a, b) => a + b * b, 0) / tr.length) : NaN, n: res.length, good, len: L };
}
async function run(view, stage) {
  const V = VIEWS[view], rows = [];
  const cdp = await chrome({ tag: 'alias', port: [9620, 140], args: ['--use-angle=metal'] }), { send, ev, errs } = cdp;
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: V.dpr, mobile: V.mobile });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const r=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>r(t=>cb(window.__ft!=null?window.__ft:t))})()` });
    await send('Page.navigate', { url: `${BASE}${process.env.HS_PAGE || ''}?alias=${Date.now()}${process.env.HS_QS || ''}` });
    for (let k = 0; k < 100; k++) { await sleep(300); if (await ev('!!(window.__m3&&__m3.tilt&&__m3.rs)')) break }
    if (process.env.HS_EVAL) await ev(process.env.HS_EVAL);
    await ev(`__m3.story&&__m3.story(false);document.head.insertAdjacentHTML('beforeend','<style>body>*:not(canvas){visibility:hidden!important}</style>')`);
    await sleep(2500);
    // the render scale the page would settle on with time to spare (the governor is paused so every view is measured alike)
    const rs = await ev(`(()=>{const c=Math.min(Math.min(2,devicePixelRatio),Math.sqrt((__m3.info().aa?2.0e6:2.6e6)/(innerWidth*innerHeight)));__m3.rs(Math.max(1,c));return __m3.rs()+' msaa '+__m3.info().aa})()`);
    await ev('window.__ft=performance.now()');
    const raf = 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))';
    for (const [pose, js] of Object.entries(POSES).filter(([k]) => !process.env.HS_POSE || process.env.HS_POSE.split(',').includes(k))) {
      await ev(js); await ev(raf); await sleep(200); await ev(raf);
      const s = await send('Page.captureScreenshot', { format: 'png' }), buf = Buffer.from(s.result.data, 'base64'), img = decodePNG(buf), scale = img.w / V.w;
      if (OUT) writeFileSync(`${OUT}/alias-${stage}-${view}-${pose}.png`, buf);
      const row = { view, stage, pose };
      for (const [name, E] of Object.entries(EDGES)) {
        const P = JSON.parse(await ev(`JSON.stringify([${JSON.stringify(E.a)},${JSON.stringify(E.b)},[${E.a[0] + E.out[0] * E.r},${E.a[1]},${E.a[2]}]].map(q=>__m3.pw(...q)))`));
        if (P.some(p => p[2] > 1 || p[2] < -1)) continue;
        const r = jag(img, scale, P[0], P[1], P[2]); if (r.n < 40 || r.good < .5) continue;
        row[name] = r.rms * parseFloat(rs) / scale; row[name + 'n'] = r.n; // in render-target px (a phone draws at 2× and shows at 3×)
      }
      rows.push(row);
    }
    if (errs.length) rows.push({ view, stage, err: errs.slice(0, 2).join(' | ') });
    rows.rs = rs;
  } finally { cdp.kill(); await sleep(400) }
  return rows;
}
let bad = 0;
const views = VA === 'all' ? ['phone', 'desktop', 'win125'] : VA.split(','), stages = ['song']; // the 书院 is the only stage since 2026-11-07 (the old default and ?stage= are gone); the arg is kept for old command lines
for (const st of stages) for (const vw of views) {
  const rows = await run(vw, st), BUDGET = BUDGETS[st] ?? .12;
  console.log(`\n== jaggies ${st} / ${vw} (render scale ${rows.rs}; RMS wobble of the roll outline about a smooth line, render px; budget ${BUDGET})`);
  for (const r of rows) {
    if (r.err) { bad++; console.log('✗ JS errors:', r.err); continue }
    const parts = ['left', 'right'].map(k => { if (r[k] === undefined) return `${k} —`; const ok = r[k] <= BUDGET; if (!ok) bad++; return `${ok ? ' ' : '✗'}${k} ${r[k].toFixed(3)} (${r[k + 'n']})` });
    console.log(`${r.pose.padEnd(7)} ${parts.join('   ')}`);
  }
}
console.log(bad ? `\nFAIL ${bad} over budget` : '\nPASS'); process.exit(bad ? 1 : 0);
