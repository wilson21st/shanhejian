#!/usr/bin/env node
// Flicker audit (Wilson 2026-11-07: "转动嘅时候张席同埋窗嗰幅墙闪下闪下"). Turns the camera in tiny yaw steps and looks for
// pixels that blink: with time frozen (rAF gets a fixed timestamp, so smoke, birds and clouds hold still) and the render
// scale pinned, a 0.1° turn only slides the picture a fraction of a pixel, so a pixel's brightness should drift one way.
// A pixel that goes up then straight back down (or down then up) by more than T between three consecutive frames is a
// blink — z-fighting between coplanar layers, or a texture pattern finer than a pixel shimmering. The score is blinks
// per thousand pixel-frames (‰), over the whole canvas outside the map (all), over the map itself (map: terrain, ink
// outlines and the mount, a looser budget) and inside named regions (projected world quads: the 席 top and
// the window wall on ?stage=song). DOM labels are hidden so only the WebGL canvas is measured.
//   node test/flicker-audit.mjs [phone|desktop|all] [stage: song|default|all] [outDir]
// Writes per-pose heat maps (white = blinked) to outDir when given. Budget: region and whole-frame ≤ BUDGET ‰.
import { chrome, sleep, BASE } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { decodePNG, encodeGrey, inPoly } from './png.mjs';
const VIEWS = { phone: { w: 390, h: 844, dpr: 2, mobile: true }, desktop: { w: 1440, h: 900, dpr: 1, mobile: false } };
const [VA = 'all', SA = 'all', OUT] = process.argv.slice(2);
const T = 20, N = 9, STEP = .0003, BUDGET = { all: .6, mat: .5, wall: .5, map: 3 };
if (OUT) mkdirSync(OUT, { recursive: true });
const FY = -370, BACK = -1500;
const REG = {
  song: { mat: [[-1350, FY + 6, -900], [1350, FY + 6, -900], [1350, FY + 6, 1900], [-1350, FY + 6, 1900]],
          wall: [[-3400, FY, BACK], [3400, FY, BACK], [3400, FY + 3400, BACK], [-3400, FY + 3400, BACK]] },
  default: {},
};
// the desk (box hull) is cut out of the 席 region; the map (mount and rolls) is scored on its own
const DESK = [-1150, 1150].flatMap(x => [FY, 30].flatMap(y => [-560, 560].map(z => [x, y, z])));
const MAP = [-806, 806].flatMap(x => [-12, 20].flatMap(y => [-450, 450].map(z => [x, y, z])));
const hull = P => { P = [...P].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = []; for (const p of P) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
  for (const p of P.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p) } return lo.slice(0, -1).concat(up.slice(0, -1)) };
