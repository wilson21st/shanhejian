#!/usr/bin/env node
// UI audit: renders both pages in headless Chrome at iPhone sizes, walks through the states a person sees,
// and fails on layout defects a person would notice. Zero dependencies (Node ≥ 22: global WebSocket + fetch).
//
//   node test/ui-audit.mjs            # server must be running on 127.0.0.1:7814 (HS_URL overrides)
//
// Checks (each finding names the rule, the page, the viewport and the element):
//   text-overflow   any text inside a label, plaque, button or card that sticks out of its own box
//   overlap         two fixed controls covering each other (e.g. a lens tag on top of 「← 大地图」)
//   offscreen       a fixed control pushed outside the viewport
//   label-overlap   two map labels printed on top of each other (e.g. 百济 over 新罗 in the overview)
//   js-error        uncaught exceptions or console.error (a favicon 404 is ignored)
//   cantonese       visible UI text using Cantonese-only characters (the UI is 普通话)
//   misaligned      an event card's kind icon more than 2px off the centre line of its text
//   lint            CSS that WebKit (iPhone Safari) renders differently from Chrome: writing-mode on labels
// Limitation: this is Chrome, not WebKit. The lint list is how WebKit-only bugs found on the iPhone get locked out.
import { chrome, sleep, BASE } from './cdp.mjs';
import { readdirSync, readFileSync } from 'node:fs';

const VIEWS = [{ name: 'portrait 390×664', w: 390, h: 664 }, { name: 'landscape 844×390', w: 844, h: 390 }];
const ROOT = new URL('..', import.meta.url).pathname;

// What to check on each page. text: boxes whose text must stay inside; ctrl: fixed controls that must not collide.
const PAGES = [
  { path: '', name: 'map', wait: 4500,
    // tlId(id) jumps the timeline to a specific event id, not a step index — the step index of any given id shifts
    // whenever data/era.json's event count changes, but its id never does
    text: '.lb.city,.lb.pop,#lgb,#lg div,#tld,#wikiOv .wt b,#wikiOv .wt small,#wikiOv .wst,#wikiOv .evT,#xs .xc b,#xs .xc small,#who .nm,#who .xk,#who .nav button',
    ctrl: '#lgb,#tl,#bot button,#top>*,#wikiOv .whead,#wikiOv .wx,#who,#xs,#life',
    states: [
      ['start', ''],
      ['overview', '__m3.go(112,38,2400)'],
      ['overview rotated', '__m3.go(118,38,2400);__m3.yaw(0.6)'],
      ['war pop', '__m3.tlId("e626a")'],
      ['玄武门 story card', '__m3.tlId("e0629")'],
      ['capital close-up', '__m3.tlId("e626a");__m3.go(109.2,34.9,420)'],
      ['legend open', 'document.getElementById("lgb").click()'],
      // 581–763 era layer (data/era.json): headline card (longest title), normal card (longest title), wiki overlay open
      ['era headline long title', '__m3.tlId("s763")'],
      ['era normal long title', '__m3.tlId("s738")'],
      ['poem card', '__m3.tlId("p09")'],
      ['poem wiki open', '__m3.tlId("p09");setTimeout(()=>__m3.wiki("p09"),250)', 2500],
      ['era story entry', '__m3.tlId("s756");setTimeout(()=>__m3.wiki("s756"),250)', 2500],
      ['渭水 story card', '__m3.tlId("s626ws")'],
      ['story overlay open', '__m3.tlId("s626ws");setTimeout(()=>document.querySelector(".lb.scrollc").click(),600)', 4500],
      ['city tapped', '__m3.tlId("s755");__m3.go(113,34.7,380);setTimeout(()=>__m3.city("汴州"),300)', 1200],
      ['era wiki open', '__m3.tlId("s581");setTimeout(()=>__m3.wiki("s581"),250)', 2500],
      ['story 回', '__m3.story(true);__m3.tl(1)', 1500],
      ['story folded', '__m3.story(false);__m3.tl(5)', 1500],
      ['story expanded', '__m3.story(true);__m3.tlId("e0629");setTimeout(()=>document.getElementById("huimu").click(),700)', 2500],
      ['person view', '__m3.person("lishimin",3)', 3500],
      ['person 李白', '__m3.person("libai")', 3500],
      ['person 李白×杜甫 crossing', '__m3.person("libai");setTimeout(()=>__m3.cross("dufu",0),500)', 3500],
      ['person 李白 playing mid-journey', '__m3.person("libai",5);setTimeout(()=>{__m3.play();setTimeout(__m3.play,2600)},800)', 3500],
      ['person 李白×杜甫 converging', '__m3.person("libai",8);setTimeout(()=>__m3.cross("dufu",0),1500)', 2600],
      ['person 李白×杨贵妃 legend', '__m3.person("libai");setTimeout(()=>__m3.cross("yangguifei",0),500)', 3500],
    ] },
  // the handscrolls (xuanwumen.html / mawei.html) were retired in v120 and are now redirects to 说书; test/shuoshu-audit.mjs covers it
];

