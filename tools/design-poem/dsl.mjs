// 吟诗 design mock: a copy of the 说书 clip DSL (tools/shuoshu/dsl.mjs), kept separate so the mock never touches the engine.
// One clip per string: "<flags>|<text>". Flags: pace 急 紧 平 缓 慢 · speaker id (default narr) · + same paragraph ·
// ^ 醒木 · ~ms silence before · @slide.
// Text may carry TTS-only readings: "一日还[环]" shows 还 but the voice reads 环 (Edge reads 还 as hái).
export const PACES = ['急', '紧', '平', '缓', '慢'];
export function clip(s) {
  const i = s.indexOf('|'); if (i < 0) throw new Error('clip without "|": ' + s);
  const raw = s.slice(i + 1), o = { w: 'narr', p: '平', t: shown(raw) };
  if (raw.includes('[')) o.say = said(raw);
  for (const f of s.slice(0, i).split(/\s+/).filter(Boolean)) {
    if (PACES.includes(f)) o.p = f; else if (f === '+') o.c = 1; else if (f === '^') o.mu = 1;
    else if (f[0] === '~') o.pre = +f.slice(1); else if (f[0] === '@') o.s = f.slice(1);
    else o.w = f;
  }
  return o;
}
export const shown = t => t.replace(/\[[^\]]*\]/g, '');
export const said = t => t.replace(/.\[([^\]]*)\]/g, '$1');
export const L = a => a.map(clip);
// gentler than the 说书 table (hs-pace-1110 found 急 +52% too fast); poems are recited, not told
export const PACE = { 急: { rate: 20, gap: 120 }, 紧: { rate: 12, gap: 200 }, 平: { rate: 4, gap: 340 }, 缓: { rate: -2, gap: 640 }, 慢: { rate: -10, gap: 950 } };
