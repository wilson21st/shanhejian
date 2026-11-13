#!/usr/bin/env node
// 说书 engine audit: shuoshu.html?s=$S (default xuanwumen) in iPhone portrait ($W×$H, default 390×844). Plays the whole story
// by simulated taps (every question answered, one 问说书人 per 回, one interrupting a line), fails on JS errors, horizontal
// overflow, overlapping dock/sheet, a stuck run, a missing mp3 for any clip. Also: the slide stage must switch (≥30 slides),
// 醒木 must strike, all five paces used, the 捧哏 listener must speak (≥$PENG lines, default 6). Then a short real-audio run
// (lines must advance on the mp3s' ended). Screenshots → $OUT (default /tmp/shuoshu-shots/<id>).
// Verses (v121): the 定场诗 card must appear in the 马善政 brush font (loaded, not a fallback), every line the same length,
// characters on one grid (same x down a line, same y across lines), inside the stage; every verse clip inks its line in.
//   S=mawei W=360 H=640 node test/shuoshu-audit.mjs
import { chrome, sleep, BASE } from './cdp.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFileSync } from 'node:fs';
const SID = process.env.S || 'xuanwumen';
const OUT = process.env.OUT || '/tmp/shuoshu-shots/' + SID; mkdirSync(OUT, { recursive: true });
const STORY = JSON.parse(readFileSync(new URL(`../data/shuoshu/${SID}/story.json`, import.meta.url)));
const NQ = STORY.hui.flatMap(h => h.beats).filter(b => b.q).length;
const DISPUTE_HUI = STORY.hui.findIndex(h => h.beats.some(b => b.q && b.q.kind === 'dispute'));
const ASK_HUI = STORY.hui.findIndex((h, i) => i > 0 && h.ask.length);
const PAGE = BASE + 'shuoshu.html?s=' + SID;
const c = await chrome({ tag: 'shuoshu', port: [9500, 300], args: ['--autoplay-policy=no-user-gesture-required'], keepEvents: true });
const fail = [];
const shot = async name => { const r = await c.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const layout = () => c.ev(`(()=>{const W=innerWidth,bad=[];
  for(const e of document.querySelectorAll('#app *, #sheet *')){const r=e.getBoundingClientRect();if(!r.width||getComputedStyle(e).visibility==='hidden')continue;
    if(e.closest('#sheet')&&!document.getElementById('sheet').classList.contains('on'))continue;
    if(e.matches('.sl')||e.closest('.sl')&&e.matches('.fg,.back,.cap,.vig'))continue; // Ken Burns layers are meant to overhang the clipped stage
    if(r.right>W+1||r.left<-1)bad.push('offscreen '+e.className+' '+(e.textContent||'').slice(0,12));
    if(e.scrollWidth>e.clientWidth+2&&getComputedStyle(e).overflowX!=='auto')bad.push('overflow '+e.className+' '+(e.textContent||'').slice(0,12))}
  const tx=document.getElementById('tx').getBoundingClientRect(),dk=document.getElementById('dock').getBoundingClientRect();
  if(tx.bottom>dk.top+1)bad.push('tx under dock');if(dk.bottom>innerHeight+1)bad.push('dock off bottom');
  return bad.slice(0,8)})()`);
try {
  await c.send('Runtime.enable'); await c.send('Page.enable'); await c.send('Network.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: +(process.env.W||390), height: +(process.env.H||844), deviceScaleFactor: 3, mobile: true });
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true });
  // verse card: play the opening at normal (muted) speed until the 定场诗 has inked in, then measure it
  const DC = STORY.verses?.dc;
  if (!DC) fail.push('no 定场诗 verse (%dc) in story.json');
  else {
    await c.send('Page.navigate', { url: PAGE + '&mute=1' }); await sleep(1500);
    await c.ev(`document.getElementById('go').click()`);
    const want = DC.lines.join('').length; let on = 0;
    for (let t = 0; t < 60 && on < want; t++) { await sleep(500); on = await c.ev(`document.querySelectorAll('.card.verse .vc.on').length`); }
    await sleep(900);
    const v = await c.ev(`(()=>{const g=[...document.querySelectorAll('.sl')].pop().querySelector('.card.verse');if(!g)return null;
      const st=document.getElementById('stage').getBoundingClientRect(),lines=[];
      for(let k=0;g.querySelector('.vc.l'+k);k++)lines.push([...g.querySelectorAll('.vc.l'+k)].map(e=>{const r=e.getBoundingClientRect();return{x:r.left,y:r.top,r:r.right,b:r.bottom}}));
      const ff=[...document.fonts].find(f=>f.family.replace(/"/g,'')==='MaShanZheng');
      return{lines,inside:lines.flat().every(r=>r.x>=st.left-1&&r.r<=st.right+1&&r.y>=st.top-1&&r.b<=st.bottom+1),
        font:ff?ff.status:'none',family:getComputedStyle(g.querySelector('.vc')).fontFamily,size:parseFloat(getComputedStyle(g.querySelector('.vg')).fontSize),
        title:g.querySelector('.vt').textContent,
        clash:[g.querySelector('.stamp'),g.querySelector('.vt')].some(o=>{const q=o.getBoundingClientRect();return lines.flat().some(r=>r.x<q.right&&r.r>q.left&&r.y<q.bottom&&r.b>q.top)})}})()`);
    if (!v) fail.push('定场诗 verse card never shown');
    else {
      const len = new Set(v.lines.map(l => l.length)), xs = v.lines.map(l => Math.max(...l.map(r => r.x)) - Math.min(...l.map(r => r.x)));
      const ys = v.lines[0].map((_, i) => { const y = v.lines.map(l => l[i]?.y).filter(y => y != null); return Math.max(...y) - Math.min(...y); });
      console.log(`verse: ${v.lines.length} lines × ${[...len]} 字, ${on}/${want} inked, font ${v.font} (${v.family.split(',')[0]}), ${v.size}px, x spread ≤ ${Math.max(...xs).toFixed(1)} px, y spread ≤ ${Math.max(...ys).toFixed(1)} px, inside stage ${v.inside}`);
      if (v.lines.length !== DC.lines.length) fail.push(`verse shows ${v.lines.length} lines, want ${DC.lines.length}`);
      if (len.size !== 1) fail.push('verse lines differ in length: ' + [...len]);
      if (on < want) fail.push(`verse inked ${on}/${want} characters`);
      if (v.font !== 'loaded') fail.push('brush font not loaded: ' + v.font);
      if (Math.max(...xs) > 1 || Math.max(...ys) > 1) fail.push('verse characters off the grid');
      if (!v.inside) fail.push('verse spills out of the stage');
      if (v.clash) fail.push('verse characters under the title or the 说书 stamp');
      if (v.size < 18) fail.push(`verse font only ${v.size}px`);
      await shot('0b-verse');
    }
  }
  await c.send('Page.navigate', { url: PAGE + '&mute=1&speed=14' });
  await sleep(1500);
  await shot('0-start');
  await c.ev(`document.getElementById('go').click()`);
  const t0 = Date.now(); let questions = 0, asks = 0, interrupt = false, lastHui = -1, shots = new Set(), seenEnd = false;
  while (Date.now() - t0 < 240000) {
    await sleep(250);
    const s = await c.ev('__ss.state()');
    if (!s) { fail.push('no state'); break; }
    if (s.hui !== lastHui) { lastHui = s.hui; interrupt = false; }
    // interrupt a speaking line with 问说书人 once (回2)
    if (s.hui === ASK_HUI && s.speaking && !interrupt && !s.answering && s.lines > 6) { interrupt = true; await c.ev('__ss.ask(0)'); asks++; continue; }
    if (s.answering && !shots.has('ask')) { await sleep(400); await c.ev(`document.getElementById('askbtn').click()`); await sleep(500); await shot('3-ask-sheet'); await c.ev(`document.getElementById('sheetx').click()`); shots.add('ask'); }
    if (!s.waiting || s.answering) continue;
    const L = s.waiting;
    for (const b of await layout()) fail.push(`hui${s.hui} ${b}`);
    if (L.some(x => x.startsWith('明白'))) { // a reveal just finished
      if (s.hui === DISPUTE_HUI && !shots.has('reveal4')) { await shot('2-dispute-reveal'); shots.add('reveal4'); }
      await c.ev('__ss.choose(0)'); continue;
    }
    if (L.some(x => x.startsWith('下一回') || x.startsWith('从头'))) {
      if (L.length > 1 && s.hui !== ASK_HUI && !shots.has('end' + s.hui)) { shots.add('end' + s.hui); await c.ev(`document.querySelector('#choices .ch').click()`); await sleep(400); await c.ev(`document.querySelector('#aqs .aq').click()`); asks++; continue; }
      if (L[L.length - 1].startsWith('从头')) { seenEnd = true; await shot('4-end'); break; }
      await c.ev(`__ss.choose(${L.length - 1})`); continue;
    }
    if (L.length >= 2) { // a question
      questions++;
      if (s.hui === 1 && !shots.has('q1')) { await sleep(300); await shot('1-question1'); shots.add('q1'); }
      if (s.hui === DISPUTE_HUI && !shots.has('q4')) { await shot('1b-dispute'); shots.add('q4'); }
      await c.ev(`__ss.choose(${questions % L.length})`);
    }
  }
  if (!seenEnd) fail.push('did not reach the end: ' + JSON.stringify(await c.ev('__ss.state()')));
  if (questions !== NQ) fail.push(`questions answered ${questions}, want ${NQ}`);
  const st = (await c.ev('__ss.state()')).stat;
  console.log(SID, 'clips', st.clips, 'pace', JSON.stringify(st.pace), 'slide switches', st.slides, '醒木', st.mu, '捧哏', st.peng || 0);
  if ((st.peng || 0) < +(process.env.PENG ?? 6)) fail.push(`捧哏 spoke ${st.peng || 0} lines`);
  if (st.slides < 30) fail.push(`only ${st.slides} slide switches`);
  if (st.mu < 6) fail.push(`only ${st.mu} 醒木`);
  if (Object.keys(st.pace).length < 5) fail.push('not all five paces used');
  const NV = STORY.hui.flatMap(h => h.beats).filter(b => b.v).length;
  if ((st.verse || 0) !== NV) fail.push(`verse lines inked ${st.verse || 0}, want ${NV}`);
  console.log(`muted run: ${((Date.now() - t0) / 1000).toFixed(0)} s, ${questions} questions, ${asks} 问说书人`);
  // v132 one player: the subtitle band never shows more than 3 lines over the whole story
  const pl = await c.ev('window.PL?PL.stat():null'); console.log('subtitles:', JSON.stringify(pl));
  if (!pl || pl.maxLines > 3 || pl.over) fail.push('subtitle over 3 lines: ' + JSON.stringify(pl));
  // real audio: 引子 must advance on the mp3s
  // every spoken clip must have an mp3 in the index
  const AU = JSON.parse(readFileSync(new URL(`../data/shuoshu/${SID}/audio/index.json`, import.meta.url)));
  const { lines } = await import('../gen-shuoshu-audio.mjs');
  const miss = lines(STORY).filter(l => !AU[`${l.w}|${l.p}|${l.t}`]);
  if (miss.length) fail.push(`${miss.length} clips without audio, e.g. ${miss[0].w}|${miss[0].t}`);
  await c.send('Page.navigate', { url: PAGE }); await sleep(1500);
  await c.ev(`document.getElementById('go').click()`); await sleep(20000);
  const a = await c.ev(`({lines:document.querySelectorAll('.ln').length,src:document.getElementById('au').src.split('/').pop(),t:document.getElementById('au').currentTime,typed:document.querySelector('.ln.cur .t')?.textContent.length})`);
  console.log('audio run after 20 s:', JSON.stringify(a));
  if (!(a.lines >= 2)) fail.push('audio run did not advance past line 1');
  await shot('5-audio-run');
  if (SID === 'xuanwumen') { // the old link must still land on the engine
    await c.send('Page.navigate', { url: BASE + 'design-shuoshu.html?mute=1' }); await sleep(1500);
    const u = await c.ev('location.href'); console.log('design-shuoshu.html →', u);
    if (!/shuoshu\.html\?s=xuanwumen&mute=1/.test(u)) fail.push('design-shuoshu.html redirect broken: ' + u);
  }
  const bad = c.events.filter(e => (e.method === 'Network.responseReceived' && e.params.response.status >= 400) || e.method === 'Network.loadingFailed');
  const reqs = c.events.filter(e => e.method === 'Network.requestWillBeSent').map(e => e.params.request.url);
  console.log(`requests: ${reqs.length}, bad: ${bad.length}, design-ink refs: ${reqs.filter(u => /design-(ink|shanshui|act)/.test(u)).length}`);
  for (const e of bad) fail.push('NET ' + (e.params.response ? e.params.response.status + ' ' + e.params.response.url : e.params.errorText + ' ' + e.params.requestId));
  if (reqs.some(u => /design-(ink|shanshui|act)/.test(u))) fail.push('loads an old design-* asset');
  if (c.errs.length) fail.push(...c.errs.map(e => 'JS ' + JSON.stringify(e).slice(0, 200)));
} finally { c.kill(); }
console.log(fail.length ? 'FAIL\n' + fail.join('\n') : 'PASS'); process.exit(fail.length ? 1 : 0);
