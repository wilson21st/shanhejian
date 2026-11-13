// The plain-HTTP twin of /mcp for agents that cannot add an MCP server (chat assistants with only "fetch a URL" or
// "run code", personal bots): the same tools as REST routes, same validator, same rate limit, same errors.
//   GET  /api/events?q=&from=&to=&kind=&source=&limit=&offset=   list_events      POST /api/events    add_event
//   GET  /api/events/{id}                                        get_event
//   GET  /api/poems?poet=&q=&from=&to=&limit=                    list_poems       POST /api/poems     add_poem
//   GET  /api/poems/{id}                                         get_event
//   GET  /api/places?q=&near=lon,lat&limit=                      list_places
//   GET  /api/shuoshu?q=                                         list_shuoshu     POST /api/shuoshu   add_shuoshu
//   GET  /api/shuoshu/{id}                                       get_shuoshu
// Spec: /openapi.json (built from the tool schemas); guide: /llms.txt.
import { LIMITS } from './contrib-store.js';
import { TOOLS, callTool } from './tools.js';

export const ROUTES = {
  events: { list: 'list_events', add: 'add_event', get: 'get_event' },
  poems: { list: 'list_poems', add: 'add_poem', get: 'get_event' },
  places: { list: 'list_places' },
  shuoshu: { list: 'list_shuoshu', add: 'add_shuoshu', get: 'get_shuoshu' },
};
export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept' };
export const json = (v, status = 200, extra = {}) => new Response(JSON.stringify(v), { status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra } });

// query strings are text: turn them into what the tool schema wants (integers, [lon, lat])
function queryArgs(tool, sp) {
  const P = tool.inputSchema.properties || {}, a = {};
  for (const [k, v] of sp) {
    const s = P[k];
    if (s && s.type === 'integer' && /^-?\d+$/.test(v)) a[k] = +v;
    else if (s && s.type === 'array') a[k] = v.split(',').map(Number);
    else a[k] = v;
  }
  return a;
}
const unknown = res => json({ ok: false, errors: [`path: unknown collection "${res}" — use /api/events, /api/poems, /api/places or /api/shuoshu (see /openapi.json)`] }, 404);
const notAllowed = (allow, why) => json({ ok: false, errors: [why] }, 405, { Allow: allow });

export async function rest({ request, env, params }) {
  const res = params.res, id = params.id, R = ROUTES[res];
  if (!R) return unknown(res);
  const c = { env, req: request, url: request.url }, m = request.method;
  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  let name, args;
  if (id !== undefined) {
    if (m !== 'GET' || !R.get) return notAllowed('GET, OPTIONS', R.get ? 'method: only GET on /api/' + res + '/{id}' : `path: /api/${res} has no /{id}`);
    name = R.get; args = { id: decodeURIComponent(id) };
  } else if (m === 'GET') {
    name = R.list; args = queryArgs(TOOLS.find(t => t.name === name), new URL(request.url).searchParams);
  } else if (m === 'POST') {
    if (!R.add) return notAllowed('GET, OPTIONS', `method: /api/${res} is read-only`);
    name = R.add;
    const text = await request.text();
    if (text.length > LIMITS.body) return json({ ok: false, errors: [`body: too large (max ${LIMITS.body} bytes)`] }, 413);
    try { args = JSON.parse(text); } catch { return json({ ok: false, errors: ['body: not JSON — send Content-Type: application/json with the object described in /openapi.json'] }, 400); }
  } else return notAllowed(R.add ? 'GET, POST, OPTIONS' : 'GET, OPTIONS', `method: ${m} not allowed`);
  const { result, isError } = await callTool(name, args, c);
  if (!isError) return json(result, m === 'POST' ? 201 : 200, m === 'GET' ? { 'Cache-Control': 'public, max-age=15' } : {});
  const errs = result.errors || [], limited = errs.some(e => /^rate limit|store is full/.test(e)), missing = errs.some(e => /^id: no /.test(e));
  return json(result, limited ? 429 : missing ? 404 : 400);
}
