// 说书 engine: shared clip DSL + story builder. One clip per string: "<flags>|<text>".
// Flags (space separated, any order): pace 急 紧 平 缓 慢 (default 平) · speaker id (default narr) · + = same paragraph as the
// previous clip · ^ = 醒木 before it · ~ms = silence before it · @slide = switch slide · !1 / !2 = 扣子 colour.
// %id = a line of verse `id` (%dc = the 定场诗): the page shows the verse as a calligraphy card, a line per clip; the text
// after the last ：is the line. Titles: story.verses[id].title (default for dc: 「<title> · 定场诗」).
// In a 回's beats: "#起" = 起承转合 mark, "?q1" = question from story.Q.
// The 捧哏 listener is just a speaker: "peng 紧|后来呢？" (own voice, own bubble on the page).
// A story module (tools/shuoshu/<id>.mjs) default-exports { meta, voices, cast, slides, claims, Q, hui } and build() writes
// data/shuoshu/<id>/story.json plus the 书目 catalogue data/shuoshu/stories.json.
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
export const PACES = ['急', '紧', '平', '缓', '慢'];
export function clip(s) {
  const i = s.indexOf('|'); if (i < 0) throw new Error('clip without "|": ' + s);
  const o = { w: 'narr', p: '平', t: s.slice(i + 1) };
  for (const f of s.slice(0, i).split(/\s+/).filter(Boolean)) {
    if (PACES.includes(f)) o.p = f; else if (f === '+') o.c = 1; else if (f === '^') o.mu = 1;
    else if (f[0] === '~') o.pre = +f.slice(1); else if (f[0] === '@') o.s = f.slice(1); else if (f[0] === '%') o.v = f.slice(1); else if (f === '!1' || f === '!2') o.hook = +f[1];
    else o.w = f;
  }
  return o;
}
export const L = a => a.map(clip);
// shared pace table: TTS rate offset (%), the page's silence after the clip (ms) - `end` after a full sentence (。！？) so a
// tense run still breathes between sentences - and `max`, the ceiling in 字/s gen-shuoshu-audio.mjs holds every clip under
// (test/shuoshu-pace-gate.mjs R1). v121: 急 was +52% / 40 ms and came out at 6.5–11 字/s; tension now comes from short
// sentences and tight clause gaps, the voice tops out near 6 字/s (natural Mandarin ≈ 5.2).
export const PACE = { 急: { rate: 34, gap: 80, end: 240, max: 6.0 }, 紧: { rate: 24, gap: 150, end: 260, max: 5.8 },
  平: { rate: 12, gap: 300, max: 5.6 }, 缓: { rate: 2, gap: 620, max: 5.3 }, 慢: { rate: -10, gap: 950, max: 4.8 } };
// the 捧哏 listener, same in every story (voice can be overridden per story)
export const PENG = { cast: { seal: '听', name: '听书的', c: '#3f7a5c' }, voice: { engine: 'edge', voice: 'zh-CN-XiaoyiNeural', rate: '+16%', pitch: '+2Hz' } };
// 问说书人 answers: one string per answer, cut into relaxed clips at the sentence breaks
export const ans = t => t.split(/(?<=[。？！])/).filter(Boolean).map((x, k) => ({ w: 'narr', p: k ? '缓' : '平', t: x, ...(k ? { c: 1 } : {}) }));

const root = new URL('../../', import.meta.url);
export function build(st) {
  const { meta, Q = {} } = st;
  const beat = s => typeof s !== 'string' ? s : s[0] === '#' ? { mark: s.slice(1) } : s[0] === '?' ? { q: need(Q[s.slice(1)], s) } : clip(s);
  const need = (x, s) => { if (!x) throw new Error(`${meta.id}: unknown question ${s}`); return x; };
  const voices = { ...st.voices, peng: st.voices.peng || PENG.voice };
  const cast = { ...st.cast, peng: st.cast.peng || PENG.cast };
  const out = { meta, voices, pace: PACE, cast, slides: st.slides, claims: st.claims || {},
    hui: st.hui.map(h => ({ ...h, beats: h.beats.map(beat), ask: h.ask || [] })) };
  // verses: lines in speaking order; each flagged clip gets vk = its line index
  const verses = {};
  for (const h of out.hui) for (const b of h.beats) if (b.v) {
    const V = verses[b.v] ||= { title: st.verses?.[b.v]?.title || (b.v === 'dc' ? `${meta.title} · 定场诗` : ''), lines: [] };
    b.vk = V.lines.push(b.t.split('：').pop().replace(/[^\u4e00-\u9fff]/g, '')) - 1;
  }
  if (Object.keys(verses).length) out.verses = verses;
  // sanity: every speaker has a voice + cast entry, every slide id exists, every cite claim exists
  const errs = [], seen = new Set();
  const chk = l => { if (!l || !l.t) return; if (!voices[l.w]) errs.push('no voice ' + l.w); if (!cast[l.w]) errs.push('no cast ' + l.w);
    if (l.s && !out.slides[l.s]) errs.push('no slide ' + l.s); };
  for (const h of out.hui) {
    for (const b of h.beats) { chk(b); if (b.q) { seen.add(b.q.id); b.q.choices.forEach(c => c.react.forEach(chk)); b.q.reveal.forEach(chk); } }
    for (const a of h.ask) { a.a.forEach(chk); for (const c of a.cite || []) if (!out.claims[c]) errs.push('no claim ' + c); }
  }
  if (errs.length) throw new Error(meta.id + ':\n' + [...new Set(errs)].join('\n'));
  const dir = new URL(`data/shuoshu/${meta.id}/`, root); mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('story.json', dir), JSON.stringify(out, null, 0).replace(/\{"(id|w|mark|q)":/g, '\n{"$1":'));
  // catalogue entry
  const catF = new URL('data/shuoshu/stories.json', root);
  const cat = existsSync(catF) ? JSON.parse(readFileSync(catF)) : [];
  const clips = out.hui.flatMap(h => h.beats).filter(b => b.t);
  const chars = clips.reduce((n, b) => n + b.t.length, 0);
  const entry = { id: meta.id, title: meta.title, year: meta.year, era: meta.era, blurb: meta.blurb, dispute: meta.dispute, cover: meta.cover,
    hui: out.hui.length, questions: seen.size, asks: out.hui.reduce((n, h) => n + h.ask.length, 0), mins: Math.round(chars / 4.8 / 60 * 1.6), order: meta.order };
  const k = cat.findIndex(x => x.id === meta.id); if (k >= 0) cat[k] = entry; else cat.push(entry);
  cat.sort((a, b) => (a.order ?? a.year) - (b.order ?? b.year));
  writeFileSync(catF, JSON.stringify(cat, null, 1));
  return { clips: clips.length, questions: seen.size, asks: entry.asks, peng: clips.filter(b => b.w === 'peng').length };
}
