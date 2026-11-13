#!/usr/bin/env node
// 人物 route shape: plays 李世民 and 李白 (phone 390×844 and desktop 1440×900) and, every frame, reads the growing leg
// (#pRoute) and the protagonist portrait. Fails when the leg kinks on screen (it must be a straight segment between its
// two stops, never following ridges), when the portrait leaves the head of the line, or when the line does not
// re-project after a camera pan (paused mid-leg, pan, the leg must still start on the travelled line's last stop).
//
//   node test/route-shape.mjs [seconds=14]      # server on 127.0.0.1:7814 (HS_URL overrides)
//
// Metrics: turn  largest turning angle (deg) between consecutive screen segments of one leg (budget ≤ 25)
//          head  portrait anchor to line head, px: median / p99 (budget p99 ≤ 6)
//          pan   after a pan: leg start to travelled-line end, px (budget ≤ 1.5); head to portrait (≤ 3)
import { chrome, sleep, BASE } from './cdp.mjs';

const SEC = +process.argv[2] || 14;
const VIEWS = [['phone', 390, 844, 3, true], ['desk', 1440, 900, 1, false]], WHO = ['lishimin', 'libai'];
const c = await chrome({ tag: 'route-shape', port: [9350, 90], args: ['--window-size=1440,900'] });
const bad = [];
// in-page: parse a path's subpaths; the leg being walked is .dt.cur, the travelled trail ends on the last other .dt (v129 dots)
const READ = `(()=>{const R=document.getElementById('pRoute'),leg=R.querySelector('.dt.cur'),ud=[...R.querySelectorAll('.dt:not(.cur)')].filter(e=>e.getAttribute('d')).pop();
  const pts=d=>(d||'').split(/(?=[ML])/).map(s=>[s[0],...s.slice(1).trim().split(/[ ,]+/).map(Number)]);
  const pm=document.querySelector('.pmark:not(.o)'),q=pm&&!pm.hidden&&pm.style.translate?pm.style.translate.split(' ').map(parseFloat):null;
  return {leg:leg?pts(leg.getAttribute('d')):[],ud:ud?pts(ud.getAttribute('d')):[],pm:q}})()`;
const turnOf = L => { let m = 0; const P = L.map(s => [s[1], s[2]]);
  for (let k = 2; k < P.length; k++) { if (L[k][0] === 'M' || L[k - 1][0] === 'M') continue;
    const a = [P[k - 1][0] - P[k - 2][0], P[k - 1][1] - P[k - 2][1]], b = [P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]];
    const la = Math.hypot(...a), lb = Math.hypot(...b); if (la < .5 || lb < .5) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / la / lb))) * 180 / Math.PI; if (ang > m) m = ang; }
  return m; };
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  for (const [vn, w, h, dpr, mob] of VIEWS) for (const who of WHO) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: mob });
    await c.send('Page.navigate', { url: BASE }); await sleep(5000);
    await c.ev(`__m3.person(${JSON.stringify(who)},0)`); await sleep(2500);
    const F = await c.ev(`new Promise(ok=>{const S=[];document.getElementById('play').click();const t0=performance.now();
      const f=n=>{S.push(${READ});if(n-t0<${SEC * 1000})requestAnimationFrame(f);else ok(S)};requestAnimationFrame(f)})`);
    let turn = 0, heads = [], legs = 0;
    for (const s of F) { if (s.leg.length < 2) continue; legs++; turn = Math.max(turn, turnOf(s.leg));
      const e = s.leg[s.leg.length - 1]; if (s.pm) heads.push(Math.hypot(e[1] - s.pm[0], e[2] - s.pm[1])); }
    heads.sort((a, b) => a - b);
    const med = heads.length ? heads[heads.length >> 1] : 0, p99 = heads.length ? heads[Math.floor(heads.length * .99)] : 0;
    // pause on a leg, pan, check the line re-projects from fixed ground points
    let pan = null;
    for (let k = 0; k < 40 && !pan; k++) {
      const s = await c.ev(READ); if (s.leg.length >= 2 && s.ud.length) {
        await c.ev(`document.getElementById('play').click()`); await sleep(300);
        const b = await c.ev(READ);
        await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: w / 2, y: h / 2, deltaX: 0, deltaY: -240 }); await sleep(900);
        const a = await c.ev(READ); if (a.leg.length < 2 || !a.ud.length) break;
        const u = a.ud[a.ud.length - 1], l0 = a.leg[0], e = a.leg[a.leg.length - 1];
        pan = { moved: +Math.hypot(a.leg[0][1] - b.leg[0][1], a.leg[0][2] - b.leg[0][2]).toFixed(1), start: +Math.hypot(u[1] - l0[1], u[2] - l0[2]).toFixed(2), head: a.pm ? +Math.hypot(e[1] - a.pm[0], e[2] - a.pm[1]).toFixed(2) : null };
      } else await sleep(150);
    }
    const M = { view: vn, who, frames: F.length, legFrames: legs, turnDeg: +turn.toFixed(1), headMed: +med.toFixed(2), headP99: +p99.toFixed(2), pan };
    console.log(JSON.stringify(M));
    const tag = `${vn}/${who}`;
    if (!legs) bad.push(`${tag}: no leg drawn`);
    if (turn > 25) bad.push(`${tag}: leg kinks ${M.turnDeg}° > 25`);
    if (p99 > 6) bad.push(`${tag}: portrait off the line head p99 ${M.headP99}px`);
    if (!pan) bad.push(`${tag}: pan check did not run`);
    else { if (pan.start > 1.5) bad.push(`${tag}: after pan leg start ${pan.start}px off the travelled line`); if (pan.head != null && pan.head > 3) bad.push(`${tag}: after pan portrait ${pan.head}px off the head`); }
  }
  if (c.errs.length) bad.push('js errors: ' + c.errs[0]);
  console.log(bad.length ? 'FAIL: ' + bad.join('; ') : 'PASS: legs are straight, the portrait rides the head, the line re-projects');
} finally { c.kill(); }
process.exit(bad.length ? 1 : 0);