// Runs inside the page. Returns findings for the current state.
const AUDIT = (textSel, ctrlSel) => {
  const out = [], vis = e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05 && e.getClientRects().length; };
  const name = e => e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  const onScreen = r => r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  for (const e of document.querySelectorAll(textSel)) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (!onScreen(r)) continue;
    const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      if (!n.textContent.trim() || !vis(n.parentElement)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const bad = [...rg.getClientRects()].find(q => q.width && (q.left < r.left - 1 || q.right > r.right + 1 || q.top < r.top - 1 || q.bottom > r.bottom + 1));
      if (bad) { out.push({ rule: 'text-overflow', el: name(e), text: n.textContent.trim().slice(0, 14) }); break; }
    }
  }
  const ctr = [...document.querySelectorAll(ctrlSel)].filter(vis).map(e => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width && r.height);
  for (let i = 0; i < ctr.length; i++) {
    const [a, A] = ctr[i];
    if (A.left < -1 || A.top < -1 || A.right > innerWidth + 1 || A.bottom > innerHeight + 1) out.push({ rule: 'offscreen', el: name(a) });
    for (let j = i + 1; j < ctr.length; j++) {
      const [b, B] = ctr[j]; if (a.contains(b) || b.contains(a)) continue;
      const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ix > 2 && iy > 2) out.push({ rule: 'overlap', el: name(a) + ' × ' + name(b) });
    }
  }
  // map labels (not event pops, which may stack by design) must not be printed on top of each other
  const labs = [...document.querySelectorAll('.lb.city,.lb.region')].filter(vis).map(e => [e, e.getBoundingClientRect()]).filter(([, r]) => onScreen(r));
  for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) {
    const [a, A] = labs[i], [b, B] = labs[j];
    const ix = Math.min(A.right, B.right) - Math.max(A.left, B.left), iy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (ix > 3 && iy > 3) out.push({ rule: 'label-overlap', el: a.textContent.trim().slice(0, 8) + ' × ' + b.textContent.trim().slice(0, 8) });
  }
  // UI text is 普通话 (Wilson 2026-11-04): Cantonese-only characters or phrases in anything a reader can see fail
  const yue = (document.body.innerText.match(/[㩒嘅睇唔喺咗啲嗰冇佢哋咁乜嚟噉揿]|点解|仲有|而家/g) || []);
  if (yue.length) out.push({ rule: 'cantonese', el: 'body', text: [...new Set(yue)].join('') });
  // the kind sign (animated icon + glyph) must sit on the same centre line as the text that follows it
  for (const kh of document.querySelectorAll('.lb.pop .kh')) { if (!vis(kh)) continue; const nx = kh.nextElementSibling || kh.parentElement;
    const a = kh.getBoundingClientRect(), b = nx.getBoundingClientRect(), d = (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2;
    if (nx !== kh.parentElement && Math.abs(d) > 2) out.push({ rule: 'misaligned', el: name(kh.parentElement), text: `icon ${d.toFixed(1)}px off the text` }); }
  return out;
};

function lint() {
  const out = [];
  // the pages and everything they load from the project (css/, js/: the page CSS left index.html in v115)
  const own = d => { try { return readdirSync(ROOT + d).filter(f => /\.(css|js)$/.test(f)).map(f => d + '/' + f); } catch { return []; } };
  for (const f of ['index.html', 'shuoshu.html', 'shuoshu-list.html', ...own('css'), ...own('js')]) {
    const src = readFileSync(ROOT + f, 'utf8');
    if (/writing-mode\s*:\s*vertical/.test(src)) out.push({ rule: 'lint', el: f, text: 'writing-mode:vertical-* (WebKit sizes the box as horizontal; stack characters with <br> instead)' });
  }
  return out;
}

let findings = lint();
const page = await chrome({ tag: 'ui-audit', port: [9333, 400], keepEvents: true,
  args: ['--no-first-run', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
try {
  await page.send('Runtime.enable'); await page.send('Page.enable');
  for (const P of PAGES) for (const V of VIEWS) {
    await page.send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: 2, mobile: true });
    await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    page.events.length = 0;
    await page.send('Page.navigate', { url: BASE + (P.path || process.env.HS_PAGE || '') + '?audit=' + Date.now() + (process.env.HS_QS || '') });
    await sleep(P.wait);
    for (const [label, js, extra = 0] of P.states) {
      // extra: more settle time for states with a CSS transition (headless WebGL frames are slow, so transitions lag)
      if (js) { await page.send('Runtime.evaluate', { expression: js }); await sleep(1600 + extra); }
      const r = await page.send('Runtime.evaluate', { expression: `(${AUDIT})(${JSON.stringify(P.text)},${JSON.stringify(P.ctrl)})`, returnByValue: true });
      for (const f of r.result?.result?.value || []) findings.push({ ...f, page: P.name, view: V.name, state: label });
    }
    for (const e of page.events) {
      const err = e.method === 'Runtime.exceptionThrown' ? e.params.exceptionDetails?.exception?.description || e.params.exceptionDetails?.text
        : e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error' ? e.params.args.map(a => a.value ?? a.description).join(' ') : null;
      if (err && !/favicon/.test(err)) findings.push({ rule: 'js-error', page: P.name, view: V.name, text: String(err).slice(0, 120) });
    }
  }
} finally { page.kill(); }

const seen = new Set(), uniq = findings.filter(f => { const k = [f.rule, f.page, f.view, f.el, f.text].join('|'); return !seen.has(k) && seen.add(k); });
for (const f of uniq) console.log(`✗ ${f.rule.padEnd(13)} ${f.page || ''} ${f.view || ''} ${f.state ? '[' + f.state + ']' : ''} ${f.el || ''} ${f.text ? '«' + f.text + '»' : ''}`);
console.log(uniq.length ? `FAIL: ${uniq.length} finding(s)` : 'PASS: no text overflow, overlap, offscreen control, JS error or WebKit-unsafe CSS');
process.exit(uniq.length ? 1 : 0);
