// The 山河鉴 tools, shared by the MCP endpoint (functions/mcp.js) and the plain REST twin (functions/api/[res].js,
// functions/api/[res]/[id].js), /openapi.json and /llms.txt: one definition, one validator, one rate limit.
import { EVENT_SCHEMA, POEM_SCHEMA, SHUOSHU_SCHEMA } from '../js/contrib-schema.js';
import { KINDS, SITE, SPAN, add, world } from './contrib-store.js';

export const SERVER = { name: 'shanhejian', title: '山河鉴 · Shanhejian history map', version: '1.0.0', websiteUrl: SITE };
export const INSTRUCTIONS = `山河鉴 (${SITE}) is a 3D history map of China for 581–763 CE (隋 to the end of the 安史之乱), with poems and 说书 (storyteller) tellings.
Read with list_events / get_event / list_places / list_poems / list_shuoshu / get_shuoshu. Add with add_event, add_poem, add_shuoshu:
what you add is validated and goes live on the public site at once, marked as a community contribution.
Rules for adding: write in simplified Chinese; cite at least one source you actually read, with an https url (zh.wikisource.org, a museum, a paper);
dates are Julian YYYY, YYYY-MM or YYYY-MM-DD with a 4-digit year (0641, 0755-12-16); a place is an existing id (list_places) or {name, ll:[lon, lat]}.
Call list_events/list_poems first to avoid duplicates. If a call fails, the error names each wrong field: fix those and call again.`;

const yearOf = d => +String(d).slice(0, 4);
const clip = (s, n) => s && s.length > n ? s.slice(0, n) + '…' : s;
const placeOf = (W, id) => { const p = W.places[id]; return p ? { place: id, placeName: p.name, ll: p.ll } : { place: id }; };

export const EX_EVENT = { title: '大慈恩寺塔建成', date: '0652', kind: 'cul', place: 'changan',
  summary: '永徽三年，玄奘为安置自天竺带回的经像，奏请于大慈恩寺西院建塔。高宗出资，塔仿西域窣堵波形制，砖表土心，五层，即后来的大雁塔。',
  why: '保存玄奘所携梵本经像，成为长安佛教与中外交流的地标。', who: ['玄奘', '唐高宗'], importance: 1,
  evidence: [{ type: 'text', title: '《大慈恩寺三藏法师传》记建塔', cite: '慧立、彦悰《大慈恩寺三藏法师传》卷七', url: 'https://zh.wikisource.org/wiki/大慈恩寺三藏法師傳/卷七' }] };
export const EX_POEM = { date: '0749', place: { name: '陇山道中', ll: [106.3, 34.9] },
  poem: { poet: '岑参', title: '逢入京使', form: '七言绝句', text: ['故园东望路漫漫，双袖龙钟泪不干。', '马上相逢无纸笔，凭君传语报平安。'] },
  summary: '天宝八载（749），岑参首次出塞，赴安西任高仙芝幕府掌书记。西行途中遇到东归长安的使者，马上相逢，无纸笔可写家书，只托他口头报平安。',
  evidence: [{ type: 'text', title: '《全唐诗》卷二百零一收《逢入京使》', cite: '《全唐诗》卷201', url: 'https://zh.wikisource.org/wiki/逢入京使' }] };
export const EX_SHUOSHU = { title: '安禄山起兵', year: 755, era: '唐 天宝十四载', blurb: '范阳鼓声动地来。三镇节度使安禄山以讨杨国忠为名，十五万人南下。',
  dispute: '起兵是蓄谋已久，还是被杨国忠逼反？《旧唐书》说他早有异志，《资治通鉴》记杨国忠屡言其必反、有意激之。',
  hui: [{ title: '第一回 范阳起兵', text: '天宝十四载十一月初九，范阳城外……' }, { title: '第二回 渔阳鼙鼓', text: '……' }],
  place: 'youzhou', who: ['安禄山', '杨国忠', '唐玄宗'],
  sources: [{ type: 'text', title: '《资治通鉴》卷二百一十七', cite: '《资治通鉴》卷217', url: 'https://zh.wikisource.org/wiki/資治通鑑/卷217' }] };

