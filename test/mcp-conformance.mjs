#!/usr/bin/env node
// Raw-HTTP conformance check for the /mcp endpoint (MCP Streamable HTTP, stateless JSON) plus /api/contrib and /api/admin.
//   node test/mcp-conformance.mjs [base]            base defaults to https://shanhejian.pages.dev
//   ADMIN_KEY=… node test/mcp-conformance.mjs       also runs the write round trip (add → visible → hide → delete)
// Prints one line per check and a JSON summary; exit 1 if any check fails.
const BASE = (process.argv[2] || 'https://shanhejian.pages.dev').replace(/\/$/, ''), KEY = process.env.ADMIN_KEY;
const H = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };
const post = async (body, extra = {}) => { const r = await fetch(BASE + '/mcp', { method: 'POST', headers: { ...H, ...extra }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} return { status: r.status, ct: r.headers.get('content-type') || '', j, t }; };
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const call = (id, name, args) => post(rpc(id, 'tools/call', { name, arguments: args }));

let r = await post(rpc(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'conformance', version: '1' } }));
check('initialize: 200 application/json', r.status === 200 && r.ct.startsWith('application/json'));
check('initialize: echoes a supported protocolVersion', r.j?.result?.protocolVersion === '2025-06-18');
check('initialize: serverInfo + tools capability + instructions', r.j?.result?.serverInfo?.name && r.j.result.capabilities?.tools && r.j.result.instructions);
r = await post(rpc(2, 'initialize', { protocolVersion: '1999-01-01', capabilities: {}, clientInfo: { name: 'x', version: '1' } }));
check('initialize: unknown version → server picks its latest', /^\d{4}-\d{2}-\d{2}$/.test(r.j?.result?.protocolVersion || '') && r.j.result.protocolVersion !== '1999-01-01', r.j?.result?.protocolVersion);
r = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
check('notification → 202, empty body', r.status === 202 && r.t === '');
r = await post(rpc(3, 'ping'));
check('ping → empty result', r.j?.result && Object.keys(r.j.result).length === 0);
r = await post(rpc(4, 'tools/list'));
const tools = r.j?.result?.tools || [];
check('tools/list: 9 tools', tools.length === 9, tools.map(t => t.name).join(','));
check('tools/list: every tool has name, description ≥ 80 chars, object inputSchema', tools.every(t => t.name && t.description?.length >= 80 && t.inputSchema?.type === 'object'));
check('tools/list: add_* carry an example + readOnlyHint false', tools.filter(t => t.name.startsWith('add_')).every(t => t.inputSchema.examples?.length && t.annotations?.readOnlyHint === false));
r = await call(5, 'list_events', { from: 640, to: 645, limit: 5 });
check('tools/call list_events: content text + structuredContent, isError false', r.j?.result?.isError === false && r.j.result.content?.[0]?.type === 'text' && Array.isArray(r.j.result.structuredContent?.events), `${r.j?.result?.structuredContent?.total} events`);
check('tools/call: content text is the same JSON as structuredContent', JSON.stringify(JSON.parse(r.j?.result?.content?.[0]?.text || 'null')) === JSON.stringify(r.j?.result?.structuredContent));
r = await call(6, 'get_event', { id: 's641' });
check('get_event s641: full record with evidence', r.j?.result?.structuredContent?.evidence?.length > 0);
r = await call(7, 'get_event', { id: 'nope' });
check('get_event unknown id → isError with field message', r.j?.result?.isError === true && /id: no event/.test(r.j.result.content[0].text));
r = await call(8, 'list_events', { from: '640', colour: 1 });
check('read tool bad args → isError naming each argument', r.j?.result?.isError && /from: integer/.test(r.j.result.content[0].text) && /colour: unknown argument/.test(r.j.result.content[0].text));
r = await call(9, 'list_places', { q: '长安' });
check('list_places q=长安 → changan', (r.j?.result?.structuredContent?.places || []).some(p => p.id === 'changan'));
r = await call(10, 'list_poems', { poet: '杜甫' });
check('list_poems poet=杜甫', r.j?.result?.structuredContent?.total >= 3, `${r.j?.result?.structuredContent?.total}`);
r = await call(11, 'list_shuoshu', {});
check('list_shuoshu ≥ 4 curated', (r.j?.result?.structuredContent?.shuoshu || []).length >= 4);
r = await call(12, 'add_event', { title: '测试', date: '0900', kind: 'war', summary: '', place: 'nowhere', evidence: [{ type: 'text', title: 't', cite: 'c', url: 'http://x' }], extra: 1 });
const errs = r.j?.result?.structuredContent?.errors || [];
check('add_event invalid → isError, one message per wrong field', r.j?.result?.isError && ['unknown field "extra"', 'date:', 'kind:', 'summary:', 'place:', 'evidence[0].url'].every(k => errs.some(e => e.includes(k))), errs.length + ' errors');
r = await call(13, 'add_poem', { date: '0749', place: 'changan', poem: { poet: '岑参', text: [] }, summary: 's', evidence: [] });
check('add_poem invalid → poem.title / poem.text / evidence named', r.j?.result?.isError && ['poem.title', 'poem.text', 'evidence'].every(k => (r.j.result.structuredContent.errors || []).some(e => e.startsWith(k))));
r = await call(14, 'add_shuoshu', { title: '测', year: 'x', hui: [] });
check('add_shuoshu invalid → year / era / hui / sources named', r.j?.result?.isError && ['year', 'era', 'hui', 'sources'].every(k => (r.j.result.structuredContent.errors || []).some(e => e.startsWith(k))));
r = await call(15, 'add_event', { title: 'x<script>', date: '0700', kind: 'pol', summary: 'a', place: 'changan', evidence: [{ type: 'text', title: 't', cite: 'c', url: 'https://example.org' }] });
check('add_event with markup → refused', r.j?.result?.isError && /no HTML/.test(r.j.result.content[0].text));
r = await post(rpc(16, 'tools/call', { name: 'drop_table', arguments: {} }));
check('unknown tool → -32602', r.j?.error?.code === -32602);
r = await post(rpc(17, 'resources/read', { uri: 'x' }));
check('unknown method → -32601', r.j?.error?.code === -32601);
r = await post('{not json');
check('parse error → -32700, id null', r.j?.error?.code === -32700 && r.j.id === null);
r = await post({ id: 18, method: 'ping' });
check('missing jsonrpc → -32600', r.j?.error?.code === -32600);
r = await post([rpc(19, 'ping'), { jsonrpc: '2.0', method: 'notifications/initialized' }, rpc(20, 'tools/list')]);
check('batch → array of responses for the requests only', Array.isArray(r.j) && r.j.length === 2 && r.j[0].id === 19);
r = await post('x'.repeat(70 * 1024));
check('oversized body → 413', r.status === 413);
let g = await fetch(BASE + '/mcp', { headers: { Accept: 'text/event-stream' } });
check('GET /mcp → 405 (no SSE stream)', g.status === 405);
g = await fetch(BASE + '/mcp', { method: 'OPTIONS', headers: { Origin: 'https://example.org', 'Access-Control-Request-Method': 'POST' } });
check('OPTIONS → 204 with CORS', g.status === 204 && g.headers.get('access-control-allow-origin') === '*');
g = await fetch(BASE + '/api/contrib');
const cj = await g.json().catch(() => null);
check('GET /api/contrib → {places, events, poems, shuoshu}', cj && ['places', 'events', 'poems', 'shuoshu'].every(k => k in cj));
g = await fetch(BASE + '/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"action":"list"}' });
check('POST /api/admin without key → 401', g.status === 401);
g = await fetch(BASE + '/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' }, body: '{"action":"list"}' });
check('POST /api/admin with a wrong key → 401', g.status === 401);

