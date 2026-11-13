#!/usr/bin/env node
// 书院 stage screenshots (?stage=song, 2026-11-07): phone + desktop at four poses — default (长安 at the page's zoom), out (zoomed
// right out, the page's own tilt), low (zoomed out and tilted to the lowest the clamp allows: the sitter's view of the window)
// and turn (low, twisted toward the 香几). Forked from stage-shots.mjs.
//   node test/song-shots.mjs <outDir> [stages=song] [views=phone,desktop] [extraJs]
import { chrome, sleep, BASE } from './cdp.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const VIEWS = { phone: { w: 390, h: 844, dpr: 2, mobile: true }, desktop: { w: 1440, h: 900, dpr: 1, mobile: false } };
const OUT = process.argv[2] || '/tmp/stage-shots', STAGES = (process.argv[3] || 'song').split(','), VS = (process.argv[4] || 'phone,desktop').split(','), EXTRA = process.argv[5] || '';
mkdirSync(OUT, { recursive: true });
const POSES = {
  default: '__m3.yaw(0);__m3.tilt(0);__m3.go(109.5,34.6,520)',
  out: '__m3.yaw(0);__m3.tilt(0);__m3.go(107.5,35,9e9)',
  low: '__m3.yaw(0);__m3.go(107.5,35,9e9);__m3.tilt(-3)',
  turn: '__m3.yaw(-.35);__m3.go(107.5,35,9e9);__m3.tilt(-3)',
  back: '__m3.yaw(2.6);__m3.go(107.5,35,9e9);__m3.tilt(-3)',
  rear: '__m3.yaw(Math.PI);__m3.go(107.5,35,9e9);__m3.tilt(-3)', // turned right round: the 座屏 behind the seat (2026-11-07)
  rearup: '__m3.yaw(Math.PI);__m3.tilt(0);__m3.go(107.5,35,9e9)',
};
async function run(view) {
  const V = VIEWS[view];
  const cdp = await chrome({ tag: 'stage', port: [9800, 150], args: ['--use-angle=metal'] }), { send, ev, errs } = cdp;
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: V.dpr, mobile: V.mobile });
    await send('Runtime.enable'); await send('Page.enable');
    for (const s of STAGES) {
      await send('Page.navigate', { url: `${BASE}?t=${Date.now()}` });
      for (let k = 0; k < 100; k++) { await sleep(300); if (await ev('!!(window.__m3&&__m3.tilt)')) break }
      await ev('__m3.story&&__m3.story(false)'); if (EXTRA) await ev(EXTRA); await sleep(600);
      for (const [pose, js] of Object.entries(POSES)) {
        await ev(js); await sleep(1600);
        const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
        writeFileSync(`${OUT}/s${s}-${view}-${pose}.jpg`, Buffer.from(r.result.data, 'base64'));
      }
      console.log(view, 'stage', s, 'ok', errs.length ? 'ERR ' + errs.join(' | ') : '');
      errs.length = 0;
    }
   
  } finally { cdp.kill() }
}
for (const v of VS) await run(v);
