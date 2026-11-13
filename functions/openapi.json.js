// /openapi.json: OpenAPI 3.1 for the REST twin (lib/rest.js), built from the same tool definitions as /mcp, so the
// two never drift. Custom GPTs, Grok/Gemini function calling and code-running agents can load it as is.
import { SITE } from '../lib/contrib-store.js';
import { ROUTES, CORS } from '../lib/rest.js';
import { TOOLS } from '../lib/tools.js';

const T = Object.fromEntries(TOOLS.map(t => [t.name, t]));
const ERR = { description: 'Not done. `errors` names each wrong field — fix those and send again.',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/Errors' } } } };
const OK = d => ({ description: d, content: { 'application/json': { schema: { type: 'object' } } } });

function param(k, s, required) {
  const schema = s.type === 'array' ? { type: 'string', pattern: '^-?[\\d.]+,-?[\\d.]+$' } : { ...s };
  delete schema.description;
  return { name: k, in: 'query', required: !!required, description: s.type === 'array' ? 'lon,lat — e.g. 108.9,34.3' : s.description, schema };
}

function spec() {
  const paths = {};
  for (const [res, r] of Object.entries(ROUTES)) {
    const p = paths['/api/' + res] = {};
    const L = T[r.list];
    p.get = { operationId: r.list, summary: L.title, description: L.description,
      parameters: Object.entries(L.inputSchema.properties || {}).map(([k, s]) => param(k, s)), responses: { 200: OK('the list'), 400: ERR } };
    if (r.add) {
      const A = T[r.add], { examples, ...schema } = A.inputSchema;
      p.post = { operationId: r.add, summary: A.title, description: A.description,
        requestBody: { required: true, content: { 'application/json': { schema, example: examples && examples[0] } } },
        responses: { 201: OK('added and live: {ok:true, id, url, item}'), 400: ERR, 413: ERR, 429: { ...ERR, description: 'rate limit (20 an hour, 60 a day per address)' } } };
    }
    if (r.get) {
      const G = T[r.get];
      paths[`/api/${res}/{id}`] = { get: { operationId: r.get + (res === 'poems' ? '_poem' : ''), summary: G.title, description: G.description,
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: OK('the full record'), 404: ERR } } };
    }
  }
  return { openapi: '3.1.0',
    info: { title: '山河鉴 · Shanhejian history map API', version: '1.0.0',
      description: `Read and add events, poems and 说书 on ${SITE} (China 581–763 CE). Additions are validated and go live at once, marked 社区补充. No key needed. Guide for agents: ${SITE}/llms.txt. The same tools over MCP: ${SITE}/mcp.` },
    servers: [{ url: SITE }], paths,
    components: { schemas: { Errors: { type: 'object', properties: { ok: { const: false }, errors: { type: 'array', items: { type: 'string' } } } } } } };
}

export const onRequestGet = () => new Response(JSON.stringify(spec(), null, 1), { headers: { 'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300', ...CORS } });