if (KEY) {
  const admin = body => fetch(BASE + '/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY }, body: JSON.stringify(body) }).then(x => x.json());
  const ev = { title: '测试事件·协议检查' + Date.now().toString(36), date: '0700', kind: 'pol', summary: '协议一致性测试写入，随即删除。', place: 'changan',
    evidence: [{ type: 'modern', title: '测试', cite: '测试', url: 'https://example.org/' }] };
  r = await call(21, 'add_event', ev);
  const id = r.j?.result?.structuredContent?.id;
  check('add_event valid → ok, id, live url', r.j?.result?.isError === false && id && /\?ev=/.test(r.j.result.structuredContent.url), id);
  let c = await fetch(BASE + '/api/contrib').then(x => x.json());
  check('added event is in /api/contrib at once', c.events.some(e => e.id === id));
  r = await call(22, 'add_event', ev);
  check('same event again → duplicate error', r.j?.result?.isError && /already exists/.test(r.j.result.content[0].text));
  r = await call(23, 'list_events', { source: 'community', q: '协议检查' });
  check('list_events source=community finds it', (r.j?.result?.structuredContent?.events || []).some(e => e.id === id));
  let a = await admin({ action: 'hide', ids: [id] });
  c = await fetch(BASE + '/api/contrib').then(x => x.json());
  check('admin hide → gone from /api/contrib', a.ok && a.changed === 1 && !c.events.some(e => e.id === id));
  a = await admin({ action: 'delete', ids: [id] });
  check('admin delete → row removed', a.ok && a.changed === 1);
}

const passed = results.filter(x => x.ok).length;
console.log(JSON.stringify({ base: BASE, passed, total: results.length, failed: results.filter(x => !x.ok).map(x => x.name) }));
process.exit(passed === results.length ? 0 : 1);
