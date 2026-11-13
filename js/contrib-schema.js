// js/contrib-schema.js: the one validator for contributed events, shared by the page (js/webmcp.js: add_event) and the
// GitHub Action that turns an event-proposal issue into a PR (.github/scripts/event-proposal.mjs). No DOM, no imports.
// A contributed event has the shape of a data/era.json event (the 581–763 layer the map plays), plus an optional new place:
//   { title, date, kind, summary, place, why?, who?, endDate?, importance?, debate?, evidence:[{type,title,cite,url,...}] }
// place = an existing place id (see list_events → places) or { name, ll:[lon, lat] } for a new one.
export const REPO = 'wilson21st/shanhejian';
export const SPAN = ['0581', '0763'];
export const KINDS = { mil: '军事', pol: '政局', dip: '外交', gov: '治理', cul: '文化', nat: '天象灾异' };
export const EV_TYPES = ['text', 'archaeology', 'inscription', 'artifact', 'art', 'foreign', 'modern'];
export const STANCES = ['supports', 'complicates', 'contradicts'];
export const CONF = ['high', 'medium', 'low'];
export const BOUNDS = { lon: [72, 142], lat: [18, 52] };
export const LIMITS = { title: 40, summary: 800, why: 400, debate: 400, who: 12, evidence: 8, field: 400 };

// JSON Schema (draft 2020-12) for the add_event tool input; validateEvent() below is what actually decides.
export const EVENT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'date', 'kind', 'summary', 'place', 'evidence'],
  properties: {
    title: { type: 'string', maxLength: LIMITS.title, description: '事件标题（简体中文），如「唐与吐蕃会盟于清水」' },
    date: { type: 'string', pattern: '^0[5-7][0-9]{2}(-[01][0-9](-[0-3][0-9])?)?$', description: 'Julian date YYYY, YYYY-MM or YYYY-MM-DD, 4-digit year, 0581–0763' },
    endDate: { type: 'string', pattern: '^0[5-7][0-9]{2}(-[01][0-9](-[0-3][0-9])?)?$' },
    kind: { type: 'string', enum: Object.keys(KINDS), description: Object.entries(KINDS).map(([k, v]) => k + '=' + v).join(', ') },
    place: { description: 'existing place id (list_events → places) or a new place {name, ll:[lon, lat]}',
      oneOf: [{ type: 'string' }, { type: 'object', required: ['name', 'll'], additionalProperties: false,
        properties: { name: { type: 'string' }, ll: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 } } }] },
    summary: { type: 'string', maxLength: LIMITS.summary, description: '经过，2–6 句' },
    why: { type: 'string', maxLength: LIMITS.why, description: '为什么重要' },
    debate: { type: 'string', maxLength: LIMITS.debate, description: '尚有争议之处' },
    who: { type: 'array', items: { type: 'string' }, maxItems: LIMITS.who },
    importance: { type: 'integer', minimum: 1, maximum: 2, description: '1 = minor, 2 = notable (3 is reserved for the curated headline events)' },
    evidence: { type: 'array', minItems: 1, maxItems: LIMITS.evidence, items: { type: 'object', required: ['type', 'title', 'cite', 'url'],
      additionalProperties: false, properties: {
        type: { type: 'string', enum: EV_TYPES }, title: { type: 'string' }, cite: { type: 'string', description: '出处，如《旧唐书》卷一百九十六' },
        url: { type: 'string', description: 'https link you actually read (wikisource, a museum, a paper)' }, quote: { type: 'string', description: '原文引句' },
        detail: { type: 'string' }, stance: { type: 'string', enum: STANCES }, confidence: { type: 'string', enum: CONF },
        year: { type: 'integer' }, where: { type: 'string' } } } },
  },
};

const DATE = /^0[5-7]\d{2}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const precOf = d => d.length === 4 ? 'year' : d.length === 7 ? 'month' : 'day';
const str = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
// contributed text is shown as HTML on the map, so markup is refused outright rather than escaped later
const noMarkup = v => !/[<>]|javascript:/i.test(v);
const hash = s => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.codePointAt(0)) >>> 0; return h.toString(36).slice(0, 5); };
export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

