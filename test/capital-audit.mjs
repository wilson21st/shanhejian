#!/usr/bin/env node
// Capital audit: the seal-red 竖匾 and the other cities' titles must follow the court through 581–763.
// Expected values come from 隋书 / 旧唐书 / 资治通鉴 (dates converted to the Western calendar, as event dates are).
//   node test/capital-audit.mjs
import { chrome, sleep, BASE } from './cdp.mjs';
const CASES = [ // date, seat, seal, a city title that must be shown ('' = none required)
  ['0581-06', '长安', '京', ''], ['0600-01', '大兴', '京', ''], ['0610-01', '大兴', '京', '洛阳 · 东都'], ['0617-03', '大兴', '京', '扬州 · 炀帝行在'],
  ['0626-07-02', '长安', '京', ''], ['0660-01', '长安', '京', '洛阳 · 东都'], ['0690-10-16', '神都', '京', '长安 · 西京'], ['0705-06', '洛阳', '驻', '长安 · 京师'],
  ['0730-01', '长安', '京', '太原 · 北都'], ['0745-01', '长安', '京', '洛阳 · 东京'], ['0756-03', '长安', '京', '洛阳 · 燕都'], ['0756-07-15', '长安', '陷', ''],
  ['0756-10', '灵武', '行', '成都 · 玄宗驻跸'], ['0757-05', '凤翔', '行', '长安 · 陷燕'], ['0757-11-14', '长安', '京', ''], ['0760-01', '长安', '京', '洛阳 · 史思明据'], ['0763-03', '长安', '京', '洛阳 · 东京']];
const cdp = await chrome({ tag: 'cap', port: [9600, 200] }), { send, ev } = cdp;
let code = 1;
try {
  await send('Page.enable'); await send('Page.navigate', { url: BASE + '?cap=' + Date.now() });
  for (let k = 0; k < 100; k++) { await sleep(300); if (await ev('!!(window.__m3&&__m3.cap)')) break }
  let bad = 0;
  for (const [d, seat, seal, city] of CASES) { const r = await ev(`__m3.cap(${JSON.stringify(d)})`);
    const ok = r.seat === seat && r.seal === seal && (!city || r.cities.includes(city));
    if (!ok) bad++; console.log(`${ok ? '✓' : '✗'} ${d}  ${r.seat}(${r.seal})${city ? '  ' + (r.cities.includes(city) ? city : 'missing ' + city) : ''}`) }
  const zhou = await ev(`(__m3.tlId('s690'),[...document.querySelectorAll('.lb.region')].map(e=>e.textContent).includes('大　周'))`);
  console.log(`${zhou ? '✓' : '✗'} 690 realm label reads 大　周`); if (!zhou) bad++;
  console.log(bad ? `FAIL: ${bad}` : `PASS: ${CASES.length + 1} checks`); code = bad ? 1 : 0;
} finally { cdp.kill() }
process.exit(code);
