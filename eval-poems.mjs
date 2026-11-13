#!/usr/bin/env node
// Schema + evidence checks for data/poems.json (隋唐名诗 581–763). Zero dependencies, Node ≥ 22.
// Mirrors test/eval-era.mjs. node eval-poems.mjs [path] → exits 1 on any hard failure; warnings print but do not fail.
import { readFileSync } from 'node:fs';

const path = process.argv[2] || new URL('./data/poems.json', import.meta.url);
const errs = [], warns = [];
const err = (where, msg) => errs.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);

let E;
try { E = JSON.parse(readFileSync(path, 'utf8')); }
catch (e) { console.log(`FAIL  poems.json does not parse: ${e.message}`); process.exit(1); }

const readJSON = name => { try { return JSON.parse(readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8')); } catch { warn(name, 'not readable; cross-file checks skipped'); return {}; } };
const ERA = readJSON('era.json'), WORLD = readJSON('world.json');

const TYPES = ['text', 'archaeology', 'inscription', 'artifact', 'art', 'foreign', 'modern'];
const STANCES = ['supports', 'complicates', 'contradicts'];
const CONF = ['high', 'medium', 'low'];
const PRECS = { day: /^\d{4}-\d{2}-\d{2}$/, month: /^\d{4}-\d{2}$/, year: /^\d{4}$/ };
const ANY_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const BOX = { lon: [72, 142], lat: [18, 52] };
const SPAN = ['0581', '0763'];            // poems are dated to the year at least; compare on the year
const REQ_EV = ['type', 'title', 'detail', 'stance', 'cite', 'url', 'confidence'];

// Traditional-only characters that should not appear in display text (poem text included: it is rendered in 简体).
const TRAD = new Set([...'國書為這個們來時說對開長門東馬與傳後軍漢陳楊煬劉張趙鄭蕭顏韓衛寧寶勢歷曆權戰爭亂變禮儀樂營廣興臺陽陰陸隴關闕號經記錄誌銘圖畫藝術宮會譯讀學舉萬齊鄴遼麗濟羅屬聖嶽鎮節範殺擊敗勝圍將帥師寫處從歸還遷遠運糧魚鳥龍鳳雲風氣電雜雙離難華葉藥蘇鍾鐘於隨歲鄉縣蘭嶺劍鬥蹟紀約紅級統絲綢織線網編緣績總繼續練絕給組結維貢負責貴買賣貨賜賞貞員質費資賊實審導專尋屆層岡島峽巖帳幣廟廢廳彈徑復徵態應懷戲戶執掃掛採揚換據擁擇擔擴擺攝敵數斷晉暫曉朧條極構槍標樣橋機歡殘毀湯滅滿潛澤濱灣烏無燒獻環現畢當發盡盤監眾礦禍禪種稅穩積窮競筆篤簡籠紙紛終綠緒緊繫義習聞聯聲職肅腦舊艦藍虛補裝襲覺規視親覽觀誰課調論諸講謀證識譜議護讓貝財貧販貪貯貸賀賃賓賢賦賴購贈趕農迴進過達違遙適遲選遺邊鄰醫釋針鈔銀銅鋒錢錦鍵鏡閉閏閒間閣閥閱闊陣隊階際險隱雖雞靈頂項順須頒頓預領頭頻題額願類顯飛飯飲飾養館駐騎驗體髮鬧鮮鳴鴻鵝鷹麥黃點黨齒龜鶴詩詞淚鬢濕煙蟬獨裏橫']);
const tradIn = s => [...new Set([...(s || '')].filter(c => TRAD.has(c)))].join('');
const checkSimp = (where, field, s, hard = true) => { const t = tradIn(s); if (t) (hard ? err : warn)(where, `${field} has traditional characters 「${t}」`); };

// meta
const M = E.meta || {};
if (!M.title) err('meta', 'title missing');
if (!M.calendar) err('meta', 'calendar missing');
const inSpan = d => d.slice(0, 4) >= SPAN[0] && d.slice(0, 4) <= SPAN[1];

// places: poems.json's own, falling back to era.json, then world.json (non-palace) places
const P = E.places || {};
const resolve = id => P[id] || ERA.places?.[id] || (WORLD.places?.[id]?.ll ? WORLD.places[id] : undefined);
const inBox = ll => Array.isArray(ll) && ll.length === 2 && ll.every(Number.isFinite) && ll[0] >= BOX.lon[0] && ll[0] <= BOX.lon[1] && ll[1] >= BOX.lat[0] && ll[1] <= BOX.lat[1];
let nApprox = 0;
for (const [id, p] of Object.entries(P)) {
  const w = `places.${id}`;
  if (!p.name) err(w, 'name missing');
  if (!inBox(p.ll)) err(w, `ll ${JSON.stringify(p.ll)} not [lon,lat] inside lon 72–142, lat 18–52`);
  if (typeof p.approx !== 'boolean') err(w, 'approx must be true|false');
  if (p.approx) { nApprox++; if (!p.note) err(w, 'approx place needs a note saying why'); }
  checkSimp(w, 'name', p.name); checkSimp(w, 'note', p.note);
  // an id shared with era.json / world.json must mean the same spot
  for (const [src, q] of [['era.json', ERA.places?.[id]], ['world.json', WORLD.places?.[id]]])
    if (q?.ll && p.ll && (Math.abs(q.ll[0] - p.ll[0]) > 0.05 || Math.abs(q.ll[1] - p.ll[1]) > 0.05)) err(w, `ll differs from ${src} ${q.ll}`);
  if (WORLD.places?.[id]?.view === 'palace') err(w, 'reuses a palace-view id from world.json');
}

// events
const eraIds = new Set((ERA.events || []).map(e => e.id)), worldIds = new Set((WORLD.events || []).map(e => e.id));
const evs = E.events || [];
if (!Array.isArray(evs) || !evs.length) err('events', 'no events');
const ids = new Set(), byType = Object.fromEntries(TYPES.map(t => [t, 0])), byStance = {}, byConf = {}, byImp = { 1: 0, 2: 0, 3: 0 }, byPrec = {}, poets = {};
let nEvid = 0, prev = '', nDebate = 0, nThin = 0;
const usedPlaces = new Set();
for (const [i, e] of evs.entries()) {
  const w = `events[${i}] ${e.id}`;
  if (!e.id) err(w, 'id missing');
  if (ids.has(e.id)) err(w, 'duplicate id'); ids.add(e.id);
  if (eraIds.has(e.id)) err(w, 'id clashes with an era.json event');
  if (worldIds.has(e.id)) err(w, 'id clashes with a world.json event');
  if (!PRECS[e.prec]) err(w, `prec "${e.prec}" not day|month|year`);
  else { byPrec[e.prec] = (byPrec[e.prec] || 0) + 1; if (!PRECS[e.prec].test(e.date || '')) err(w, `date "${e.date}" does not match prec ${e.prec}`); }
  if (e.date && !inSpan(e.date)) err(w, `date ${e.date} outside ${SPAN.join('–')}`);
  if (e.endDate !== undefined) {
    if (!ANY_DATE.test(e.endDate)) err(w, `endDate "${e.endDate}" malformed`);
    else { if (e.endDate < e.date.slice(0, e.endDate.length)) err(w, 'endDate before date'); if (!inSpan(e.endDate)) err(w, 'endDate outside span'); }
  }
  if (e.date && e.date < prev) err(w, `out of chronological order (after ${prev})`); prev = e.date || prev;
  const pl = resolve(e.place);
  if (!pl) err(w, `place "${e.place}" not in poems.json, era.json or world.json places`);
  else { usedPlaces.add(e.place); if (!inBox(pl.ll)) err(w, `place ${e.place} ll ${JSON.stringify(pl.ll)} outside map box`); }
  if (e.kind !== 'cul') err(w, `kind "${e.kind}" must be cul`);
  if (![1, 2, 3].includes(e.importance)) err(w, 'importance must be 1|2|3'); else byImp[e.importance]++;
  for (const f of ['title', 'summary', 'why']) if (!e[f]) err(w, `${f} missing`);
  if ([...(e.title || '')].length > 16) warn(w, `title ${[...e.title].length} chars (>16)`);
  for (const f of ['title', 'summary', 'why', 'debate']) checkSimp(w, f, e[f]);
  if (e.who !== undefined && !Array.isArray(e.who)) err(w, 'who must be an array');
  for (const n of e.who || []) checkSimp(w, 'who', n);
  if (e.debate) nDebate++;

  // poem block
  const p = e.poem;
  if (!p || typeof p !== 'object') err(w, 'poem missing');
  else {
    for (const f of ['poet', 'title', 'form']) if (!p[f]) err(w, `poem.${f} missing`);
    if (!Array.isArray(p.text) || !p.text.length || !p.text.every(l => typeof l === 'string' && l.trim())) err(w, 'poem.text must be a non-empty array of lines');
    if (typeof p.excerpt !== 'boolean') err(w, 'poem.excerpt must be true|false');
    if (p.poet && !(e.who || []).includes(p.poet)) err(w, `poem.poet ${p.poet} not in who`);
    if (p.title && !(e.title || '').includes(p.title.split(/[·（(]/)[0].replace(/[《》]/g, ''))) warn(w, `title 「${e.title}」 does not name the poem 「${p.title}」`);
    for (const f of ['poet', 'title', 'form']) checkSimp(w, `poem.${f}`, p[f]);
    for (const l of p.text || []) checkSimp(w, 'poem.text', l);
    poets[p.poet] = (poets[p.poet] || 0) + 1;
  }

  const ev = Array.isArray(e.evidence) ? e.evidence : (err(w, 'evidence missing'), []);
  const types = new Set(ev.map(x => x.type));
  if (ev.length < 2) err(w, `${ev.length} evidence items, needs ≥2`);
  if (types.size < 2) { warn(w, `only one evidence type (${[...types]})`); nThin++; }
  if (!types.has('text')) err(w, 'no "text" evidence item for the poem text');
  if (!types.has('modern')) err(w, 'no "modern" evidence item for the 系年');
  const textItem = ev.find(x => x.type === 'text' && /卷/.test(x.cite || ''));
  if (!textItem) err(w, 'the text evidence must name the 卷 in cite');
  if (e.importance === 3 && (ev.length < 3 || types.size < 3)) warn(w, `importance 3 with ${ev.length} items of ${types.size} types (aim ≥3 of ≥3)`);
  const seen = new Set();
  for (const [j, x] of ev.entries()) {
    const wx = `${w} evidence[${j}]`; nEvid++;
    for (const f of REQ_EV) if (x[f] === undefined || x[f] === null || x[f] === '') err(wx, `${f} missing`);
    if (x.type && !TYPES.includes(x.type)) err(wx, `type "${x.type}" invalid`); else if (x.type) byType[x.type]++;
    if (x.stance && !STANCES.includes(x.stance)) err(wx, `stance "${x.stance}" invalid`); else if (x.stance) byStance[x.stance] = (byStance[x.stance] || 0) + 1;
    if (x.confidence && !CONF.includes(x.confidence)) err(wx, `confidence "${x.confidence}" invalid`); else if (x.confidence) byConf[x.confidence] = (byConf[x.confidence] || 0) + 1;
    if (x.url && !/^https?:\/\/[^\s]+\.[^\s]+/.test(x.url)) err(wx, `url "${x.url}" not http(s)`);
    if (x.year !== undefined && !Number.isInteger(x.year)) err(wx, 'year must be an integer');
    const key = x.url + '|' + x.title; if (seen.has(key)) warn(wx, 'duplicate evidence item'); seen.add(key);
    for (const f of ['title', 'detail', 'where']) checkSimp(wx, f, x[f]);
    checkSimp(wx, 'cite', x.cite, false);
  }
}
for (const id of Object.keys(P)) if (!usedPlaces.has(id)) warn(`places.${id}`, 'defined but not used by any event');
if (evs.length < 20 || evs.length > 26) warn('events', `${evs.length} poems (aim 20–26)`);
if (byImp[3] < 5 || byImp[3] > 7) warn('events', `${byImp[3]} importance-3 poems (aim ~6)`);

const fmt = o => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ');
console.log(`poems.json · ${evs.length} poems · ${Object.keys(P).length} own places (${nApprox} approx) · ${nEvid} evidence items · ${nDebate} with debate`);
console.log(`  importance: ${fmt(byImp)}`);
console.log(`  prec:       ${fmt(byPrec)}`);
console.log(`  poets:      ${fmt(poets)}`);
console.log(`  evidence:   ${fmt(byType)}`);
console.log(`  stance:     ${fmt(byStance)}`);
console.log(`  confidence: ${fmt(byConf)}`);
for (const w of warns) console.log(`  warn  ${w}`);
for (const e of errs) console.log(`  FAIL  ${e}`);
console.log(errs.length ? `FAIL (${errs.length} problems, ${warns.length} warnings)` : `PASS (${warns.length} warnings)`);
process.exit(errs.length ? 1 : 0);
