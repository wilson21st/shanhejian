// /mcp: 山河鉴 as a remote MCP server (Streamable HTTP transport, stateless: every POST is one JSON-RPC message or a
// batch, answered with application/json; no sessions, no SSE stream, so GET is 405). Any MCP client can connect:
//   claude mcp add --transport http shanhejian https://shanhejian.pages.dev/mcp
// Reads come from the deployed data files + the D1 contributions; add_* validate with js/contrib-schema.js and write to
// D1, live at once (lib/contrib-store.js). See the README for the other clients.
import { LIMITS } from '../lib/contrib-store.js';
import { INSTRUCTIONS, SERVER, TOOLS, callTool } from '../lib/tools.js';

const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const toolResult = (v, isError = false) => ({ content: [{ type: 'text', text: JSON.stringify(v) }], structuredContent: v, isError });
const rpcErr = (id, code, message, data) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data ? { data } : {}) } });

async function handle(msg, c) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return rpcErr(msg && msg.id, -32600, 'Invalid Request: expected a JSON-RPC 2.0 object with a method');
  const { id, method, params = {} } = msg, notification = id === undefined;
  if (notification) return null; // notifications/initialized, notifications/cancelled … need no answer
  const ok = result => ({ jsonrpc: '2.0', id, result });
  switch (method) {
    case 'initialize': {
      const v = VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : VERSIONS[0];
      return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: INSTRUCTIONS });
    }
    case 'ping': return ok({});
    case 'tools/list': return ok({ tools: TOOLS });
    case 'tools/call': {
      const t = TOOLS.find(x => x.name === params.name);
      if (!t) return rpcErr(id, -32602, `Unknown tool "${params.name}". Tools: ${TOOLS.map(x => x.name).join(', ')}`);
      const { result, isError } = await callTool(t.name, params.arguments ?? {}, c);
      return ok(toolResult(result, isError));
    }
    case 'resources/list': return ok({ resources: [] });
    case 'prompts/list': return ok({ prompts: [] });
    default: return rpcErr(id, -32601, `Method not found: ${method}`);
  }
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization', 'Access-Control-Expose-Headers': 'Mcp-Session-Id' };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

export async function onRequestPost({ request, env }) {
  const len = +(request.headers.get('Content-Length') || 0);
  if (len > LIMITS.body) return json(rpcErr(null, -32600, `request too large (max ${LIMITS.body} bytes)`), 413);
  const text = await request.text();
  if (text.length > LIMITS.body) return json(rpcErr(null, -32600, `request too large (max ${LIMITS.body} bytes)`), 413);
  let body; try { body = JSON.parse(text); } catch { return json(rpcErr(null, -32700, 'Parse error: body is not JSON'), 400); }
  const c = { env, req: request, url: request.url };
  if (Array.isArray(body)) {
    if (!body.length || body.length > 20) return json(rpcErr(null, -32600, 'Invalid Request: batch of 1–20 messages'), 400);
    const out = (await Promise.all(body.map(m => handle(m, c)))).filter(Boolean);
    return out.length ? json(out) : new Response(null, { status: 202, headers: CORS });
  }
  const out = await handle(body, c);
  return out ? json(out) : new Response(null, { status: 202, headers: CORS });
}
// no server-initiated stream: the spec's answer for a server without SSE is 405 on GET
export const onRequestGet = () => new Response(JSON.stringify({ error: 'This MCP endpoint is stateless: POST JSON-RPC to it (Streamable HTTP, JSON responses).', docs: 'https://github.com/wilson21st/shanhejian#connect-an-agent' }),
  { status: 405, headers: { Allow: 'POST, OPTIONS', 'Content-Type': 'application/json', ...CORS } });
export const onRequestDelete = () => new Response(null, { status: 405, headers: { Allow: 'POST, OPTIONS', ...CORS } });
export const onRequestOptions = () => new Response(null, { status: 204, headers: CORS });