const ex = (schema, example) => ({ ...schema, examples: [example] });
export const TOOLS = [
  { name: 'list_events', title: 'List events on the map',
    description: `List the historical events on the 山河鉴 map (${SPAN.join('–')} CE), curated and community-added. Filter by year range, kind and a Chinese text match (title, place name, summary, people). Returns id, date, kind, title, place, ll [lon, lat], a short summary and source (curated | github | community). Use get_event for the full record with evidence.`,
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      from: { type: 'integer', description: 'first year CE, default 581' }, to: { type: 'integer', description: 'last year CE, default 763' },
      kind: { type: 'string', enum: Object.keys(KINDS), description: Object.entries(KINDS).map(([k, v]) => k + '=' + v).join(', ') },
      q: { type: 'string', description: 'substring to match, e.g. 吐蕃 or 李白' }, source: { type: 'string', enum: ['curated', 'github', 'community'] },
      limit: { type: 'integer', minimum: 1, maximum: 200, description: 'default 30' }, offset: { type: 'integer', minimum: 0 } } },
    annotations: { readOnlyHint: true, openWorldHint: false } },
  { name: 'get_event', title: 'Get one event or poem in full',
    description: 'The full record of one event or poem by id (from list_events / list_poems): summary, why, who, debate, every piece of evidence with its source url, and the poem text if it is a poem.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', description: 'e.g. s641 (文成公主入藏) or p01' } } },
    annotations: { readOnlyHint: true } },
  { name: 'list_places', title: 'Find place ids',
    description: 'Search the map\'s named places (city, battlefield, pass, temple…) to get a place id and its [lon, lat]. Use the id as `place` in add_event / add_poem / add_shuoshu; if the place is not there, pass {name, ll:[lon, lat]} instead. With near:[lon, lat] results are sorted by distance.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      q: { type: 'string', description: 'substring of the name, e.g. 长安, 潼关, 扬州' },
      near: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2, description: '[lon, lat]' },
      limit: { type: 'integer', minimum: 1, maximum: 200, description: 'default 20' } } },
    annotations: { readOnlyHint: true } },
  { name: 'add_event', title: 'Add an event to the map (live)',
    description: `Add a historical event (${SPAN.join('–')} CE) to the 山河鉴 map. It is validated, stored and shown on ${SITE} for everyone at once, marked 社区补充. `
      + 'Required: title (≤40 chars), date (Julian YYYY | YYYY-MM | YYYY-MM-DD, 4-digit year), kind (' + Object.entries(KINDS).map(([k, v]) => k + '=' + v).join(', ')
      + '), summary (2–6 sentences), place (id from list_places, or {name, ll:[lon, lat]}), evidence (1–8 sources, each {type, title, cite, url:https}). '
      + 'Optional: why, who[], debate, endDate, importance 1|2. Simplified Chinese, no HTML. Check list_events first so you do not add a duplicate. '
      + 'Returns {ok, id, url} or {ok:false, errors:[...]} naming each wrong field.',
    inputSchema: ex(EVENT_SCHEMA, EX_EVENT), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: 'list_poems', title: 'List poems on the map',
    description: 'List the poems pinned on the map (who wrote what, where and roughly when), curated and community-added. Filter by poet, text match, year range. Returns id, date, poet, title, place and the first line; get_event gives the full text and evidence.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      poet: { type: 'string', description: 'e.g. 李白' }, q: { type: 'string', description: 'substring of title, text or summary' },
      from: { type: 'integer' }, to: { type: 'integer' }, limit: { type: 'integer', minimum: 1, maximum: 200, description: 'default 30' } } },
    annotations: { readOnlyHint: true } },
  { name: 'add_poem', title: 'Add a poem to the map (live)',
    description: 'Pin a poem on the 山河鉴 map where and when it was written (581–763 CE). Goes live at once, marked 社区补充. '
      + 'Required: date (when written, YYYY at least), place (where written: id from list_places or {name, ll:[lon, lat]}), poem {poet, title (no 《》), text: array of lines, one couplet per item, form?}, '
      + 'summary (the circumstances, 2–6 sentences), evidence (1–8 sources with https url — the text\'s source, e.g. 全唐诗 on zh.wikisource.org, and the dating). '
      + 'Optional: title for the map card (default 「杜甫作《月夜》」), why, debate (dating disputes), who, importance. Check list_poems first.',
    inputSchema: ex(POEM_SCHEMA, EX_POEM), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
  { name: 'list_shuoshu', title: 'List 说书 (storyteller tellings)',
    description: '说书: history told as a storyteller would, in 回 (chapters), each built around a 「史书打架」 — a point where the sources disagree. Lists the curated tellings (with audio) and community ones (text). Returns id, title, year, era, blurb, dispute, source.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { q: { type: 'string' } } }, annotations: { readOnlyHint: true } },
  { name: 'get_shuoshu', title: 'Read one 说书',
    description: 'The full text of a community 说书 by id (all 回 and sources); for a curated one, its card and the page url.',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string' } } }, annotations: { readOnlyHint: true } },
  { name: 'add_shuoshu', title: 'Add a 说书 telling (live, text only)',
    description: 'Add a 说书: a historical episode told in 评书 style, as text (no audio). Goes live at once on the 书目 page, marked 社区. '
      + 'Required: title (≤20), year (integer CE, -1000..1911), era (e.g. 唐 天宝十四载), blurb (≤200, the hook), dispute (≤300: where the sources disagree — the heart of every 说书), '
      + 'hui: 1–10 chapters {title, text ≤3000 chars} (≤20000 total), sources: 1–8 {type, title, cite, url:https}. Optional: place, who. Simplified Chinese, no HTML.',
    inputSchema: ex(SHUOSHU_SCHEMA, EX_SHUOSHU), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } },
];

// ---- tool implementations ----
const match = (q, ...xs) => !q || xs.some(x => x && String(x).includes(q));
const RUN = {
  async list_events(a, c) {
    const W = await world(c.env, c.url), lo = a.from ?? 581, hi = a.to ?? 763, n = Math.min(200, a.limit || 30), off = a.offset || 0;
    const all = W.events.filter(e => { const y = yearOf(e.date); return y >= lo && y <= hi && (!a.kind || e.kind === a.kind) && (!a.source || e.source === a.source)
      && match(a.q, e.title, e.summary, (W.places[e.place] || {}).name, (e.who || []).join(' ')); }).sort((x, y) => x.date < y.date ? -1 : 1);
    return { total: all.length, offset: off, returned: Math.min(n, Math.max(0, all.length - off)), kinds: KINDS,
      events: all.slice(off, off + n).map(e => ({ id: e.id, date: e.date, kind: e.kind, title: e.title, ...placeOf(W, e.place), summary: clip(e.summary, 120), source: e.source })) };
  },
  async get_event(a, c) {
    const W = await world(c.env, c.url), e = [...W.events, ...W.poems].find(x => x.id === a.id);
    if (!e) throw new ToolError([`id: no event or poem "${a.id}" — use an id from list_events or list_poems`]);
    return { ...e, ...placeOf(W, e.place), url: `${SITE}/?ev=${e.id}` };
  },
  async list_places(a, c) {
    const W = await world(c.env, c.url), n = Math.min(200, a.limit || 20);
    let L = Object.entries(W.places).filter(([, p]) => p && p.ll && match(a.q, p.name)).map(([id, p]) => ({ id, name: p.name, ll: p.ll }));
    if (a.near) L = L.map(p => ({ ...p, km: Math.round(Math.hypot((p.ll[0] - a.near[0]) * Math.cos(a.near[1] * Math.PI / 180), p.ll[1] - a.near[1]) * 111) })).sort((x, y) => x.km - y.km);
    return { total: L.length, places: L.slice(0, n) };
  },
  async list_poems(a, c) {
    const W = await world(c.env, c.url), n = Math.min(200, a.limit || 30);
    const all = W.poems.filter(e => { const y = yearOf(e.date); return y >= (a.from ?? 0) && y <= (a.to ?? 9999) && (!a.poet || e.poem.poet === a.poet)
      && match(a.q, e.title, e.poem.title, e.poem.text.join(''), e.summary); });
    return { total: all.length, poems: all.slice(0, n).map(e => ({ id: e.id, date: e.date, poet: e.poem.poet, title: e.poem.title, form: e.poem.form,
      firstLine: e.poem.text[0], ...placeOf(W, e.place), source: e.source })) };
  },
  async list_shuoshu(a, c) {
    const W = await world(c.env, c.url);
    return { shuoshu: W.stories.filter(s => match(a.q, s.title, s.blurb, s.dispute, s.era)).map(s => ({ id: s.id, title: s.title, year: s.year, era: s.era,
      blurb: s.blurb, dispute: s.dispute, chapters: s.hui ? (Array.isArray(s.hui) ? s.hui.length : s.hui) : undefined, source: s.source,
      url: s.source === 'community' ? `${SITE}/shuoshu-text.html?c=${s.id}` : `${SITE}/shuoshu.html?s=${s.id}` })) };
  },
  async get_shuoshu(a, c) {
    const W = await world(c.env, c.url), s = W.stories.find(x => x.id === a.id);
    if (!s) throw new ToolError([`id: no 说书 "${a.id}" — use an id from list_shuoshu`]);
    return s.source === 'community' ? { ...s, url: `${SITE}/shuoshu-text.html?c=${s.id}` }
      : { ...s, url: `${SITE}/shuoshu.html?s=${s.id}`, note: 'curated tellings are scripted for voice and pictures; open the url to hear it' };
  },
  add_event: (a, c) => add('event', a, c), add_poem: (a, c) => add('poem', a, c), add_shuoshu: (a, c) => add('shuoshu', a, c),
};
export class ToolError extends Error { constructor(errors) { super(errors.join('; ')); this.errors = errors; } }

// light argument check against the tool's own schema for the read tools (the add_* tools have full validators)
export function argErrors(tool, args) {
  if (args === null || typeof args !== 'object' || Array.isArray(args)) return ['arguments: must be a JSON object'];
  const P = tool.inputSchema.properties || {}, errs = [];
  if (tool.name.startsWith('add_')) return errs;
  for (const k of Object.keys(args)) if (!(k in P)) errs.push(`${k}: unknown argument (allowed: ${Object.keys(P).join(', ')})`);
  for (const k of tool.inputSchema.required || []) if (args[k] === undefined) errs.push(`${k}: required`);
  for (const [k, v] of Object.entries(args)) { const s = P[k]; if (!s) continue;
    if (s.type === 'integer' && !Number.isInteger(v)) errs.push(`${k}: integer`);
    else if (s.type === 'string' && typeof v !== 'string') errs.push(`${k}: string`);
    else if (s.enum && !s.enum.includes(v)) errs.push(`${k}: one of ${s.enum.join(', ')}`);
    else if (s.type === 'array' && (!Array.isArray(v) || !v.every(Number.isFinite) || v.length !== 2)) errs.push(`${k}: [lon, lat]`); }
  return errs;
}


// run one tool: {result, isError}; never throws
export async function callTool(name, args, c) {
  const t = TOOLS.find(x => x.name === name);
  if (!t) return { result: { ok: false, errors: [`unknown tool "${name}"`] }, isError: true, unknown: true };
  const bad = argErrors(t, args ?? {});
  if (bad.length) return { result: { ok: false, errors: bad }, isError: true };
  try { const r = await RUN[name](args ?? {}, c); return { result: r, isError: !!(r && r.ok === false) }; }
  catch (e) { return { result: { ok: false, errors: e instanceof ToolError ? e.errors : ['internal error: ' + e.message] }, isError: true }; }
}