const POSES = {
  song: { out: '__m3.tilt(0);__m3.go(107.5,35,9e9)', low: '__m3.go(107.5,35,9e9);__m3.tilt(-3)', mid: '__m3.go(107.5,35,2600);__m3.tilt(-.4)' },
  default: { map: '__m3.tilt(0);__m3.go(109.5,34.6,520)', out: '__m3.tilt(0);__m3.go(107.5,35,9e9)' },
};
const YAWS = [0, .7, 2.9];
async function run(view, stage) {
  const V = VIEWS[view], rows = [];
  const cdp = await chrome({ tag: 'flick', port: [9450, 140], args: ['--use-angle=metal'] }), { send, ev, errs } = cdp;
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: V.dpr, mobile: V.mobile });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(()=>{const r=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>r(t=>cb(window.__ft!=null?window.__ft:t))})()` });
    await send('Page.navigate', { url: `${BASE}${process.env.HS_PAGE || ''}?flick=${Date.now()}${process.env.HS_QS || ''}` });
    for (let k = 0; k < 100; k++) { await sleep(300); if (await ev('!!(window.__m3&&__m3.tilt&&__m3.rs)')) break }
    if (process.env.HS_EVAL) await ev(process.env.HS_EVAL);
    await ev(`__m3.story&&__m3.story(false);document.head.insertAdjacentHTML('beforeend','<style>body>*:not(canvas){visibility:hidden!important}</style>')`);
    await sleep(2500);
    const rs = await ev(`(()=>{const c=Math.min(Math.min(2,devicePixelRatio),Math.sqrt((__m3.info().aa?2.0e6:2.6e6)/(innerWidth*innerHeight)));__m3.rs(Math.max(1,c));return __m3.rs()+' msaa '+__m3.info().aa})()`);
    await ev('window.__ft=performance.now()');
    const raf = 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))';
    for (const [pose, js] of Object.entries(POSES[stage]).filter(([k]) => !process.env.HS_POSE || process.env.HS_POSE.split(',').includes(k))) for (const y0 of YAWS) {
      await ev(`__m3.yaw(${y0});${js}`); await ev(raf); await sleep(300);
      const F = [];
      for (let k = 0; k < N; k++) {
        await ev(`__m3.yaw(${y0 + k * STEP})`); await ev(raf); // pose set once: re-zooming per frame jittered the room-clamped camera
        const s = await send('Page.captureScreenshot', { format: 'png' }); F.push(decodePNG(Buffer.from(s.result.data, 'base64')));
      }
      const { w: W, h: H } = F[0], scale = W / V.w;
      // region masks from the middle frame's camera
      await ev(`__m3.yaw(${y0 + (N >> 1) * STEP})`); await ev(raf);
      const masks = {}, proj = async pts => { const P = JSON.parse(await ev(`JSON.stringify(${JSON.stringify(pts)}.map(q=>__m3.pw(...q)))`)); return P.some(p => p[2] > 1 || p[2] < -1) ? null : P.map(p => [p[0] * scale, p[1] * scale]) };
      const deskH = stage === 'song' ? await proj(DESK).then(P => P && hull(P)) : null, mapH = await proj(stage === 'song' ? MAP : MAP.map(([x, y, z]) => [x, y + 6, z])).then(P => P && hull(P));
      for (const [name, quad] of Object.entries(REG[stage]).concat(mapH ? [['map', null]] : [])) {
        const Q = name === 'map' ? mapH : await proj(quad); if (!Q) continue;
        const m = new Uint8Array(W * H); let n = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inPoly(Q, x + .5, y + .5) && !(name === 'mat' && deskH && inPoly(deskH, x + .5, y + .5))) { m[y * W + x] = 1; n++ }
        if (n > 2000) masks[name] = m;
      }
      const heat = new Float32Array(W * H);
      for (let k = 1; k < N - 1; k++) { const a = F[k - 1].lum, b = F[k].lum, c = F[k + 1].lum;
        for (let i = 0; i < W * H; i++) { const d1 = b[i] - a[i], d2 = c[i] - b[i]; if (d1 * d2 < 0 && Math.abs(d1) > T && Math.abs(d2) > T) heat[i]++ } }
      const score = m => { let s = 0, n = 0; for (let i = 0; i < W * H; i++) if (!m || m[i]) { s += heat[i]; n++ } return 1000 * s / (n * (N - 2)) };
      let rest = null; if (masks.map) { rest = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) rest[i] = 1 - masks.map[i] }
      const row = { view, stage, pose, yaw: y0, all: score(rest) }; // all: the whole canvas outside the map
      for (const [k, m] of Object.entries(masks)) row[k] = score(m);
      rows.push(row);
      if (OUT) { const v = new Float32Array(W * H); for (let i = 0; i < W * H; i++) v[i] = heat[i] ? 255 : F[N >> 1].lum[i] * .35;
        writeFileSync(`${OUT}/flick-${stage}-${view}-${pose}-${y0}.png`, encodeGrey(W, H, v)) }
    }
    if (errs.length) rows.push({ view, stage, err: errs.slice(0, 2).join(' | ') });
    rows.rs = rs;
  } finally { cdp.kill(); await sleep(400) }
  return rows;
}
let bad = 0;
const views = VA === 'all' ? Object.keys(VIEWS) : [VA], stages = ['song']; // the 书院 is the only stage since 2026-11-07 (the old default and ?stage= are gone); the arg is kept for old command lines
for (const st of stages) for (const vw of views) {
  const rows = await run(vw, st);
  console.log(`\n== flicker ${st} / ${vw} (render scale ${rows.rs}; blinks per 1000 pixel-frames, yaw step ${STEP} rad, T ${T})`);
  for (const r of rows) {
    if (r.err) { bad++; console.log('✗ JS errors:', r.err); continue }
    const parts = Object.keys(BUDGET).filter(k => r[k] !== undefined).map(k => { const ok = r[k] <= BUDGET[k]; if (!ok) bad++; return `${ok ? ' ' : '✗'}${k} ${r[k].toFixed(2)}‰` });
    console.log(`${r.pose.padEnd(4)} yaw ${String(r.yaw).padEnd(4)} ${parts.join('  ')}`);
  }
}
console.log(bad ? `\nFAIL ${bad} over budget` : '\nPASS'); process.exit(bad ? 1 : 0);
