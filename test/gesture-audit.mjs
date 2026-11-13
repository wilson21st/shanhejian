#!/usr/bin/env node
// Gesture smoothness audit (Wilson 2026-11-07: turning or tilting the map "not natural, not smooth").
// tilt-audit checks that the gestures *work*; this one checks how they *feel*. Each gesture is a finger (or mouse)
// moving at constant speed, so a perfect map would turn / tilt at constant speed too. Per rendered frame the probe
// records the camera's yaw (the compass needle) and elevation; per pointermove it records the handler's JS time.
//
// Gestures:  rotate   two fingers on a circle twisted at 90°/s            (phone)
//            tilt     two fingers side by side pushed up at 100 px/s     (phone)
//            rpan     right-button drag (pans since v110) 600 px sideways in 2 s across the 秦岭 (desktop, win)
//            rpanv    right-button drag 300 px up in 1.5 s (desktop, win)
//            rdrag    left-button drag (the turn/tilt button since Wilson's 2026-11-07 20:01 swap; name kept), 200 px/s sideways + 100 px/s up (desktop; yaw and elevation both checked; dragging
//                     right must turn the map anticlockwise, its near side following the cursor)
//            rotn, ttw0, ttw, ttw2, ttwp (v112, phone) two-finger tilt + twist (+ pinch) at once, with finger noise — see
//                     gestureSpec(); scored per channel by analyseCombo() (gain, cv, stall, spike, jit). HS_GEST=a,b picks
//                     the phone gestures, HS_NOISE the noise in px (default 1.5)
// Input feeds, each gesture is run with both:
//   cdp      Chrome's own input pipeline (CDP Input.dispatch*) fed at 60 Hz by the wall clock
//   ios      events made in the page at ~120 Hz with ±1.5 ms jitter, each finger its own event, not lined up with
//            frames — a stand-in for an iPhone (120 Hz touch, Safari frames on their own clock). A model, not a device.
// Metrics (steady part = from 150 ms after the camera starts moving until the input stops):
//   cv       coefficient of variation of the camera's per-frame angular speed — 0 is perfectly even
//   stall    share of steady frames where the camera barely moved (<25% of the median step): a hitch you can see
//   jump     biggest speed in the first 150 ms of response ÷ median steady speed — a lurch when the gesture locks in
//   dead     finger travel before the camera responds (° of twist, px of push); includes the ~20 ms the map reads
//            behind the finger, so a gesture with no dead zone still shows a few px
//   lat      (v111) ms from the first input event to the first frame the camera moves. Pans are budgeted on this, not on
//            dead: at 150 px/s one frame plus the ~20 ms read-behind is already 5–8 px, however quickly the map answers
//   settle   ms from the last input event until the camera stops — the lag you feel when you stop
//   p95      95th-percentile frame interval during the gesture (ms)        js     p95 JS time per pointermove (ms)
//   bob      (pans, v111) ground points under the cursor and at the screen's top/bottom centre, tracked on screen:
//            biggest peak-to-peak wobble across the motion after removing a straight line (px). Wilson 2026-11-09:
//            right-drag pan on Windows "起起伏伏" — the map bobbing up and down as it slides
//   pivot    (rotate) peak-to-peak drift of the ground point under the fingers' midpoint (px) — should stay put
//   camy     peak-to-peak camera height over the steady part ÷ camera distance (‰); camstep: biggest one-frame
//            change of camera height (‰ of distance) — a pan or twist should not lift or drop the eye
//   rs       render-resolution changes during the gesture (each one is a visible pop + a reallocation hitch)
// Budgets below; any miss fails the run. HS_PAGE=other.html measures another copy of the page.
// HS_QS='&perf=1' turns on the page's on-device meter and prints its text after each gesture (a check that it works).
//   node test/gesture-audit.mjs [phone|desktop] [cdp|ios] [--json out.json]
import { chrome, sleep, BASE } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2), JSON_OUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--json');

const PROFILES = {
  phone: { w: 390, h: 844, dpr: 3, mobile: true, cpu: 4, gestures: (process.env.HS_GEST || 'rotate,twist2,tilt,rotn,ttw0,ttw,ttw2,ttwp').split(','),
    budget: { cv: .2, stall: .03, jump: 2, dead: { rotate: 15, twist2: 15, tilt: 12 }, settle: 70, p95: 45, js: 4, rs: 0 } },
  desktop: { w: 1440, h: 900, dpr: 2, mobile: false, cpu: 1, gestures: ['rdrag', 'rpan', 'rpanv'],
    budget: { cv: .15, stall: .03, jump: 2, dead: { rdrag: 6 }, lat: 40, settle: 50, p95: 22, js: 1.5, rs: 0 } },
  // a typical Windows laptop: 1920×1080 panel at 125% scaling
  win: { w: 1536, h: 864, dpr: 1.25, mobile: false, cpu: 1, gestures: ['rdrag', 'rpan', 'rpanv'],
    budget: { cv: .15, stall: .03, jump: 2, dead: { rdrag: 6 }, lat: 40, settle: 50, p95: 22, js: 1.5, rs: 0 } },
};
const FEEDS = ['cdp', 'ios'];
// v111 smoothness budgets, all profiles: bob px, pivot px, camera height p-p and one-frame step in ‰ of distance
const B2 = { bob: 2, pivot: 8, camy: 10, camstep: 1 };

