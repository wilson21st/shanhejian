#!/usr/bin/env node
// v133 (Wilson 2026-11-11 14:06: a long poem title broke onto a second line mid-phrase): every poem's opening title (#title .t)
// at 390×844 and 1440×900 — lines, where each line breaks, overflow — plus the vertical title column (.ttl) on the paper.
// PASS = no line ends mid-phrase (a break is only at a .seg boundary), nothing overflows the stage, ≤ 2 lines.
//   node test/poem-title.mjs [ids…]
import { chrome, sleep, BASE } from './cdp.mjs';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname;
const ALL = [...new Set([...JSON.parse(readFileSync(root + 'data/poems.json')).events, ...JSON.parse(readFileSync(root + 'data/person-poems.json')).poems].map(e => e.id))];
const IDS = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
const c = await chrome({ tag: 'ptitle', port: [9700, 80], args: ['--window-size=1440,900'] });
const M = `(()=>{const t=document.querySelector('#title .t'),st=document.getElementById('stage');if(!t||!t.textContent)return null;
  const sr=st.getBoundingClientRect(),tr=t.getBoundingClientRect();
  // the line each character sits on (by its own rect), and the segment it belongs to
  const chars=[];const walk=(n,seg)=>{for(const k of n.childNodes){if(k.nodeType===3){for(let i=0;i<k.data.length;i++){const r=document.createRange();r.setStart(k,i);r.setEnd(k,i+1);const b=r.getBoundingClientRect();if(b.width)chars.push({ch:k.data[i],top:Math.round(b.top),l:b.left,r:b.right,seg})}}else walk(k,k.classList&&k.classList.contains('seg')?k:seg)}};walk(t,null);
  const tops=[...new Set(chars.map(x=>x.top))].sort((a,b)=>a-b),lines=[];for(const tp of tops){const L=chars.filter(x=>Math.abs(x.top-tp)<4);if(L.length&&!lines.some(l=>l.includes(L[0])))lines.push(L)}
  let mid=0;for(let i=1;i<lines.length;i++){const a=lines[i-1][lines[i-1].length-1],b=lines[i][0];if(!a.seg||a.seg===b.seg)mid++}
  const over=chars.some(x=>x.l<sr.left-1||x.r>sr.right+1)||tr.left<sr.left-1||tr.right>sr.right+1;
  return {text:t.textContent,lines:lines.map(l=>l.map(x=>x.ch).join('')),mid,over,font:parseFloat(getComputedStyle(t).fontSize)}})()`;
const TTL = `(()=>{try{layPaper()}catch(e){return 'err '+e.message}const t=document.querySelector('#paper .ttl'),st=document.getElementById('stage');if(!t)return null;
  const s=[...t.querySelectorAll('span')].map(e=>e.getBoundingClientRect()),sr=st.getBoundingClientRect();
  const cols=new Set(s.map(r=>Math.round(r.left+r.width/2))).size;/* v136: by centre — a turned （ ） (span.vr) has another box width */return {cols,over:s.some(r=>r.bottom>sr.bottom+1||r.top<sr.top-1)}})()`;
let bad = 0;
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  for (const [w, h, mob] of [[390, 844, true], [1440, 900, false]]) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mob ? 2 : 1, mobile: mob });
    for (const id of IDS) {
      await c.send('Page.navigate', { url: BASE + 'design-poem.html?id=' + id + '&mute=1' });
      let r = null; for (let k = 0; k < 30 && !r; k++) { await sleep(300); r = await c.ev(`window.__dp&&__dp.ready?${M}:null`); }
      await c.ev('document.fonts.ready'); await sleep(300); r = await c.ev(M); const p = await c.ev(TTL);
      const ok = r && r.lines.length <= 2 && !r.mid && !r.over && p && typeof p === 'object' && !p.over && p.cols === 1;
      if (!ok) bad++;
      console.log(`${w}x${h} ${id} ${ok ? 'PASS' : 'FAIL'} ${r ? `${r.lines.length}L ${r.font}px [${r.lines.join(' | ')}] mid=${r.mid} over=${r.over}` : 'no title'} ttl=${JSON.stringify(p)}`);
    }
  }
  console.log('fails', bad, 'errs', c.errs.length, JSON.stringify(c.errs.slice(0, 3)));
} finally { c.kill(); }
process.exit(bad || c.errs.length ? 1 : 0);
