#!/usr/bin/env node
// Story entry audit (v120): every 说书 card on the map timeline — 玄武门 e0629, 渭水之盟 s626ws, 马嵬驿 s756 — opens
// shuoshu.html?s=<id>&embed=1 in the unroll overlay, shows 「← 大地图」, and that button closes the overlay back onto the
// same step and camera (camDist + where 长安 projects). Also the 渭水 wiki card's 📜 button. Phone 390×844 and desktop
// 1440×900, one Chrome. Fails on any uncaught JS error or any 4xx/5xx response.
//   node test/story-audit.mjs
import { chrome, sleep, BASE } from './cdp.mjs';
const CARDS = [['e0629', 'xuanwumen'], ['s626ws', 'weishui'], ['s756', 'mawei']];
const VIEWS = [['phone', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }], ['desktop', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }]];
const c = await chrome({ tag: 'story', port: [9700, 200], keepEvents: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] }), { send, ev } = c;
let bad = 0, n = 0; const ok = (t, msg) => { n++; if (!t) bad++; console.log(`${t ? '✓' : '✗'} ${msg}`); };
const CAM = 'JSON.stringify([__m3.camDist(),__m3.proj(108.94,34.26).map(Math.round)])';
const waitFor = async (expr, ms = 8000) => { for (let k = 0; k < ms / 100; k++) { if (await ev(expr)) return true; await sleep(100); } return false; };
try {
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  for (const [vn, vm] of VIEWS) {
    await send('Emulation.setDeviceMetricsOverride', vm);
    await send('Page.navigate', { url: BASE + 'index.html?story=' + Date.now() });
    await waitFor('!!(window.__m3&&__m3.tlId&&document.getElementById("rng").max>0)', 30000); await sleep(1500);
    for (const [id, sid] of CARDS) {
      await ev(`__m3.tlId(${JSON.stringify(id)})`); await sleep(4000);
      const step = await ev('rng.value'), cam0 = await ev(CAM);
      const card = await ev('(document.querySelector(".lb.scrollc")||{}).innerText||""');
      ok(/说书 · 点击听书/.test(card), `${vn} ${id}: card reads 「📜 说书 · 点击听书」`);
      await ev('document.querySelector(".lb.scrollc").click()');
      ok(await waitFor('!!document.querySelector("#scrollOv.open")'), `${vn} ${id}: overlay unrolls`);
      await sleep(1500);
      const src = await ev('document.querySelector("#scrollOv iframe").getAttribute("src")');
      ok(src === `shuoshu.html?s=${sid}&embed=1`, `${vn} ${id}: opens ${src}`);
      const home = await ev('document.querySelector("#scrollOv iframe").contentDocument.getElementById("home").textContent');
      ok(home === '← 大地图', `${vn} ${id}: back button reads ${home}`);
      await ev('document.querySelector("#scrollOv iframe").contentDocument.getElementById("home").click()');
      ok(await waitFor('!document.getElementById("scrollOv")'), `${vn} ${id}: 「← 大地图」 closes the overlay`);
      await sleep(4000);
      const step1 = await ev('rng.value'), cam1 = await ev(CAM);
      ok(step1 === step && cam1 === cam0, `${vn} ${id}: back on step ${step1} (was ${step}), camera ${cam1} (was ${cam0})`);
    }
    await ev('__m3.tlId("s626ws")'); await sleep(1500); await ev('__m3.wiki("s626ws")'); await sleep(1200);
    const wb = await ev('(document.querySelector(".wscroll")||{}).innerText||""');
    ok(wb.includes('听说书《渭水之盟》'), `${vn} s626ws wiki: button reads ${wb.trim()}`);
    await ev('document.querySelector(".wscroll").click()');
    ok(await waitFor('(document.querySelector("#scrollOv iframe")||{getAttribute:()=>""}).getAttribute("src")==="shuoshu.html?s=weishui&embed=1"'), `${vn} s626ws wiki: 📜 opens the 说书`);
    await sleep(1500); await ev('document.querySelector("#scrollOv iframe").contentDocument.getElementById("home").click()');
    ok(await waitFor('!document.getElementById("scrollOv")'), `${vn} s626ws wiki: closes`);
  }
  const http = c.events.filter(e => e.method === 'Network.responseReceived' && e.params.response.status >= 400).map(e => e.params.response.status + ' ' + e.params.response.url);
  const old = c.events.filter(e => e.method === 'Network.requestWillBeSent' && /(xuanwumen|mawei)\.html/.test(e.params.request.url)).length;
  ok(!c.errs.length, `JS errors: ${c.errs.length}${c.errs.length ? ' ' + JSON.stringify(c.errs[0]).slice(0, 200) : ''}`);
  ok(!http.length, `HTTP errors: ${http.length}${http.length ? ' ' + http.slice(0, 3).join(', ') : ''}`);
  ok(!old, `old handscroll pages requested: ${old}`);
  console.log(bad ? `FAIL: ${bad}/${n}` : `PASS: ${n} checks`);
} finally { c.kill(); }
process.exit(bad ? 1 : 0);
