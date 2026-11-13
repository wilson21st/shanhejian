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
  // place: an id we know, or a new named point inside the map
  let placeId = null, newPlace = null;
  if (typeof e.place === 'string') { if (places[e.place]) placeId = e.place; else errors.push(`place: unknown id "${e.place}" — use list_events places, or {name, ll:[lon, lat]}`); }
  else if (e.place && typeof e.place === 'object') {
    const { name, ll } = e.place;
    if (!str(name, 30)) errors.push('place.name: required, ≤ 30 chars');
    if (!Array.isArray(ll) || ll.length !== 2 || !ll.every(Number.isFinite)) errors.push('place.ll: [lon, lat] numbers');
    else if (ll[0] < BOUNDS.lon[0] || ll[0] > BOUNDS.lon[1] || ll[1] < BOUNDS.lat[0] || ll[1] > BOUNDS.lat[1]) errors.push(`place.ll: must lie on the map (lon ${BOUNDS.lon.join('–')}, lat ${BOUNDS.lat.join('–')})`);
    if (!errors.some(x => x.startsWith('place'))) {
      const same = Object.entries(places).find(([, p]) => p.name === name && p.ll && Math.hypot(p.ll[0] - ll[0], p.ll[1] - ll[1]) < 0.3);
      if (same) placeId = same[0];
      else { placeId = 'c_' + hash(name + ll.join(',')); newPlace = { id: placeId, name, ll: ll.map(x => Math.round(x * 100) / 100) }; }
    }
  } else errors.push('place: required');
  // evidence: at least one source somebody can open
  if (!Array.isArray(e.evidence) || e.evidence.length < 1 || e.evidence.length > LIMITS.evidence) errors.push(`evidence: 1–${LIMITS.evidence} items`);
  else e.evidence.forEach((x, i) => {
    const p = `evidence[${i}]`;
    if (!x || typeof x !== 'object') return errors.push(p + ': object');
    for (const k of Object.keys(x)) if (!(k in EVENT_SCHEMA.properties.evidence.items.properties)) errors.push(`${p}: unknown field "${k}"`);
    if (!EV_TYPES.includes(x.type)) errors.push(`${p}.type: one of ${EV_TYPES.join(', ')}`);
    if (!str(x.title, LIMITS.field)) errors.push(`${p}.title: required`);
    if (!str(x.cite, LIMITS.field)) errors.push(`${p}.cite: required`);
    if (typeof x.url !== 'string' || !/^https:\/\/[^\s"'<>]+$/.test(x.url) || x.url.length > 500) errors.push(`${p}.url: an https URL`);
    for (const k of ['quote', 'detail', 'where']) if (x[k] !== undefined && !str(x[k], LIMITS.field)) errors.push(`${p}.${k}: ≤ ${LIMITS.field} chars`);
    if (x.stance !== undefined && !STANCES.includes(x.stance)) errors.push(`${p}.stance: one of ${STANCES.join(', ')}`);
    if (x.confidence !== undefined && !CONF.includes(x.confidence)) errors.push(`${p}.confidence: one of ${CONF.join(', ')}`);
  });
  // no markup anywhere
  const walk = (v, p) => typeof v === 'string' ? (noMarkup(v) || errors.push(`${p}: no HTML / < > / javascript:`))
    : v && typeof v === 'object' ? Object.entries(v).forEach(([k, x]) => walk(x, p ? p + '.' + k : k)) : 0;
  walk(e, '');
  if (errors.length) return { ok: false, errors };
  const id = 'c' + e.date.replace(/-/g, '') + '-' + hash(e.title + e.date);
  if (ids.has(id)) return { ok: false, errors: [`an event with this title and date already exists (${id})`] };
  const event = { id, date: e.date, prec: precOf(e.date), ...(e.endDate ? { endDate: e.endDate } : {}), place: placeId, kind: e.kind,
    title: e.title.trim(), summary: e.summary.trim(), ...(e.why ? { why: e.why.trim() } : {}), who: e.who || [],
    importance: e.importance || 1, ...(e.debate ? { debate: e.debate.trim() } : {}),
    evidence: e.evidence.map(x => ({ stance: 'supports', confidence: 'medium', detail: '', ...x })), contrib: true };
  return { ok: true, errors: [], event, place: newPlace };
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
