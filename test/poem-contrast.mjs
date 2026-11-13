#!/usr/bin/env node
// v133 (Wilson 13:15: no 宣纸 panel — the poem is written straight onto the painting): is every character still legible?
// For each map poem the embedded page plays to its last frame at 390×844; then the glyphs are made transparent (so their halo,
// drawn from the glyph, goes too — the measure is conservative) and the screenshot gives the background each character sits
// on (painting + vignette + #veil). Per character: WCAG contrast of its ink colour against the worst 10% of the pixels in its
// cell (the brightest for light ink, the darkest for dark ink). The title column and poet line the same; the seal as a
// graphic (its cut strokes vs its red, from the shot as shown).  Large calligraphy → pass at 3:1 (WCAG AA large text / graphics).
//   node test/poem-contrast.mjs [ids…] [--shard k/n] [--vp=WxH] [--gate]  → table + "poem-contrast: …"
// v137 (Wilson 09:41: no white fog — no #veil, no halo): black ink straight on the painting, so dark paintings now read low.
// That is reported, not gated (exit 0) unless --gate; each row names the painting under the poem.
import { chrome, sleep, BASE } from './cdp.mjs';
import { decodePNG } from './png.mjs';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname, args = process.argv.slice(2);
const VP = (args.find(a => a.startsWith('--vp=')) || '--vp=390x844').slice(5).split('x').map(Number), GATE = args.includes('--gate'), mob = VP[0] < 600;
const sh = (args.find(a => a.startsWith('--shard=')) || '--shard=0/1').slice(8).split('/').map(Number);
let ids = args.filter(a => !a.startsWith('--'));
if (!ids.length) ids = [...Object.keys(JSON.parse(readFileSync(root + 'data/design-poem/map-shows.json'))), 'p23', 'p21', 'p11'].sort();
ids = ids.filter((_, i) => i % sh[1] === sh[0]);
const lin = c => (c /= 255) <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4, Lum = ([r, g, b]) => .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b);
const ratio = (a, b) => (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
const parse = s => { let m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/); if (m) return [+m[1], +m[2], +m[3]];
  m = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/); if (m) return [m[1] * 255, m[2] * 255, m[3] * 255]; m = s.match(/oklab\(([-\d.e]+) ([-\d.e]+) ([-\d.e]+)/); if (m) { const [L, a, b] = m.slice(1).map(Number);   // color-mix → oklab
    const l = (L + .3963377774 * a + .2158037573 * b) ** 3, M = (L - .1055613458 * a - .0638541728 * b) ** 3, S = (L - .0894841775 * a - 1.291485548 * b) ** 3;
    const g = x => 255 * (x <= .0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - .055), cl = x => Math.max(0, Math.min(255, g(Math.max(0, x))));
    return [cl(4.0767416621 * l - 3.3077115913 * M + .2309699292 * S), cl(-1.2684380046 * l + 2.6097574011 * M - .3413193965 * S), cl(-.0041960863 * l - .7034186147 * M + 1.707614701 * S)] }
  return null };
