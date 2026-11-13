// js/webmcp.js: 山河鉴 as a WebMCP site (POC, 2026-11-13). Two tools an AI agent in the visitor's browser can call:
//   list_events  read the events on the map (filter by year range, kind, text) and the place ids
//   add_event    validate a proposed event (js/contrib-schema.js), show it on this tab's map/timeline, and return a
//                prefilled GitHub new-issue URL; the visitor submits it, and .github/workflows/event-proposal.yml
//                turns the issue into a pull request. Nothing is written anywhere by the page itself.
// Registered with navigator.modelContext (W3C WebMCP draft, Chrome early preview) when present; always also exposed as
// window.shanhejianMCP = { tools, list_events(args), add_event(args) } for DevTools, Playwright/CDP agents and tests.
import { CONTRIB, ERA, EVS, PL, llOf, openWiki, previewEvent } from './timeline.js';
import { EVENT_SCHEMA, KINDS, REPO, SPAN, issueUrl, validateEvent } from './contrib-schema.js';

const yearOf = d => +String(d).slice(0, 4);
const placeName = id => (PL[id] || {}).name || id;

function list_events({ from = 581, to = 763, kind, q, limit = 50, places = false } = {}) {
  const lo = +from, hi = +to, n = Math.max(1, Math.min(500, +limit || 50)), qq = q && String(q);
  const all = EVS.filter(e => { const y = yearOf(e.date); return y >= lo && y <= hi && (!kind || e.kind === kind)
    && (!qq || (e.title + ' ' + placeName(e.place) + ' ' + ((e._era && e._era.summary) || '')).includes(qq)); });
  const events = all.slice(0, n).map(e => { const x = e._era || {};
    return { id: e.id, date: e.date, kind: e.kind, title: (x.title || e.title), place: e.place, placeName: placeName(e.place),
      ll: llOf(e.place), summary: x.summary ? x.summary.slice(0, 160) : undefined, contributed: !!x.contrib || undefined }; });
  const out = { span: SPAN, kinds: KINDS, total: all.length, returned: events.length, events };
  if (places) out.places = Object.fromEntries(Object.entries(PL).filter(([, p]) => p && p.ll).map(([id, p]) => [id, { name: p.name, ll: p.ll }]));
  return out;
}

function add_event(input = {}, { preview = true } = {}) {
  const ids = new Set([...EVS.map(e => e.id), ...ERA.events.map(e => e.id), ...CONTRIB.events.map(e => e.id)]);
  // a repeat call with the same proposal (an agent retrying) previews again rather than failing as a duplicate
  const r = validateEvent(input, { places: PL, ids: new Set([...ids].filter(id => !PREVIEWED.has(id))) });
  if (!r.ok) return { ok: false, errors: r.errors, hint: 'call list_events {places:true} for place ids; schema: window.shanhejianMCP.tools[1].inputSchema' };
  let step = -1;
  if (preview) { step = previewEvent(r.event, r.place); PREVIEWED.add(r.event.id); }
  return { ok: true, id: r.event.id, event: r.event, newPlace: r.place, previewStep: step,
    issueUrl: issueUrl(input),
    next: `Open issueUrl and submit it (GitHub login needed). A bot at github.com/${REPO} re-validates it and opens a pull request; the maintainer merges it and the event appears on https://shanhejian.pages.dev for everyone.` };
}
const PREVIEWED = new Set();

const tools = [
  { name: 'list_events', description: '山河鉴 (a 3D history map of China, 581–763 CE, 隋唐): list the events on the map, newest data included. '
      + 'Filter by year range, kind and a text match (Chinese). Pass places:true to also get every place id with its [lon, lat] — needed for add_event.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {
      from: { type: 'integer', description: 'first year (CE), default 581' }, to: { type: 'integer', description: 'last year (CE), default 763' },
      kind: { type: 'string', enum: Object.keys(KINDS) }, q: { type: 'string', description: 'substring of title / place / summary' },
      limit: { type: 'integer', minimum: 1, maximum: 500 }, places: { type: 'boolean' } } },
    annotations: { readOnlyHint: true }, run: list_events },
  { name: 'add_event', description: 'Propose a new historical event for the 山河鉴 map (581–763 CE). The event is checked, shown on the map in this tab '
      + 'only, and you get back issueUrl: a prefilled GitHub issue the user submits so the maintainer can review and merge it. '
      + 'Write in simplified Chinese; cite at least one source you actually read (with an https url). Nothing is published until the user submits the issue.',
    inputSchema: EVENT_SCHEMA, annotations: { readOnlyHint: false }, run: input => add_event(input) },
];

// WebMCP: execute returns MCP-style content; the JSON result goes in one text part
const asContent = v => ({ content: [{ type: 'text', text: JSON.stringify(v) }] });
const mc = typeof navigator !== 'undefined' && navigator.modelContext;
let registered = 'none';
if (mc) {
  const defs = tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations,
    execute: async args => asContent(t.run(args || {})) }));
  try {
    if (typeof mc.registerTool === 'function') { for (const d of defs) mc.registerTool(d); registered = 'registerTool'; }
    else if (typeof mc.provideContext === 'function') { mc.provideContext({ tools: defs }); registered = 'provideContext'; }
  } catch (err) { console.warn('WebMCP registration failed', err); }
}

window.shanhejianMCP = { version: 1, registered, repo: REPO,
  tools: tools.map(({ name, description, inputSchema, annotations }) => ({ name, description, inputSchema, annotations })),
  list_events, add_event, open: id => { const e = EVS.find(x => x.id === id); if (e && e._era) openWiki(e._era); return !!e },
  call: (name, args) => { const t = tools.find(x => x.name === name); if (!t) throw new Error('no tool ' + name); return t.run(args || {}); } };