// before any page script: per frame, after every rAF callback, the needle's yaw and the camera elevation;
// per pointermove (window capture → window bubble) the time spent in the page's handlers and the finger positions.
const PROBE = `(()=>{const G=window.__g={on:false,f:[],ev:[],js:[]};const raf=window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame=cb=>raf(ts=>{cb(ts);if(!G.on||!window.__m3)return;const n=document.getElementById('needle');
    const y=n?parseFloat((n.getAttribute('transform')||'rotate(0)').slice(7)):0,el=__m3.tilt().el,rs=__m3.info?__m3.info().rs:0,
      L=G.f[G.f.length-1],c=__m3.cam(),A=(G.A||[]).map(a=>__m3.pw(a[0],a[1],a[2]).slice(0,2)),row=[ts,y,el,rs,c.position.y,__m3.camDist(),A,c.position.x,c.position.z];
      if(L&&L[0]===ts)G.f[G.f.length-1]=row;else G.f.push(row)});
  let s=0;addEventListener('pointermove',e=>{if(G.on)s=performance.now()},true);
  addEventListener('pointermove',e=>{if(!G.on)return;const n=performance.now();G.js.push(n-s);G.ev.push([n,e.pointerId,e.clientX,e.clientY,e.timeStamp,e.getCoalescedEvents?e.getCoalescedEvents().length:-1])});})();`;

// the in-page "ios" feed: finger paths as a function of time, one pointermove per finger per tick
const IOS = `window.__feed=(spec)=>new Promise(done=>{const cv=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  const S=new Function('t','return '+spec.path),n=S(0).length,mouse=spec.mouse,ids=S(0).map((_,i)=>mouse?1:40+i);
  const mk=(type,i,p)=>new PointerEvent(type,{bubbles:true,cancelable:true,composed:true,pointerId:ids[i],pointerType:mouse?'mouse':'touch',isPrimary:i===0,
    clientX:p[0],clientY:p[1],button:type==='pointermove'?-1:btn,buttons:type==='pointerup'?0:bs,width:mouse?1:20,height:mouse?1:20,pressure:type==='pointerup'?0:.5});
  let sd=12345;const rn=()=>{sd=(sd*16807)%2147483647;return (sd/2147483647*2-1)*(spec.noise||0)};const NZ=P=>spec.noise?P.map(p=>[p[0]+rn(),p[1]+rn()]):P;
  const btn=spec.btn||0,bs=btn===2?2:1;const t0=performance.now();S(0).forEach((p,i)=>cv.dispatchEvent(mk('pointerdown',i,p)));let k=0;
  const tick=()=>{const t=Math.min(spec.dur,(performance.now()-t0)/1000);const P=NZ(S(t));P.forEach((p,i)=>cv.dispatchEvent(mk('pointermove',i,p)));
    if(t<spec.dur){k++;const next=t0+k*1000/spec.hz+(Math.random()*2-1)*1.5;setTimeout(tick,Math.max(0,next-performance.now()))}
    else setTimeout(()=>{P.forEach((p,i)=>cv.dispatchEvent(mk('pointerup',i,p)));done()},spec.hold)};
  setTimeout(tick,1000/spec.hz)});`;

