#!/usr/bin/env node
// Tilt audit (Wilson 2026-11-07: "两手指揿住个屏幕向上向下就可以调整角度…电脑揿住右掣都应该可以调整").
// Real CDP touch / mouse input on a phone and a desktop viewport. Checks:
//   touch-tilt   two fingers side by side moved up 120px together → elevation drops (map lies back), no zoom
//   touch-down   the same moved down → elevation rises
//   stacked      one finger above the other, moved up together → still tilts (no side-by-side rule)
//   diagonal     fingers on a slant, moved down together → still tilts
//   pinch-vert   one finger above the other spread apart → zoom, tilt untouched
//   pan-side     two fingers moved sideways together → tilt untouched
//   pinch        two fingers spread apart → zoom changes, tilt untouched (the tilt gesture must not steal pinch)
//   pan          one finger drag still pans, tilt untouched
//   mouse-turn   left-button drag to the right → the near side of the map follows the cursor (yaw falls)
//   mouse-tilt   left-button drag up → elevation drops; sideways → yaw changes
//   mouse-pan    right-button drag → the map moves under the cursor; yaw and tilt untouched (buttons swapped, Wilson 2026-11-07 20:01)
//   clamp        a huge drag stays inside 23°–86°
//   compass      tapping the compass brings tilt offset and yaw back to 0
//   node test/tilt-audit.mjs [phone|desktop] [shotDir]
import { chrome, sleep, BASE } from './cdp.mjs';
const VIEWS = { phone: { w: 390, h: 844, dpr: 2, mobile: true }, desktop: { w: 1440, h: 900, dpr: 1, mobile: false } };
const SHOTS = process.argv[3];
async function run(name) {
  const V = VIEWS[name], res = {};
  const cdp = await chrome({ tag: 'tilt', port: [9600, 200] }), { send, ev, errs } = cdp;
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: V.dpr, mobile: V.mobile });
    if (V.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await send('Runtime.enable'); await send('Page.enable'); await send('Page.navigate', { url: BASE + (process.env.HS_PAGE || '') + '?tilt=' + Date.now() + (process.env.HS_QS || '') });
    for (let k = 0; k < 100; k++) { await sleep(300); if (await ev('!!(window.__m3&&__m3.tilt)')) break }
    await ev('__m3.story&&__m3.story(false);__m3.yaw(0);__m3.tilt(0);__m3.go(109.5,34.6,520)'); await sleep(800);
    const st = () => ev('({...__m3.tilt(),yaw:__m3.yaw(),d:__m3.dist?__m3.dist():null,cam:(()=>{const c=document.querySelector("canvas");return 0})()})');
    const shot = async tag => { if (!SHOTS) return; const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); (await import('node:fs')).writeFileSync(`${SHOTS}/${name}-${tag}.jpg`, Buffer.from(s.result.data, 'base64')) };
    const cx = V.w / 2, cy = V.h * .45;
    const touch = async (from, to, steps = 12) => {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: from.map(([x, y], i) => ({ x, y, id: i })) });
      for (let k = 1; k <= steps; k++) { const u = k / steps; await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: from.map(([x, y], i) => ({ x: x + (to[i][0] - x) * u, y: y + (to[i][1] - y) * u, id: i })) }); await sleep(16) }
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300) };
    const camY = () => ev('(()=>{const s=__m3.tilt();return s.el})()');
    await shot('0-default');
    if (V.mobile) {
      let a = await st(); await touch([[cx - 60, cy], [cx + 60, cy]], [[cx - 60, cy - 120], [cx + 60, cy - 120]]); let b = await st();
      res['touch-tilt'] = b.el < a.el - .1 ? 'PASS' : `FAIL ${a.el.toFixed(2)}→${b.el.toFixed(2)}`; await shot('1-tilted-up');
      a = b; await touch([[cx - 60, cy], [cx + 60, cy]], [[cx - 60, cy + 200], [cx + 60, cy + 200]]); b = await st();
      res['touch-down'] = b.el > a.el + .2 ? 'PASS' : `FAIL ${a.el.toFixed(2)}→${b.el.toFixed(2)}`;
      await ev('__m3.tilt(0)'); await sleep(300); a = await st();
      await touch([[cx, cy - 60], [cx, cy + 60]], [[cx, cy - 180], [cx, cy - 60]]); b = await st();
      res.stacked = b.el < a.el - .1 ? 'PASS' : `FAIL ${a.el.toFixed(2)}→${b.el.toFixed(2)}`;
      await ev('__m3.tilt(0)'); await sleep(300); a = await st();
      await touch([[cx - 50, cy - 50], [cx + 50, cy + 50]], [[cx - 50, cy + 100], [cx + 50, cy + 200]]); b = await st();
      res.diagonal = b.el > a.el + .1 ? 'PASS' : `FAIL ${a.el.toFixed(2)}→${b.el.toFixed(2)}`;
      await ev('__m3.tilt(0)'); await sleep(300); a = await st(); let zv = await ev('__m3.camDist()');
      await touch([[cx, cy - 40], [cx, cy + 40]], [[cx, cy - 140], [cx, cy + 140]]); b = await st(); let zv1 = await ev('__m3.camDist()');
      res['pinch-vert'] = zv1 < zv * .7 && Math.abs(b.off - a.off) < .01 ? 'PASS' : `FAIL dist ${zv?.toFixed(0)}→${zv1?.toFixed(0)} off ${a.off.toFixed(2)}→${b.off.toFixed(2)}`;
      await ev('__m3.tilt(0);__m3.go(109.5,34.6,520)'); await sleep(500); a = await st();
      await touch([[cx - 60, cy], [cx + 60, cy]], [[cx + 20, cy + 20], [cx + 140, cy + 20]]); b = await st();
      res['pan-side'] = Math.abs(b.off - a.off) < .01 ? 'PASS' : `FAIL off ${a.off.toFixed(2)}→${b.off.toFixed(2)}`;
      await ev('__m3.tilt(0);__m3.go(109.5,34.6,520)'); await sleep(300); a = await st(); const z0 = await ev('__m3.camDist()');
      await touch([[cx - 40, cy], [cx + 40, cy]], [[cx - 120, cy], [cx + 120, cy]]); b = await st(); const z1 = await ev('__m3.camDist()');
      res.pinch = z1 < z0 * .7 && Math.abs(b.off - a.off) < .01 ? 'PASS' : `FAIL dist ${z0?.toFixed(0)}→${z1?.toFixed(0)} off ${a.off.toFixed(2)}→${b.off.toFixed(2)}`;
      a = await st(); await touch([[cx, cy]], [[cx + 80, cy + 100]]); b = await st();
      res.pan = Math.abs(b.off - a.off) < .01 ? 'PASS' : `FAIL off ${a.off}→${b.off}`;
      await touch([[cx - 60, cy], [cx + 60, cy]], [[cx - 60, cy - 2000], [cx + 60, cy - 2000]], 30); b = await st();
      res.clamp = b.el >= .399 && b.el <= 1.501 ? 'PASS' : `FAIL el ${b.el}`; await shot('2-flattest');
    } else {
      const m = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: 1, ...extra });
      // mouse-turn (Wilson 2026-11-07 "转左佢转右"; left button since 20:01): a left-drag to the right turns the table so its near side follows the
      // cursor: a place below the screen centre (south of 长安) slides right, and the map turns anticlockwise (yaw falls)
      { await ev('__m3.yaw(0);__m3.tilt(0);__m3.go(109.5,34.6,520)'); await sleep(400); const p0 = await ev('__m3.proj(109.5,32.6)'), y0 = (await st()).yaw;
        await m('mousePressed', cx, cy, { clickCount: 1 }); for (let k = 1; k <= 12; k++) { await m('mouseMoved', cx + k * 10, cy); await sleep(16) } await m('mouseReleased', cx + 120, cy, { clickCount: 1 }); await sleep(400);
        const p1 = await ev('__m3.proj(109.5,32.6)'), y1 = (await st()).yaw;
        res['mouse-turn'] = p0[1] > cy && p1[0] > p0[0] + 20 && y1 < y0 - .3 ? 'PASS' : `FAIL south point x ${p0[0].toFixed(0)}→${p1[0].toFixed(0)} (y ${p0[1].toFixed(0)}) yaw ${y0.toFixed(2)}→${y1.toFixed(2)}`;
        await ev('__m3.yaw(0);__m3.tilt(0);__m3.go(109.5,34.6,520)'); await sleep(400) }
      { const r = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'right', buttons: 2, ...extra });
        await ev('__m3.yaw(0);__m3.tilt(0);__m3.go(109.5,34.6,520)'); await sleep(400); const a = await st(), p0 = await ev('__m3.proj(109.5,34.6)');
        await r('mousePressed', cx, cy, { clickCount: 1 }); for (let k = 1; k <= 12; k++) { await r('mouseMoved', cx + k * 10, cy + k * 5); await sleep(16) } await r('mouseReleased', cx + 120, cy + 60, { clickCount: 1 }); await sleep(400);
        const b = await st(), p1 = await ev('__m3.proj(109.5,34.6)');
        res['mouse-pan'] = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 60 && Math.abs(b.yaw - a.yaw) < .01 && Math.abs(b.off - a.off) < .01 ? 'PASS' : `FAIL 长安 ${p0.map(v => v.toFixed(0))}→${p1.map(v => v.toFixed(0))} yaw ${a.yaw.toFixed(2)}→${b.yaw.toFixed(2)} off ${a.off.toFixed(2)}→${b.off.toFixed(2)}`;
        await ev('__m3.yaw(0);__m3.tilt(0);__m3.go(109.5,34.6,520)'); await sleep(400) }
      let a = await st(); await m('mousePressed', cx, cy, { clickCount: 1 }); for (let k = 1; k <= 12; k++) { await m('mouseMoved', cx + k * 10, cy - k * 10); await sleep(16) } await m('mouseReleased', cx + 120, cy - 120, { clickCount: 1 }); await sleep(300); let b = await st();
      res['mouse-tilt'] = b.el < a.el - .1 && Math.abs(b.yaw - a.yaw) > .3 ? 'PASS' : `FAIL el ${a.el.toFixed(2)}→${b.el.toFixed(2)} yaw ${a.yaw.toFixed(2)}→${b.yaw.toFixed(2)}`; await shot('1-tilted');
      await m('mousePressed', cx, cy, { clickCount: 1 }); for (let k = 1; k <= 30; k++) { await m('mouseMoved', cx, cy + k * 60); await sleep(10) } await m('mouseReleased', cx, cy + 1800, { clickCount: 1 }); await sleep(300); b = await st();
      res.clamp = b.el >= .399 && b.el <= 1.501 ? 'PASS' : `FAIL el ${b.el}`;
    }
    await sleep(500); await ev('document.getElementById("compass").click()'); await sleep(1500); const c = await st();
    res.compass = Math.abs(c.off) < .02 && Math.abs(c.yaw % (2 * Math.PI)) < .02 ? 'PASS' : `FAIL off ${c.off.toFixed(3)} yaw ${c.yaw.toFixed(3)}`;
    res.errors = errs.length ? 'FAIL ' + errs.slice(0, 2).join(' | ') : 'PASS';
    return res;
  } finally { cdp.kill() }
}
let bad = 0;
for (const name of process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : Object.keys(VIEWS)) {
  const r = await run(name); console.log(`\n== ${name}`); for (const k in r) { if (!r[k].startsWith('PASS')) bad++; console.log(`${r[k].startsWith('PASS') ? '✓' : '✗'} ${k.padEnd(11)} ${r[k]}`) }
}
console.log(bad ? `\nFAIL: ${bad} check(s)` : '\nPASS: tilt gestures work');
process.exit(bad ? 1 : 0);
