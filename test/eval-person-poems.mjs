#!/usr/bin/env node
// v131: the poems on 人物传 stops. Every stops[].poems id resolves (poems.json events or person-poems.json); each
// person-poems entry has a poet among `who`, simplified text, a date confidence + note, and ≥2 evidence items (the
// wikisource text + a modern 系年) with urls; a stop's poem is dated within 3 years of the stop (the card says when).
//   node test/eval-person-poems.mjs
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url).pathname, J = f => JSON.parse(readFileSync(root + f, 'utf8'));
const P = J('data/people.json'), Q = J('data/person-poems.json'), E = J('data/poems.json');
const TRAD = new Set([...'國書為這個們來時說對開長門東馬與傳後軍漢陳楊劉張趙鄭蕭顏韓衛寧寶勢歷權戰爭亂變禮儀樂營廣興臺陽陰陸隴關闕號經記錄圖畫藝術宮會讀學舉萬齊遼麗濟羅屬聖嶽鎮節範殺擊敗勝圍將帥師寫處從歸還遷遠運糧魚鳥龍鳳雲風氣電雜雙離難華葉藥蘇鍾鐘於隨歲鄉縣蘭嶺劍鬥紀約紅級統絲綢織線網編緣績總繼續練絕給組結維貴買賣貨賜賞員質費資賊實審導專尋層岡島峽巖帳廟廢廳徑復態應懷戲戶執掃掛採揚換據擁擇擔擴擺敵數斷晉暫曉條極構槍標樣橋機歡殘毀湯滅滿潛澤濱灣烏無燒獻環現畢當發盡盤監眾禍禪種稅穩積窮競筆簡籠紙紛終綠緒緊義習聞聯聲職肅腦舊藍虛補裝襲覺規視親覽觀誰課調論諸講謀證識議護讓財貧販貪賀賓賢賦賴購贈趕農迴進過達違遙適遲選遺邊鄰醫釋銀銅鋒錢錦鏡閉閒間閣閱闊陣隊階際險隱雖雞靈頂項順須頓預領頭頻題額願類顯飛飯飲飾養館駐騎驗體髮鬧鮮鳴鴻鵝鷹麥黃點黨齒龜鶴詩詞淚鬢濕煙蟬獨裏橫']);
const errs = [], err = (w, m) => errs.push(`${w}: ${m}`), trad = s => [...String(s || '')].filter(c => TRAD.has(c)).join('');
const byId = new Map([...E.events, ...Q.poems].map(e => [e.id, e]));
const ids = new Set();
for (const q of Q.poems) {
  const w = q.id; if (ids.has(w)) err(w, 'duplicate id'); ids.add(w);
  if (E.events.some(e => e.id === w)) err(w, 'id clashes with poems.json');
  const p = q.poem || {}; if (!p.poet || !(q.who || []).includes(p.poet)) err(w, 'poet not in who');
  if (!Array.isArray(p.text) || !p.text.length) err(w, 'no text'); if (typeof p.excerpt !== 'boolean') err(w, 'excerpt must be boolean');
  if (!['high', 'medium', 'low'].includes(q.dateConf) || !q.dateNote) err(w, 'dateConf/dateNote missing');
  if (!/^\d{4}$/.test(q.date)) err(w, 'date must be YYYY');
  if (!Array.isArray(q.ll) || q.ll.length !== 2) err(w, 'll missing');
  const ev = q.evidence || []; if (ev.length < 2 || !ev.some(x => x.type === 'text') || !ev.some(x => x.type === 'modern')) err(w, 'needs text + modern evidence');
  for (const x of ev) { for (const f of ['type', 'title', 'detail', 'stance', 'cite', 'url', 'confidence']) if (!x[f]) err(w, `evidence.${f} missing`); if (x.url && !/^https:\/\//.test(x.url)) err(w, 'evidence url'); }
  const t = trad([q.title, q.summary, q.debate, q.dateNote, q.placeName, p.title, p.short, ...(p.text || []), ...ev.flatMap(x => [x.title, x.detail])].join(''));
  if (t) err(w, `traditional characters 「${[...new Set(t)].join('')}」`);
}
let n = 0, used = new Set();
for (const p of P.people) for (const s of p.stops) for (const id of s.poems || []) {
  n++; used.add(id); const e = byId.get(id), w = `${p.id}@${s.year}${s.place}`;
  if (!e) { err(w, `poem ${id} not found`); continue }
  const loose = e.dateConf === 'low' || (Q._meta.undated || {})[id];
  if (!loose && Math.abs(+e.date.slice(0, 4) - s.year) > 3) err(w, `${id} dated ${e.date} is more than 3 years from the stop`);
}
for (const q of Q.poems) if (!used.has(q.id)) err(q.id, 'not on any stop');
console.log(`person-poems · ${Q.poems.length} new poems · ${n} poem links on ${P.people.reduce((a, p) => a + p.stops.filter(s => s.poems).length, 0)} stops · ${used.size} distinct poems`);
for (const e of errs) console.log('  FAIL ', e);
console.log(errs.length ? `FAIL (${errs.length})` : 'PASS'); process.exitCode = errs.length ? 1 : 0;