function gestureSpec(g, W, H) {
  const cx = W / 2, cy = H * .45;
  if (g === 'rotate') return { dur: 1.6, hold: 300, hz: 120, setup: '__m3.tilt(0)',
    path: `[0,1].map(i=>{const a=(i?Math.PI:0)+t*Math.PI/2;return [${cx}+80*Math.cos(a),${cy}+80*Math.sin(a)]})`,
    anchors: [[cx, cy]], pivot: [cx, cy],
    param: P => P.length < 2 ? null : Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]) * 180 / Math.PI, unit: '°', ch: ['yaw'] };
  // twist2 (v111): the same twist with the fingers low and left of centre, so the map pivots there and the camera's
  // target sweeps over the 秦岭 — any terrain-following of the eye shows up as camstep
  if (g === 'twist2') { const px = cx - 70, py = cy + 170; return { dur: 1.6, hold: 300, hz: 120, setup: '__m3.tilt(0)',
    path: `[0,1].map(i=>{const a=(i?Math.PI:0)+t*Math.PI/2;return [${px}+70*Math.cos(a),${py}+70*Math.sin(a)]})`,
    anchors: [[px, py]], pivot: [px, py],
    param: P => P.length < 2 ? null : Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]) * 180 / Math.PI, unit: '°', ch: ['yaw'] }; }
  // v112 combined two-finger gestures (Wilson 2026-11-09 23:2x: tilting and twisting at the same time on the iPhone still
  // "窒下窒下"). Two fingers 120 px apart, pushed up while twisting, each finger at its own speed (one leads), every sample
  // carrying ±1.5 px of finger noise. Each channel is scored on its own: did it move at all (gain = camera change ÷ what
  // the fingers asked for), evenly (cv, stall), without lurches (spike) — plus the camera's acceleration (acc).
  //   ttw   push up 80/120 px/s + twist 40°/s clockwise   (on v111 the twist locks the gesture into map mode first)
  //   ttw2  push up 110/90 px/s + twist 20°/s anticlockwise (on v111 tilt locks first)
  //   ttw0  ttw without the noise: what is left is the page's own unevenness (a mode switch, an uneven read clock)
  //   ttwp  ttw plus a 25% spread (tilt + twist + pinch)
  //   rotn  the centred rotate with the same finger noise — noise alone, no combination
  const combo = { ttw: [40, 80, 120, 0], ttw0: [40, 80, 120, 0], ttw2: [-20, 110, 90, 0], ttwp: [40, 80, 120, .25] }[g];
  if (combo) { const [w, u0, u1, spr] = combo, px = cx, py = cy + 140; return { dur: 1.6, hold: 300, hz: 120, setup: '__m3.tilt(2)', noise: g === 'ttw0' ? 0 : +(process.env.HS_NOISE ?? 1.5), combo: true, anchors: [[cx, cy], [60, 120], [W - 60, H - 200]],
    path: `[0,1].map(i=>{const a=(i?Math.PI:0)+t*${w}*Math.PI/180,r=60*(1+${spr}*t/1.6),u=t*(i?${u1}:${u0});return [${px}+r*Math.cos(a),${py}+r*Math.sin(a)-u]})`,
    ch: spr ? ['yaw', 'el', 'zoom'] : ['yaw', 'el'] }; }
  if (g === 'rotn') return { dur: 1.6, hold: 300, hz: 120, setup: '__m3.tilt(0)', noise: +(process.env.HS_NOISE ?? 1.5), combo: true, anchors: [[cx, cy], [60, 120], [W - 60, H - 200]],
    path: `[0,1].map(i=>{const a=(i?Math.PI:0)+t*Math.PI/2;return [${cx}+80*Math.cos(a),${cy}+80*Math.sin(a)]})`, ch: ['yaw'] };
  if (g === 'tilt') return { dur: 1.6, hold: 300, hz: 120, setup: '__m3.tilt(2)',
    path: `[[${cx - 60},${cy + 80}-t*100],[${cx + 60},${cy + 80}-t*100]]`,
    param: P => P.length < 2 ? null : (P[0][1] + P[1][1]) / 2, unit: 'px', ch: ['el'] };
  if (g === 'rpan') return { dur: 2, hold: 300, hz: 250, setup: '', mouse: true, btn: 2,
    anchors: [[cx - 300, cy], [cx, H * .2], [cx, H * .8]],
    path: `[[${cx - 300}+t*300,${cy}]]`, param: P => P.length ? P[0][0] : null, unit: 'px', ch: ['ax'], perp: 1 };
  if (g === 'rpanv') return { dur: 1.5, hold: 300, hz: 250, setup: '', mouse: true, btn: 2,
    anchors: [[cx, cy + 150], [cx, H * .2], [cx, cy]], // all on the centre line: their x must not move
    path: `[[${cx},${cy + 150}-t*200]]`, param: P => P.length ? P[0][1] : null, unit: 'px', ch: ['ay'], perp: 1, fit: 2, skip0: true };
  return { dur: 1.5, hold: 300, hz: 120, setup: '__m3.tilt(2)', mouse: true,
    path: `[[${cx - 150}+t*200,${cy + 80}-t*100]]`, param: P => P.length ? P[0][0] : null, unit: 'px', ch: ['yaw', 'el'] };
}