// validateEvent(input, { places, ids }) → { ok, errors[], event, place }:
//   places = known place ids → {name, ll}; ids = Set of event ids already taken.
//   event is normalised (id, prec, place id, importance, evidence defaults); place is a new {id, name, ll} or null.
export function validateEvent(input, { places = {}, ids = new Set() } = {}) {
  const errors = [], e = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  if (!e) return { ok: false, errors: ['event must be a JSON object'] };
  const allowed = new Set(Object.keys(EVENT_SCHEMA.properties).concat('id'));
  for (const k of Object.keys(e)) if (!allowed.has(k)) errors.push(`unknown field "${k}"`);
  if (!str(e.title, LIMITS.title)) errors.push(`title: required, ≤ ${LIMITS.title} chars`);
  if (typeof e.date !== 'string' || !DATE.test(e.date)) errors.push('date: YYYY, YYYY-MM or YYYY-MM-DD with a 4-digit year, e.g. 0641 or 0641-02-15');
  else if (e.date.slice(0, 4) < SPAN[0] || e.date.slice(0, 4) > SPAN[1]) errors.push(`date: the map covers ${SPAN[0]}–${SPAN[1]} only`);
  if (e.endDate !== undefined && (typeof e.endDate !== 'string' || !DATE.test(e.endDate) || e.endDate < e.date)) errors.push('endDate: same format as date, not before it');
  if (!(e.kind in KINDS)) errors.push('kind: one of ' + Object.keys(KINDS).join(', '));
  if (!str(e.summary, LIMITS.summary)) errors.push(`summary: required, ≤ ${LIMITS.summary} chars`);
  for (const k of ['why', 'debate']) if (e[k] !== undefined && !str(e[k], LIMITS[k])) errors.push(`${k}: ≤ ${LIMITS[k]} chars`);
  if (e.who !== undefined && (!Array.isArray(e.who) || e.who.length > LIMITS.who || !e.who.every(w => str(w, 40)))) errors.push(`who: array of ≤ ${LIMITS.who} names`);
  if (e.importance !== undefined && ![1, 2].includes(e.importance)) errors.push('importance: 1 or 2');
  const { placeId, newPlace } = checkPlace(e.place, places, errors, 'place');
  checkEvidence(e.evidence, errors, 'evidence');
  // no markup anywhere
  walkMarkup(e, '', errors);
  if (errors.length) return { ok: false, errors };
  const id = 'c' + e.date.replace(/-/g, '') + '-' + hash(e.title + e.date);
  if (ids.has(id)) return { ok: false, errors: [`an event with this title and date already exists (${id})`] };
  const event = { id, date: e.date, prec: precOf(e.date), ...(e.endDate ? { endDate: e.endDate } : {}), place: placeId, kind: e.kind,
    title: e.title.trim(), summary: e.summary.trim(), ...(e.why ? { why: e.why.trim() } : {}), who: e.who || [],
    importance: e.importance || 1, ...(e.debate ? { debate: e.debate.trim() } : {}),
    evidence: normEvidence(e.evidence), contrib: true };
  return { ok: true, errors: [], event, place: newPlace };
}