const c = await chrome({ tag: 'contrast', port: [9500, 150], args: [`--window-size=${VP[0]},${VP[1]}`, '--autoplay-policy=no-user-gesture-required'] });
let bad = 0; const rows = [];
try {
  await c.send('Runtime.enable'); await c.send('Page.enable');
  await c.send('Emulation.setDeviceMetricsOverride', { width: VP[0], height: VP[1], deviceScaleFactor: 1, mobile: mob });
  for (const id of ids) {
    await c.send('Page.navigate', { url: BASE + `design-poem.html?id=${id}&embed=1&mute=1&speed=8` }); await sleep(2500);
    let st; for (let k = 0; k < 200; k++) { st = await c.ev('JSON.stringify(window.__dp&&__dp.state())'); if (st && /"beat":3/.test(st) && !/"speaking":true/.test(st)) break; await sleep(300); }
    await sleep(3200);   // the last strokes dry (2.4 s, not scaled by speed)
    const info = JSON.parse(await c.ev(`JSON.stringify((()=>{const R=e=>{const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height]};
      const ch=[...document.querySelectorAll('#paper .col i')].map(e=>({r:R(e),c:getComputedStyle(e).color,t:e.textContent}));
      const tt=[...document.querySelectorAll('#paper .ttl span,#paper .ttl small')].map(e=>({r:R(e),c:getComputedStyle(e).color,t:e.textContent}));
      const se=document.querySelector('#paper .seal');return{ch,tt,seal:se?{r:R(se),img:se.tagName==='IMG'}:null,tone:__dp.state().tone,cap:([...document.querySelectorAll('#stage .sl .cap')].pop()||{}).textContent||'',title:document.title}})())`));
    const shot0 = decodePNG(Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
    await c.ev(`(()=>{const s=document.createElement('style');s.id='ctx';s.textContent='#paper i,#paper .ttl span,#paper .ttl small{color:transparent!important;text-shadow:none!important}#paper .seal{visibility:hidden!important}';document.head.append(s)})()`);
    await sleep(150);
    const png = decodePNG(Buffer.from((await c.send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64'));
    const px = png.px, B = png.bpp, W = png.w;
    const region = ([x, y, w, h]) => { const L = []; for (let j = Math.max(0, Math.round(y)); j < Math.min(png.h, Math.round(y + h)); j++) for (let i = Math.max(0, Math.round(x)); i < Math.min(W, Math.round(x + w)); i++) { const o = (j * W + i) * B; L.push(Lum([px[o], px[o + 1], px[o + 2]])) } return L.sort((a, b) => a - b) };
    const cr = e => { const ink = parse(e.c); if (!ink) return null; const Li = Lum(ink), L = region(e.r); if (!L.length) return null;
      const worst = Li > .3 ? L[Math.floor(L.length * .9)] : L[Math.floor(L.length * .1)]; return ratio(Li, worst) };
    const C = info.ch.map(cr).filter(x => x != null).sort((a, b) => a - b), T = info.tt.map(cr).filter(x => x != null).sort((a, b) => a - b);
    // the seal as shown: its strokes (pale, cut through the red) against the red — 90th vs 10th percentile of its own pixels (stroke vs field; the worn red is speckled)
    let seal = null; if (info.seal) { const [x, y, w, h] = info.seal.r, L = []; for (let j = Math.round(y + h * .1); j < Math.round(y + h * .9); j++) for (let i = Math.round(x + w * .1); i < Math.round(x + w * .9); i++) { const o = (j * shot0.w + i) * shot0.bpp; L.push(Lum([shot0.px[o], shot0.px[o + 1], shot0.px[o + 2]])) }
      L.sort((a, b) => a - b); if (process.env.SEALDBG) console.log("seal px", info.seal.r.map(Math.round), [.1,.25,.5,.75,.9,.97,1].map(f=>L[Math.min(L.length-1,Math.floor(L.length*f))].toFixed(3)).join(" ")); seal = L.length ? ratio(L[Math.floor(L.length * .9)], L[Math.floor(L.length * .1)]) : null; }
    const minC = C[0], med = C[C.length >> 1], minT = T[0];
    const lo3 = C.filter(x => x < 3).length, lo45 = C.filter(x => x < 4.5).length;
    const ok = minC >= 3 && (minT == null || minT >= 3) && (seal == null || seal >= 3); if (!ok) bad++;
    const row = `${ok ? 'ok  ' : 'LOW '} ${id} chars ${C.length} min ${minC?.toFixed(2)} median ${med?.toFixed(2)} · title min ${minT?.toFixed(2)} · <3:${lo3} <4.5:${lo45} · seal ${seal?.toFixed(2)} · painting「${info.cap}」 · tone ${JSON.stringify(info.tone)} · errs ${c.errs.length}`;
    console.log(row); rows.push(row);
  }
} finally { c.kill(); }
console.log(`poem-contrast ${VP.join('x')}: ${bad ? (GATE ? 'FAIL ' : 'LOW ') + bad : 'PASS'} (${ids.length} poems)`);
if (GATE && bad) process.exitCode = 1;