async function run(name, feed) {
  const PF = PROFILES[name];
  const cdp = await chrome({ tag: 'gest', port: [9300, 300],
    args: ['--no-first-run', '--autoplay-policy=no-user-gesture-required', `--window-size=${PF.w},${PF.h}`] }), { send, ev, errs } = cdp;
  const out = [];
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: PF.w, height: PF.h, deviceScaleFactor: PF.dpr, mobile: PF.mobile });
    if (PF.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
    await send('Page.navigate', { url: BASE + (process.env.HS_PAGE || '') + '?gest=' + Date.now() + (process.env.HS_QS || '') });
    for (let k = 0; k < 300; k++) { await sleep(100); if (await ev('!!(window.__m3&&window.__m3.tilt)')) break; }
    await ev(IOS); await ev('__m3.story&&__m3.story(false)');
    await send('Emulation.setCPUThrottlingRate', { rate: PF.cpu });
    await sleep(2500);
    for (const g of PF.gestures) {
      const S = gestureSpec(g, PF.w, PF.h);
      await ev(`__m3.go(109.5,34.6,520);__m3.yaw(0);${S.setup}`); await sleep(1500);
      await ev(`__g.A=${JSON.stringify(S.anchors || [])}.map(([x,y])=>__m3.gnd(x,y)).filter(Boolean)`);
      await ev('Object.assign(__g,{on:true,f:[],ev:[],js:[]})'); await sleep(300);
      if (feed === 'ios') await ev(`__feed(${JSON.stringify({ dur: S.dur, hold: S.hold, hz: S.hz, path: S.path, mouse: !!S.mouse, btn: S.btn || 0, noise: S.noise || 0 })})`);
      else {
        const P = new Function('t', 'return ' + S.path), t0 = Date.now(), tp = (pts, i) => pts.map(([x, y], k) => ({ x, y, id: k }));
        const BN = S.btn === 2 ? 'right' : 'left', BS = S.btn === 2 ? 2 : 1;
        let sd = 12345; const rn = () => { sd = (sd * 16807) % 2147483647; return (sd / 2147483647 * 2 - 1) * (S.noise || 0) };
        if (S.mouse) await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: P(0)[0][0], y: P(0)[0][1], button: BN, buttons: BS, clickCount: 1 });
        else await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(P(0)) });
        // a 60 Hz digitiser: one move every 16.7 ms on the wall clock, not waiting for Chrome to acknowledge each one
        const q = []; for (let k = 1; ; k++) { const t = Math.min(S.dur, k / 60); await sleep(Math.max(0, t0 + t * 1000 - Date.now())); const p = P(t).map(([x, y]) => [x + rn(), y + rn()]);
          q.push(S.mouse ? send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0][0], y: p[0][1], button: BN, buttons: BS })
            : send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p) })); if (t >= S.dur) break; }
        await Promise.all(q); await sleep(S.hold); const p = P(S.dur);
        if (S.mouse) await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p[0][0], y: p[0][1], button: BN, buttons: 0, clickCount: 1 });
        else await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await sleep(400);
      const r = await ev('(()=>{__g.on=false;return {f:__g.f,ev:__g.ev,js:__g.js}})()');
      if (/perf/.test(process.env.HS_QS || '')) console.log(`[hud ${g}/${feed}] ` + JSON.stringify(await ev("document.getElementById('perf-hud')?.textContent")));
      if (process.env.GDUMP) writeFileSync(`${process.env.GDUMP}/${name}-${feed}-${g}.json`, JSON.stringify(r));
      r.nA = (await ev('__g.A.length')) || 0;
      for (const ch of S.ch) out.push({ g, ch, feed, ...(S.combo ? analyseCombo(r, S, ch) : analyse(r, S, ch)) });
    }
    if (errs.length) out.push({ g: 'errors', ch: '', feed, err: errs.slice(0, 2).join(' | ') });
  } finally { cdp.kill(); await sleep(400); }
  return out;
}

