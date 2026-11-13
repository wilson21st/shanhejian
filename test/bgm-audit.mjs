#!/usr/bin/env node
// Background-music audit: under a strict autoplay policy, does the music follow ▶/⏸, and does ♪ override it?
// Chrome runs with --autoplay-policy=document-user-activation-required (like Safari: no sound before a gesture) and the
// tap is a genuine CDP touch (touchstart + touchend), so it carries real user activation — a synthetic dispatchEvent
// would not. Per the HTML spec a touch's pointerdown is NOT activation-triggering (only its pointerup/touchend/click
// are), which is how an unlock bound to pointerdown silently fails on a phone.
//   node test/bgm-audit.mjs        # server on 127.0.0.1:7814 (HS_URL overrides)
import { chrome, sleep, BASE } from './cdp.mjs';
const cdp = await chrome({ tag: 'bgm-audit', port: [9300, 200], args: ['--no-first-run', '--autoplay-policy=document-user-activation-required',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }), { send, ev } = cdp;
let code = 1;
try {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 664, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Page.enable'); await send('Page.navigate', { url: BASE + '?bgm=' + Date.now() });
  for (let k = 0; k < 100; k++) { await sleep(300); if (await ev('!!(window.__m3&&window.__bgm)')) break; }
  await sleep(1500);
  // (2026-11-06) the music follows playback: silent until ▶, ▶ brings it in, ⏸ takes it out; ♪ flips the current state
  // until the next ▶/⏸. Every step is a genuine touch on the real button, so it carries user activation.
  const state = () => ev(`({ac:window.__bgm.ac?__bgm.ac.state:'none',on:__bgm.on,playing:!__bgm.trk.map.paused&&__bgm.trk.map.currentTime>0})`);
  const tapEl = async sel => { const c = await ev(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()`);
    for (const type of ['touchStart', 'touchEnd']) await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: c[0], y: c[1] }] }); };
  const steps = [
    ['on load', null, s => !s.on && !s.playing],
    ['tap ▶', '#play', s => s.on && s.playing && s.ac === 'running'],
    ['tap ⏸', '#play', s => !s.on],
    ['tap ♪ while paused', '#bgm', s => s.on && s.playing],
    ['tap ▶', '#play', s => s.on && s.playing],
    ['tap ♪ while playing', '#bgm', s => !s.on],
  ];
  let ok = true;
  // (2026-11-07) the map track is 《云宫迅音》: the right file, looping, and it actually decodes (duration known, ~4'20")
  { const t = await ev(`new Promise(r=>{const a=__bgm.trk.map,f=()=>r({src:a.src.split('/').pop(),loop:a.loop,dur:a.duration});if(a.readyState>=1)f();else{a.addEventListener('loadedmetadata',f,{once:true});a.load()}setTimeout(f,8000)})`);
    const pass = t.src === 'yungong.mp3' && t.loop && t.dur > 250 && t.dur < 270; ok = ok && pass;
    console.log(`${pass ? '✓' : '✗'} ${'map track 云宫迅音'.padEnd(20)} ${JSON.stringify(t)}`); }
  for (const [name, sel, want] of steps) {
    if (sel) await tapEl(sel);
    await sleep(sel ? 2200 : 300);
    const st = await state(), pass = want(st); ok = ok && pass;
    console.log(`${pass ? '✓' : '✗'} ${name.padEnd(20)} ${JSON.stringify(st)}`);
  }
  await ev('__m3.play&&0'); // leave the page as it is
  console.log(ok ? 'PASS: music follows ▶/⏸, and ♪ overrides it' : 'FAIL: music does not follow playback as designed');
  code = ok ? 0 : 1;
} finally { cdp.kill(); }
process.exit(code);
