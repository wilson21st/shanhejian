#!/usr/bin/env node
// Unroll smoothness audit (v139, Wilson 2026-11-13: 拉开画卷 跳帧). Opens a scroll over the map the way a tap does — a
// recorded poem (吟 p23), a written poem (p05) and a 说书 (玄武门) — and times every animation frame of the top page from
// the tap until the scroll has fully parted. The iframe is same-origin, so its parse / script / fonts run on the same main
// thread and show up here as late frames. Phone proxy: 390×844 at 3×, touch, CPU slowed 8× (at 4× this Mac hid the stalls; CPU=<n> overrides); desktop 1440×900
// at 2×. Real GPU.
// Per run, over the unroll window (overlay 'ready' → 'open' + 1 s):
//   p95 / max  frame interval (ms)          late   frames > 25 ms (a visible hitch at 60 Hz)
//   jump       largest one-frame step of the opening (share of the full width; smooth ≈ 0.05)
//   big        frames whose step > 0.08 (the scroll visibly jumps open)
//   wait       ms from the tap until the scroll starts to part (fly-down + rolls + load)
// Budget: p95 ≤ 20, jump ≤ 0.08, big = 0; late ≤ 4 (phone) / 2 (desktop). Before v139 (iframe loading into the opening,
// map rendering under it): phone p95 33, late 2–12, max 183 ms, jump to 0.15; desktop p95 33, late 12–17, jump 0.10.
//   node test/unroll-audit.mjs [phone|desktop] [runs=3]        JSON → $OUT (default /tmp/unroll-audit.json)
import { chrome, sleep, BASE } from './cdp.mjs';
import { writeFileSync } from 'node:fs';
const VIEWS = {
  phone: { m: { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }, cpu: 8, budget: { p95: 20, late: 4, jump: .08, big: 0 } },
  desktop: { m: { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false }, cpu: 1, budget: { p95: 20, late: 2, jump: .08, big: 0 } },
};
const CASES = [['poem p23 (有声)', '__m3.poem("p23")'], ['poem p05 (书写)', '__m3.poem("p05")'], ['说书 玄武门', 'OPENSTORY']];
const only = process.argv[2] && VIEWS[process.argv[2]] ? [process.argv[2]] : Object.keys(VIEWS), RUNS = +process.argv[3] || 3;
// top page only: per frame, the time and how far the iframe's clip has opened (0 shut … 1 open), plus overlay phase marks
const PROBE = `if(window.top===window){const U=window.__un={on:false,f:[],mk:{}};const tick=t=>{if(U.on){const fr=document.querySelector('#scrollOv iframe');let p=null;
  if(fr){const cp=getComputedStyle(fr).clipPath,m=cp.match(/^inset\\(\\s*\\S+\\s+(calc\\([^)]*\\)|[-\\d.]+(?:px|%))/);
    if(m){let x=0;for(const [,n,u] of m[1].replace(/-\\s+/g,'-').matchAll(/(-?[\\d.]+(?:e[-+]?\\d+)?)(px|%)/g))x+=u==='%'?n*innerWidth/100:+n;p=(innerWidth/2-x)/(innerWidth/2)}
    else if(/^inset\\(\\s*[-\\d.]+px\\s*\\)$|none/.test(cp))p=1}
  const ov=document.getElementById('scrollOv');if(ov){for(const c of ['ready','open'])if(ov.classList.contains(c)&&!U.mk[c])U.mk[c]=t;if(!U.mk.ov)U.mk.ov=t}
  U.f.push([t,p])}requestAnimationFrame(tick)};requestAnimationFrame(tick)}`;
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const r1 = x => Math.round(x * 10) / 10, r3 = x => Math.round(x * 1000) / 1000;
const c = await chrome({ tag: 'unroll', port: [9500, 200], args: ['--autoplay-policy=no-user-gesture-required'] }), { send, ev } = c;
const out = { when: new Date().toISOString(), views: {} }; let bad = 0;
const waitFor = async (expr, ms = 15000) => { for (let k = 0; k < ms / 100; k++) { if (await ev(expr)) return true; await sleep(100); } return false; };
try {
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE });
  for (const vn of only) {
    const V = VIEWS[vn]; out.views[vn] = [];
    await send('Emulation.setDeviceMetricsOverride', V.m); await send('Emulation.setTouchEmulationEnabled', { enabled: V.m.mobile });
    for (const [name, expr] of CASES) for (let k = 0; k < RUNS; k++) {
      await send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await send('Page.navigate', { url: BASE + 'index.html?unroll=' + Date.now() });
      await waitFor('!!(window.__m3&&__m3.tlId&&document.getElementById("rng").max>0)', 40000); await sleep(2500);
      let open = expr;
      if (expr === 'OPENSTORY') { await ev('__m3.tlId("e0629")'); await sleep(3500); open = 'document.querySelector(".lb.scrollc").click()'; }
      await send("Emulation.setCPUThrottlingRate", { rate: +process.env.CPU || V.cpu }); await sleep(800);
      await ev(`(()=>{__un.f=[];__un.mk={};__un.t0=performance.now();__un.on=true;${open}})()`);
      await waitFor('!!(__un.mk.open&&performance.now()-__un.mk.open>1000)', 20000);
      const u = await ev('(__un.on=false,JSON.stringify(__un))'); const U = JSON.parse(u || '{}');
      const a = U.mk.ready || U.mk.ov, b = (U.mk.open || 0) + 1000, F = (U.f || []).filter(([t]) => t >= a && t <= b);
      const dt = [], dp = []; for (let i = 1; i < F.length; i++) { dt.push(F[i][0] - F[i - 1][0]); if (F[i][1] != null && F[i - 1][1] != null) dp.push(Math.abs(F[i][1] - F[i - 1][1])); }
      const r = { name, run: k + 1, frames: F.length, p95: r1(q(dt, .95)), max: r1(Math.max(0, ...dt)), late: dt.filter(x => x > 25).length,
        jump: r3(Math.max(0, ...dp)), big: dp.filter(x => x > .08).length, wait: U.mk.open ? Math.round(U.mk.open - U.t0) : null,
        trace: F.map(([t, p]) => [Math.round(t - a), p == null ? null : r3(p)]) };
      const B = V.budget, pass = r.p95 <= B.p95 && r.late <= B.late && r.jump <= B.jump && r.big <= B.big && r.frames > 10;
      if (!pass) bad++; r.pass = pass; out.views[vn].push(r);
      console.log(`${pass ? '✓' : '✗'} ${vn} ${name} #${k + 1}: frames ${r.frames} p95 ${r.p95} max ${r.max} late ${r.late} jump ${r.jump} big ${r.big} wait ${r.wait} ms`);
    }
  }
} finally { c.kill(); }
writeFileSync(process.env.OUT || '/tmp/unroll-audit.json', JSON.stringify(out, null, 1));
console.log(bad ? `FAIL ${bad} run(s) over budget` : 'PASS'); process.exit(bad ? 1 : 0);