function analyse(r, S, ch) {
  const F = r.f.map(([t, y, el, rs, cy, cd, A]) => ({ t, v: ch === 'yaw' ? y * Math.PI / 180 : ch === 'ax' ? A[0]?.[0] : ch === 'ay' ? A[0]?.[1] : el, rs, cy, cd, A }));
  const E = r.ev, q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; };
  const med = a => q(a, .5);
  if (!E.length || F.length < 5) return { fail: 'no data' };
  const tIn0 = E[0][0], tIn1 = E[E.length - 1][0];
  // finger parameter as of time t, from the latest position of each pointer
  const latest = new Map(); let ei = 0; const paramAt = t => { while (ei < E.length && E[ei][0] <= t) { latest.set(E[ei][1], [E[ei][2], E[ei][3]]); ei++; } return S.param([...latest.values()]); };
  const p0 = (() => { const m = new Map(); for (const e of E) if (!m.has(e[1])) m.set(e[1], [e[2], e[3]]); return S.param([...m.values()]); })();
  const v0 = F.find(f => f.t >= tIn0)?.v ?? F[0].v;
  const resp = F.find(f => f.t >= tIn0 && Math.abs(f.v - v0) > 2e-4);
  if (!resp) return { fail: 'camera never moved' };
  let dead = null; for (const f of F) { const p = paramAt(f.t); if (f === resp) { dead = Math.abs(p - p0); break; } }
  const step = [], vel = [];
  for (let i = 1; i < F.length; i++) { const dt = F[i].t - F[i - 1].t, d = F[i].v - F[i - 1].v; step.push({ t: F[i].t, d, vel: d / dt * 1000 }); }
  const steady = step.filter(s => s.t >= resp.t + 150 && s.t <= tIn1);
  const sv = steady.map(s => s.vel), mv = Math.abs(med(sv)), mean = sv.reduce((a, b) => a + b, 0) / Math.max(1, sv.length);
  const sd = Math.sqrt(sv.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, sv.length));
  const medStep = med(steady.map(s => Math.abs(s.d)));
  const stall = steady.filter(s => Math.abs(s.vel) < .25 * mv).length / Math.max(1, steady.length);
  const early = step.filter(s => s.t >= resp.t && s.t < resp.t + 150).map(s => Math.abs(s.vel));
  const jump = early.length ? Math.max(...early) / mv : NaN;
  const moving = step.filter(s => Math.abs(s.d) > .02 * medStep);
  const settle = moving.length ? Math.max(0, moving[moving.length - 1].t - tIn1) : NaN;
  const G = F.filter(f => f.t >= tIn0 && f.t <= tIn1 + 100), dts = G.slice(1).map((f, i) => f.t - G[i].t);
  const rs = G.slice(1).filter((f, i) => f.rs !== G[i].rs).length;
  // v111: bob / pivot / camera height over the steady frames
  const SF = F.filter(f => f.t >= resp.t + 150 && f.t <= tIn1), pp = a => a.length ? Math.max(...a) - Math.min(...a) : 0;
  const detr = (ts, ys) => { const n = ts.length; if (n < 3) return ys.map(() => 0); const mt = ts.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
    let num = 0, den = 0; for (let i = 0; i < n; i++) { num += (ts[i] - mt) * (ys[i] - my); den += (ts[i] - mt) ** 2; } const k = den ? num / den : 0; return ys.map((y, i) => y - my - k * (ts[i] - mt)); };
  let bob = null, pivot = null;
  // a vertical pan moves the other points along y in a gentle perspective curve: take a quadratic out, not a line, and
  // skip the point under the cursor (keepUnder holds it on the cursor whatever the camera does)
  const detr2 = (ts, ys) => { const n = ts.length, m = ts.reduce((a, b) => a + b) / n, x = ts.map(t => (t - m) / 1000); let A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    for (let i = 0; i < n; i++) { const v = [1, x[i], x[i] * x[i]]; for (let r = 0; r < 3; r++) { b[r] += v[r] * ys[i]; for (let c = 0; c < 3; c++) A[r][c] += v[r] * v[c]; } }
    for (let c = 0; c < 3; c++) { let pv = c; for (let r = c + 1; r < 3; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; [A[c], A[pv]] = [A[pv], A[c]]; [b[c], b[pv]] = [b[pv], b[c]];
      for (let r = 0; r < 3; r++) if (r !== c) { const k = A[r][c] / A[c][c]; for (let q = c; q < 3; q++) A[r][q] -= k * A[c][q]; b[r] -= k * b[c]; } }
    const k = b.map((v, i) => v / A[i][i]); return ys.map((y, i) => y - k[0] - k[1] * x[i] - k[2] * x[i] * x[i]); };
  if (S.perp !== undefined && SF.length > 3) bob = Math.max(0, ...SF[0].A.map((_, j) => S.skip0 && !j ? 0 : pp((S.fit === 2 ? detr2 : detr)(SF.map(f => f.t), SF.map(f => f.A[j][S.perp])))));
  if (S.pivot && SF.length > 3) pivot = Math.max(pp(SF.map(f => f.A[0][0])), pp(SF.map(f => f.A[0][1])));
  const cd = med(SF.map(f => f.cd)) || 1, camy = pp(SF.map(f => f.cy)) / cd * 1000;
  const camstep = Math.max(0, ...SF.slice(1).map((f, i) => Math.abs(f.cy - SF[i].cy))) / cd * 1000;
  return { lat: resp.t - tIn0, bob, pivot, camy, camstep, n: steady.length, speed: mean, cv: Math.abs(sd / mean), stall, jump, dead, unit: S.unit, settle, p95: q(dts, .95), fps: dts.length / ((G[G.length - 1].t - G[0].t) / 1000),
    js: q(r.js, .95), moves: E.length, rs };
}