// place: an id we know, or a new named point inside the map → { placeId, newPlace }
function checkPlace(pl, places, errors, p) {
  let placeId = null, newPlace = null;
  if (typeof pl === 'string') { if (places[pl]) placeId = pl; else errors.push(`${p}: unknown id "${pl}" — use a known place id (list_places or GET /api/places; on the page: list_events {places:true}), or {name, ll:[lon, lat]}`); }
  else if (pl && typeof pl === 'object' && !Array.isArray(pl)) {
    const { name, ll } = pl, n0 = errors.length;
    for (const k of Object.keys(pl)) if (k !== 'name' && k !== 'll') errors.push(`${p}: unknown field "${k}" (only name, ll)`);
    if (!str(name, 30)) errors.push(`${p}.name: required, ≤ 30 chars`);
    if (!Array.isArray(ll) || ll.length !== 2 || !ll.every(Number.isFinite)) errors.push(`${p}.ll: [lon, lat] numbers, e.g. [108.94, 34.26] for 长安`);
    else if (ll[0] < BOUNDS.lon[0] || ll[0] > BOUNDS.lon[1] || ll[1] < BOUNDS.lat[0] || ll[1] > BOUNDS.lat[1]) errors.push(`${p}.ll: must lie on the map (lon ${BOUNDS.lon.join('–')}, lat ${BOUNDS.lat.join('–')}); order is [lon, lat]`);
    if (errors.length === n0) {
      const same = Object.entries(places).find(([, q]) => q && q.name === name && q.ll && Math.hypot(q.ll[0] - ll[0], q.ll[1] - ll[1]) < 0.3);
      if (same) placeId = same[0];
      else { placeId = 'c_' + hash(name + ll.join(',')); newPlace = { id: placeId, name, ll: ll.map(x => Math.round(x * 100) / 100) }; }
    }
  } else errors.push(`${p}: required — a place id string or {name, ll:[lon, lat]}`);
  return { placeId, newPlace };
}
// evidence: at least one source somebody can open
function checkEvidence(list, errors, p0) {
  if (!Array.isArray(list) || list.length < 1 || list.length > LIMITS.evidence) return errors.push(`${p0}: array of 1–${LIMITS.evidence} sources, each {type, title, cite, url}`);
  list.forEach((x, i) => {
    const p = `${p0}[${i}]`;
    if (!x || typeof x !== 'object' || Array.isArray(x)) return errors.push(p + ': object {type, title, cite, url}');
    for (const k of Object.keys(x)) if (!(k in EVENT_SCHEMA.properties.evidence.items.properties)) errors.push(`${p}: unknown field "${k}"`);
    if (!EV_TYPES.includes(x.type)) errors.push(`${p}.type: one of ${EV_TYPES.join(', ')}`);
    if (!str(x.title, LIMITS.field)) errors.push(`${p}.title: required`);
    if (!str(x.cite, LIMITS.field)) errors.push(`${p}.cite: required, e.g. 《旧唐书》卷一百九十六上`);
    if (typeof x.url !== 'string' || !/^https:\/\/[^\s"'<>]+$/.test(x.url) || x.url.length > 500) errors.push(`${p}.url: an https URL`);
    for (const k of ['quote', 'detail', 'where']) if (x[k] !== undefined && !str(x[k], LIMITS.field)) errors.push(`${p}.${k}: ≤ ${LIMITS.field} chars`);
    if (x.stance !== undefined && !STANCES.includes(x.stance)) errors.push(`${p}.stance: one of ${STANCES.join(', ')}`);
    if (x.confidence !== undefined && !CONF.includes(x.confidence)) errors.push(`${p}.confidence: one of ${CONF.join(', ')}`);
    if (x.year !== undefined && !Number.isInteger(x.year)) errors.push(`${p}.year: integer`);
  });
}
const walkMarkup = (v, p, errors) => typeof v === 'string' ? (noMarkup(v) || errors.push(`${p}: no HTML / < > / javascript:`))
  : v && typeof v === 'object' ? Object.entries(v).forEach(([k, x]) => walkMarkup(x, p ? p + '.' + k : k, errors)) : 0;
const normEvidence = list => list.map(x => ({ stance: 'supports', confidence: 'medium', detail: '', ...x }));

// ---- poems (data/poems.json shape: an event of kind cul with a poem) ----
export const POEM_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['date', 'place', 'poem', 'summary', 'evidence'],
  properties: {
    poem: { type: 'object', additionalProperties: false, required: ['poet', 'title', 'text'], properties: {
      poet: { type: 'string', maxLength: 20, description: '诗人，如「王维」' }, title: { type: 'string', maxLength: 30, description: '诗题，不加书名号，如「送元二使安西」' },
      form: { type: 'string', maxLength: 12, description: '体裁，如 五言绝句 / 七言律诗 / 古体' },
      text: { type: 'array', items: { type: 'string', maxLength: 60 }, minItems: 1, maxItems: 80, description: '全诗，一联（两句）一项，如 ["渭城朝雨浥轻尘，客舍青青柳色新。", "…"]' },
      excerpt: { type: 'boolean', description: 'true if text is only part of the poem' } } },
    title: { type: 'string', maxLength: LIMITS.title, description: '地图卡片标题；省略则为「王维作《送元二使安西》」' },
    date: EVENT_SCHEMA.properties.date, place: EVENT_SCHEMA.properties.place,
    summary: { type: 'string', maxLength: LIMITS.summary, description: '写作背景，2–6 句' },
    why: EVENT_SCHEMA.properties.why, debate: { ...EVENT_SCHEMA.properties.debate, description: '系年、地点或文本的争议' },
    who: EVENT_SCHEMA.properties.who, importance: EVENT_SCHEMA.properties.importance, evidence: EVENT_SCHEMA.properties.evidence,
  },
};
export function validatePoem(input, { places = {}, ids = new Set() } = {}) {
  const e = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  if (!e) return { ok: false, errors: ['poem entry must be a JSON object'] };
  const errors = [], { poem, ...rest } = e, pm = poem && typeof poem === 'object' && !Array.isArray(poem) ? poem : null;
  if (rest.kind !== undefined) errors.push('kind: not allowed for a poem (always cul)');
  if (!pm) errors.push('poem: required, {poet, title, text:[lines]}');
  else {
    for (const k of Object.keys(pm)) if (!(k in POEM_SCHEMA.properties.poem.properties)) errors.push(`poem: unknown field "${k}"`);
    if (!str(pm.poet, 20)) errors.push('poem.poet: required, ≤ 20 chars');
    if (!str(pm.title, 30)) errors.push('poem.title: required, ≤ 30 chars, without 《》');
    else if (/[《》〈〉]/.test(pm.title)) errors.push('poem.title: without 《》, e.g. "月夜" not "《月夜》"');
    if (pm.form !== undefined && !str(pm.form, 12)) errors.push('poem.form: ≤ 12 chars');
    if (!Array.isArray(pm.text) || pm.text.length < 1 || pm.text.length > 80 || !pm.text.every(l => str(l, 60))) errors.push('poem.text: array of 1–80 lines, each a non-empty string ≤ 60 chars');
    if (pm.excerpt !== undefined && typeof pm.excerpt !== 'boolean') errors.push('poem.excerpt: true or false');
    walkMarkup(pm, 'poem', errors);
  }
  const title = rest.title || (pm && str(pm.poet, 20) && str(pm.title, 30) ? `${pm.poet}作《${pm.title}》` : 'x');
  const who = [...new Set([...(pm && typeof pm.poet === 'string' ? [pm.poet] : []), ...(Array.isArray(rest.who) ? rest.who : [])])];
  const r = validateEvent({ ...rest, kind: 'cul', title: title.slice(0, LIMITS.title), who }, { places });
  errors.push(...r.errors.filter(x => !x.startsWith('kind')));
  if (errors.length) return { ok: false, errors };
  const id = 'cp' + r.event.id.slice(1);
  if (ids.has(id)) return { ok: false, errors: [`this poem with this date already exists (${id})`] };
  const event = { ...r.event, id, poem: { poet: pm.poet.trim(), title: pm.title.trim(), form: pm.form || '', text: pm.text.map(l => l.trim()), excerpt: !!pm.excerpt } };
  return { ok: true, errors: [], event, place: r.place };
}

// ---- 说书 (text only: a storyteller's telling in a few 回, plus the sources it disputes) ----
export const SHUOSHU_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['title', 'year', 'era', 'blurb', 'dispute', 'hui', 'sources'],
  properties: {
    title: { type: 'string', maxLength: 20, description: '书名，如「玄武门之变」' },
    year: { type: 'integer', minimum: -1000, maximum: 1911, description: '公元年份（负数为公元前），如 626' },
    era: { type: 'string', maxLength: 30, description: '朝代与年号，如「唐 武德九年」' },
    blurb: { type: 'string', maxLength: 200, description: '一两句引子，书目卡片上显示' },
    dispute: { type: 'string', maxLength: 300, description: '「史书打架」：不同史料说法不一之处，如「资治通鉴说伏兵，旧唐书说自卫」' },
    hui: { type: 'array', minItems: 1, maxItems: 10, description: '分回正文，评书口吻，简体中文',
      items: { type: 'object', additionalProperties: false, required: ['title', 'text'], properties: {
        title: { type: 'string', maxLength: 30, description: '回目，如「第一回 兄弟阋墙」' }, text: { type: 'string', maxLength: 3000, description: '这一回的正文，段落用换行分开' } } } },
    place: { ...EVENT_SCHEMA.properties.place, description: '可选：故事发生地（place id 或 {name, ll}）' },
    who: EVENT_SCHEMA.properties.who,
    sources: { ...EVENT_SCHEMA.properties.evidence, description: '出处，与 evidence 同格式' },
  },
};
export function validateShuoshu(input, { places = {}, ids = new Set() } = {}) {
  const errors = [], e = input && typeof input === 'object' && !Array.isArray(input) ? input : null;
  if (!e) return { ok: false, errors: ['shuoshu entry must be a JSON object'] };
  for (const k of Object.keys(e)) if (!(k in SHUOSHU_SCHEMA.properties)) errors.push(`unknown field "${k}"`);
  if (!str(e.title, 20)) errors.push('title: required, ≤ 20 chars');
  if (!Number.isInteger(e.year) || e.year < -1000 || e.year > 1911) errors.push('year: integer CE year between -1000 and 1911, e.g. 626');
  if (!str(e.era, 30)) errors.push('era: required, ≤ 30 chars, e.g. 唐 武德九年');
  if (!str(e.blurb, 200)) errors.push('blurb: required, ≤ 200 chars');
  if (!str(e.dispute, 300)) errors.push('dispute: required, ≤ 300 chars — where the sources disagree');
  if (!Array.isArray(e.hui) || e.hui.length < 1 || e.hui.length > 10) errors.push('hui: array of 1–10 chapters {title, text}');
  else {
    e.hui.forEach((h, i) => {
      if (!h || typeof h !== 'object' || Array.isArray(h)) return errors.push(`hui[${i}]: object {title, text}`);
      for (const k of Object.keys(h)) if (k !== 'title' && k !== 'text') errors.push(`hui[${i}]: unknown field "${k}"`);
      if (!str(h.title, 30)) errors.push(`hui[${i}].title: required, ≤ 30 chars`);
      if (!str(h.text, 3000)) errors.push(`hui[${i}].text: required, ≤ 3000 chars`);
    });
    const total = e.hui.reduce((n, h) => n + ((h && typeof h.text === 'string') ? h.text.length : 0), 0);
    if (total > 20000) errors.push(`hui: total text ${total} chars, max 20000`);
  }
  if (e.who !== undefined && (!Array.isArray(e.who) || e.who.length > LIMITS.who || !e.who.every(w => str(w, 40)))) errors.push(`who: array of ≤ ${LIMITS.who} names`);
  let placeId = null, newPlace = null;
  if (e.place !== undefined) ({ placeId, newPlace } = checkPlace(e.place, places, errors, 'place'));
  checkEvidence(e.sources, errors, 'sources');
  walkMarkup(e, '', errors);
  if (errors.length) return { ok: false, errors };
  const id = 'cs' + String(e.year).replace('-', 'm') + '-' + hash(e.title + e.year);
  if (ids.has(id)) return { ok: false, errors: [`a 说书 with this title and year already exists (${id})`] };
  const story = { id, title: e.title.trim(), year: e.year, era: e.era.trim(), blurb: e.blurb.trim(), dispute: e.dispute.trim(),
    hui: e.hui.map(h => ({ title: h.title.trim(), text: h.text.trim() })), ...(placeId ? { place: placeId } : {}), who: e.who || [],
    sources: normEvidence(e.sources), contrib: true };
  return { ok: true, errors: [], story, place: newPlace };
}

// the GitHub new-issue link an agent hands back to its human: the proposal travels as a fenced JSON block
export const ISSUE_TITLE_PREFIX = '[event] ';
export function issueUrl(input) {
  const body = '<!-- Proposed with the 山河鉴 add_event tool. A bot validates the JSON below and opens a pull request; '
    + 'edit the JSON if you like, then submit. -->\n\n```json\n' + JSON.stringify(input, null, 1) + '\n```\n';
  const q = new URLSearchParams({ template: 'event-proposal.md', labels: 'event-proposal', title: ISSUE_TITLE_PREFIX + input.title, body });
  return `https://github.com/${REPO}/issues/new?${q}`;
}
// the inverse, for the Action: the first ```json block of an issue body
export function parseIssueBody(body) {
  const m = /```json\s*\n([\s\S]*?)\n```/.exec(body || '');
  if (!m) return { error: 'no ```json block found in the issue body' };
  try { return { input: JSON.parse(m[1]) }; } catch (err) { return { error: 'the JSON block does not parse: ' + err.message }; }
}