// v112: one channel of a combined two-finger gesture. Fingers' wanted change per channel, from the fingers themselves:
//   yaw  the angle of the line between them (rad; the map should turn 1:1)   el  their midpoint's height × .006 rad/px
//   zoom log of their spread (the camera distance should shrink 1:1)
// gain   camera change ÷ wanted change over the steady part (250 ms after the first input → last input). 0 = that channel
//        was dropped (the gesture locked into the other one), 1 = followed
// cv / stall as for the single gestures; spike = fastest frame ÷ median speed (a lurch or a mode switch; a dropped frame
//        that only takes a longer step at the same speed does not count)
// acc    camera-position acceleration: p95 |Δ²pos| ÷ median |Δpos| per frame (reported, not budgeted: it is relative, so a
//        slow channel reads as all noise)
// jit    what the eye sees: three ground points (centre, top-left, bottom-right) tracked on screen; p95 of their per-frame
//        change of velocity, in px per 60 Hz frame² — finger noise, a mode switch or an uneven frame all show here
// lock   ms from the first input until this channel first moves
function analyseCombo(r, S, ch) {
  const E = r.ev, q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : NaN; }, med = a => q(a, .5);
  if (!E.length || r.f.length < 5) return { fail: 'no data' };
  const tIn0 = E[0][0], tIn1 = E[E.length - 1][0];
  const cam = f => ch === 'yaw' ? f[1] * Math.PI / 180 : ch === 'el' ? f[2] : Math.log(f[5]);
  const want = P => { if (P.length < 2) return null; const [a, b] = P; return ch === 'yaw' ? Math.atan2(b[1] - a[1], b[0] - a[0]) : ch === 'el' ? (a[1] + b[1]) / 2 * .006 : -Math.log(Math.hypot(a[0] - b[0], a[1] - b[1])); };
  const latest = new Map(); let ei = 0; const paramAt = t => { while (ei < E.length && E[ei][0] <= t) { latest.set(E[ei][1], [E[ei][2], E[ei][3]]); ei++; } return want([...latest.values()]); };
  const F = r.f.map(f => ({ t: f[0], v: cam(f), p: [f[7], f[4], f[8]], cd: f[5], A: f[6], w: null }));
  // the fingers' wanted value, unwrapped (the line's angle crosses ±π)
  let off = 0, prev = null; for (const f of F) { let w = paramAt(f.t); if (w == null) continue; if (ch === 'yaw' && prev != null) { while (w + off - prev > Math.PI) off -= 2 * Math.PI; while (w + off - prev < -Math.PI) off += 2 * Math.PI; } f.w = prev = w + off; }
  let vo = 0; for (let i = 1; i < F.length; i++) { if (ch !== 'yaw') break; let d = F[i].v + vo - F[i - 1].v; while (d > Math.PI) { vo -= 2 * Math.PI; d -= 2 * Math.PI } while (d < -Math.PI) { vo += 2 * Math.PI; d += 2 * Math.PI } F[i].v += vo; }
  const v0 = F.find(f => f.t >= tIn0)?.v ?? F[0].v, resp = F.find(f => f.t >= tIn0 && Math.abs(f.v - v0) > 2e-4);
  // steady part: from 250 ms after the first input, or 150 ms after this channel first moved if that is later (a twist
  // waits for ~12° before it turns: that wait is a dead zone, not a stall)
  const SF = F.filter(f => f.t >= Math.max(tIn0 + 250, resp ? resp.t + 150 : 0) && f.t <= tIn1 && f.w != null);
  if (SF.length < 5) return { fail: 'no steady frames' };
  const dw = SF[SF.length - 1].w - SF[0].w, dv = SF[SF.length - 1].v - SF[0].v, gain = Math.abs(dw) > 1e-6 ? dv / dw : NaN;
  const st = SF.slice(1).map((f, i) => ({ d: f.v - SF[i].v, vel: (f.v - SF[i].v) / (f.t - SF[i].t) * 1000 }));
  const sv = st.map(s => s.vel), mean = sv.reduce((a, b) => a + b, 0) / sv.length, sd = Math.sqrt(sv.reduce((a, b) => a + (b - mean) ** 2, 0) / sv.length);
  const mv = Math.abs(med(sv));
  const stall = sv.filter(x => Math.abs(x) < .25 * mv || Math.sign(x) !== Math.sign(mean)).length / sv.length;
  const spike = mv > 0 ? Math.max(...sv.map(Math.abs)) / mv : NaN;
  const dp = SF.slice(1).map((f, i) => f.p.map((x, k) => x - SF[i].p[k])), d2 = dp.slice(1).map((d, i) => Math.hypot(...d.map((x, k) => x - dp[i][k])));
  const acc = q(d2, .95) / Math.max(1e-9, med(dp.map(d => Math.hypot(...d))));
  const G = F.filter(f => f.t >= tIn0 && f.t <= tIn1 + 100), dts = G.slice(1).map((f, i) => f.t - G[i].t);
  const vA = SF.slice(1).map((f, i) => f.A && SF[i].A ? f.A.map((p, j) => [(p[0] - SF[i].A[j][0]) / (f.t - SF[i].t) * 16.7, (p[1] - SF[i].A[j][1]) / (f.t - SF[i].t) * 16.7]) : []);
  const ja = []; for (let i = 1; i < vA.length; i++) vA[i].forEach((v, j) => vA[i - 1][j] && ja.push(Math.hypot(v[0] - vA[i - 1][j][0], v[1] - vA[i - 1][j][1])));
  const jit = ja.length ? q(ja, .95) : NaN;
  return { gain, cv: Math.abs(sd / mean), stall, spike, acc, jit, lock: resp ? resp.t - tIn0 : NaN, want: dw, got: dv, n: SF.length,
    p95: q(dts, .95), fps: dts.length / ((G[G.length - 1].t - G[0].t) / 1000), js: q(r.js, .95), moves: E.length, combo: true, noise: S.noise };
}
// v112 budgets for the combined gestures (phone)
// cv ≤.3 without finger noise, ≤.5 with it (±1.5 px on a slow twist is ±15% of each frame's step by itself); jit0 ≤2 px:
// the 60 Hz CDP feed on a loaded Mac sits at ~1.5 px for v111 as well (33 ms frames)
const BC = { gain: [.8, 1.2], cv: .3, cvN: .5, stall: .05, spike: 3, jit: 4, jit0: 2 }; // cv/stall/spike on yaw and el; zoom is slow, so gain + jit only

const names = pos[0] && pos[0] !== 'all' ? [pos[0]] : Object.keys(PROFILES), feeds = pos[1] ? [pos[1]] : FEEDS;
let bad = 0; const all = [];
for (const name of names) for (const feed of feeds) {
  const rows = await run(name, feed), B = PROFILES[name].budget, PF = PROFILES[name];
  console.log(`\n== ${name} / ${feed} (${PF.w}×${PF.h} @${PF.dpr}x, CPU ÷${PF.cpu})`);
  console.log('gesture      cv     stall   jump   dead      settle  p95ms  fps    js95ms  rs  moves');
  for (const r of rows) {
    all.push({ name, ...r });
    if (r.err) { bad++; console.log(`✗ JS errors: ${r.err}`); continue; }
    if (r.fail) { bad++; console.log(`✗ ${r.g}/${r.ch}: ${r.fail}`); continue; }
    if (r.combo) { const f = [];
      if (!(r.gain >= BC.gain[0] && r.gain <= BC.gain[1])) f.push(`gain ${r.gain.toFixed(2)} outside ${BC.gain}`);
      if (r.ch !== 'zoom') { const CB = r.noise ? BC.cvN : BC.cv; if (!(r.cv <= CB)) f.push(`cv ${r.cv.toFixed(2)} > ${CB}`);
        if (!(r.stall <= BC.stall)) f.push(`stall ${(r.stall * 100).toFixed(1)}% > ${BC.stall * 100}%`);
        if (!(r.spike <= BC.spike)) f.push(`spike ${r.spike.toFixed(1)} > ${BC.spike}`); }
      const JB = r.noise ? BC.jit : BC.jit0; if (!(r.jit <= JB)) f.push(`jit ${r.jit.toFixed(2)}px > ${JB}`);
      if (r.p95 > B.p95) f.push(`p95 ${r.p95.toFixed(1)}ms > ${B.p95}`);
      if (r.js > B.js) f.push(`js ${r.js.toFixed(2)}ms > ${B.js}`);
      r.fails = f; if (f.length) bad++;
      console.log(`${(r.g + '/' + r.ch).padEnd(11)} gain ${r.gain.toFixed(2).padStart(5)}  cv ${r.cv.toFixed(2)}  stall ${(r.stall * 100).toFixed(1).padStart(4)}%  spike ${r.spike.toFixed(1).padStart(4)}  acc ${r.acc.toFixed(2)}  jit ${r.jit.toFixed(2)}px  lock ${r.lock.toFixed(0)}ms  p95 ${r.p95.toFixed(1)}  fps ${r.fps.toFixed(0)}  js ${r.js.toFixed(2)}  want ${r.want.toFixed(3)} got ${r.got.toFixed(3)}`);
      if (f.length) console.log('   ✗ ' + f.join('; '));
      continue; }
    const f = [];
    if (r.cv > B.cv) f.push(`cv ${r.cv.toFixed(2)} > ${B.cv}`);
    if (r.stall > B.stall) f.push(`stall ${(r.stall * 100).toFixed(1)}% > ${B.stall * 100}%`);
    if (r.jump > B.jump) f.push(`jump ${r.jump.toFixed(2)} > ${B.jump}`);
    if (B.dead[r.g] != null && r.dead > B.dead[r.g]) f.push(`dead ${r.dead.toFixed(1)}${r.unit} > ${B.dead[r.g]}`);
    if (!(r.settle <= B.settle)) f.push(`settle ${r.settle.toFixed(0)}ms > ${B.settle}`);
    if (r.p95 > B.p95) f.push(`p95 ${r.p95.toFixed(1)}ms > ${B.p95}`);
    if (r.js > B.js) f.push(`js ${r.js.toFixed(2)}ms > ${B.js}`);
    if (r.rs > B.rs) f.push(`rs changes ${r.rs} > ${B.rs}`);
    if (B.lat && r.g.startsWith('rpan') && r.lat > B.lat) f.push(`lat ${r.lat.toFixed(0)}ms > ${B.lat}`);
    if (r.bob != null && r.bob > B2.bob) f.push(`bob ${r.bob.toFixed(1)}px > ${B2.bob}`);
    if (r.pivot != null && r.pivot > B2.pivot) f.push(`pivot ${r.pivot.toFixed(1)}px > ${B2.pivot}`);
    if (r.g !== 'tilt' && r.g !== 'rdrag' && r.g !== 'twist2' && r.camy > B2.camy) f.push(`camy ${r.camy.toFixed(1)}‰ > ${B2.camy}`);
    if (r.g !== 'tilt' && r.g !== 'rdrag' && r.camstep > B2.camstep) f.push(`camstep ${r.camstep.toFixed(2)}‰ > ${B2.camstep}`);
    // direction: a clockwise two-finger twist turns the map clockwise (yaw rises); a left-button drag to the right turns it
    // anticlockwise, its near side following the cursor (yaw falls; Wilson 2026-11-07 "转左佢转右" on Windows)
    const want = r.ch === 'yaw' ? (r.g === 'rdrag' ? -1 : r.g === 'rotate' || r.g === 'twist2' ? 1 : 0) : 0;
    if (want && Math.sign(r.speed) !== want) f.push(`direction: yaw ${r.speed > 0 ? 'rises' : 'falls'}, should ${want > 0 ? 'rise' : 'fall'}`);
    r.fails = f; if (f.length) bad++;
    console.log(`${(r.g + '/' + r.ch).padEnd(11)} ${r.cv.toFixed(2).padStart(5)}  ${(r.stall * 100).toFixed(1).padStart(5)}%  ${r.jump.toFixed(2).padStart(5)}  ${(r.dead.toFixed(1) + r.unit).padStart(7)}  ${r.settle.toFixed(0).padStart(6)}  ${r.p95.toFixed(1).padStart(5)}  ${r.fps.toFixed(0).padStart(4)}  ${r.js.toFixed(2).padStart(6)}  ${String(r.rs).padStart(2)}  ${r.moves}  lat ${r.lat.toFixed(0)}ms bob ${r.bob == null ? '-' : r.bob.toFixed(1)} pivot ${r.pivot == null ? '-' : r.pivot.toFixed(1)} camy ${r.camy.toFixed(1)}‰ step ${r.camstep.toFixed(2)}‰`);
    if (f.length) console.log('   ✗ ' + f.join('; '));
  }
  console.log(`v112 combos: gain ${BC.gain}  cv ≤${BC.cv} (≤${BC.cvN} with noise)  stall ≤${BC.stall * 100}%  spike ≤${BC.spike} (yaw, el)  jit ≤${BC.jit}px with ±1.5 px finger noise, ≤${BC.jit0}px without`);
  console.log(`v111: bob ≤${B2.bob}px  pivot ≤${B2.pivot}px  camy ≤${B2.camy}‰ (pans, twist)  camstep ≤${B2.camstep}‰`);
  console.log(`budget      ≤${B.cv}  ≤${B.stall * 100}%   ≤${B.jump}   ${JSON.stringify(B.dead)}  ≤${B.settle}  ≤${B.p95}         ≤${B.js}   ≤${B.rs}`);
}
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(all, null, 1));
console.log(bad ? `\nFAIL: ${bad} row(s) over budget` : '\nPASS: gestures are smooth within budget');
process.exit(bad ? 1 : 0);
