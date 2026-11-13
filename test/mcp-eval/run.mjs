#!/usr/bin/env node
// Agent eval for the 山河鉴 remote MCP server: each task in tasks.json runs through Claude Code headless
// (claude -p, only the shanhejian MCP server + WebFetch/WebSearch allowed, in an empty directory) against the live /mcp,
// and is scored from its stream-json transcript plus the live /api/contrib.
//   node test/mcp-eval/run.mjs [outDir] [--only id,id] [--par 3]
// Writes <outDir>/<task>.jsonl (transcripts) and <outDir>/results.json (per task + summary metrics).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2), flag = k => { const i = args.indexOf(k); return i < 0 ? null : args.splice(i, 2)[1]; };
const only = flag('--only'), par = +(flag('--par') || 3), out = args[0] || join(tmpdir(), 'shj-mcp-eval');
const BASE = process.env.SHJ_BASE || 'https://shanhejian.pages.dev';
let TASKS = JSON.parse(readFileSync(new URL('tasks.json', import.meta.url), 'utf8'));
if (only) TASKS = TASKS.filter(t => only.split(',').includes(t.id));
mkdirSync(out, { recursive: true });
const cwd = join(out, 'cwd'); mkdirSync(cwd, { recursive: true });
const mcpCfg = join(out, 'mcp.json');
writeFileSync(mcpCfg, JSON.stringify({ mcpServers: { shanhejian: { type: 'http', url: BASE + '/mcp' } } }));

function runClaude(t) {
  return new Promise(res => {
    const t0 = Date.now(), lines = [];
    const p = spawn('claude', ['-p', t.prompt, '--output-format', 'stream-json', '--verbose', '--mcp-config', mcpCfg, '--strict-mcp-config',
      '--allowedTools', 'mcp__shanhejian', 'WebFetch', 'WebSearch', '--max-turns', '40'], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    p.stdout.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) lines.push(l); } });
    let err = ''; p.stderr.on('data', d => err += d);
    const kill = setTimeout(() => p.kill('SIGTERM'), 15 * 60e3);
    p.on('close', code => { clearTimeout(kill); writeFileSync(join(out, t.id + '.jsonl'), lines.join('\n') + '\n'); res({ code, ms: Date.now() - t0, lines, err }); });
  });
}

const parseRes = c => { const text = Array.isArray(c) ? c.map(x => x.text || '').join('') : String(c || '');
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; } };
const km = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos(b[1] * Math.PI / 180), a[1] - b[1]) * 111;

async function score(t, run, contrib) {
  const msgs = run.lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const uses = new Map(), calls = [];
  for (const m of msgs) {
    if (m.type === 'assistant') for (const c of m.message.content || []) if (c.type === 'tool_use') { const u = { name: c.name, input: c.input }; uses.set(c.id, u); calls.push(u); }
    if (m.type === 'user') for (const c of m.message?.content || []) if (c.type === 'tool_result' && uses.has(c.tool_use_id)) {
      const u = uses.get(c.tool_use_id), r = parseRes(c.content); u.result = r; u.error = !!c.is_error || r.ok === false; }
  }
  const final = msgs.find(m => m.type === 'result') || {};
  const mcp = calls.filter(c => c.name.startsWith('mcp__shanhejian__')), adds = mcp.filter(c => /__add_/.test(c.name));
  const okAdds = adds.filter(c => !c.error && c.result && c.result.ok), ids = okAdds.map(c => c.result.id);
  const answer = final.result || '';
  const e = t.expect, checks = [];
  const has = s => answer.includes(s);
  if (e.answerIncludes) checks.push(['answer mentions ' + e.answerIncludes.join('+'), e.answerIncludes.every(has)]);
  if (e.answerAny) checks.push(['answer mentions one of ' + e.answerAny.join('/'), e.answerAny.some(has)]);
  if (e.noAdd) checks.push(['nothing added', okAdds.length === 0]);
  let item = null, live = null;
  if (t.kind === 'add') {
    checks.push(['exactly one successful add', okAdds.length === 1]);
    const pool = t.type === 'shuoshu' ? contrib.shuoshu : t.type === 'poem' ? contrib.poems : contrib.events;
    item = pool.find(x => ids.includes(x.id)) || null; live = !!item;
    checks.push(['item is in /api/contrib', live]);
    if (item) {
      const ll = item.place && (contrib.places[item.place] || null)?.ll || null;
      if (e.titleAny) checks.push(['title ~ ' + e.titleAny.join('/'), e.titleAny.some(s => item.title.includes(s))]);
      if (e.yearRange) { const y = +item.date.slice(0, 4); checks.push([`year ${e.yearRange.join('–')}`, y >= e.yearRange[0] && y <= e.yearRange[1]]); }
      if (e.year) checks.push(['year ' + e.year, item.year === e.year]);
      if (e.minHui) checks.push(['≥ ' + e.minHui + ' 回', item.hui.length >= e.minHui]);
      if (e.poet) checks.push(['poet ' + e.poet, item.poem.poet === e.poet]);
      if (e.poemTitle) checks.push(['poem title ' + e.poemTitle, item.poem.title.includes(e.poemTitle)]);
      if (e.textIncludes) checks.push(['text has ' + e.textIncludes, item.poem.text.join('').includes(e.textIncludes)]);
      if (e.near) { const p = ll || (item.place && null); const pll = p || (contrib.places[item.place] || {}).ll; // curated place ids: resolve below
        item._ll = pll; }
    }
  }
  return { id: t.id, kind: t.kind, type: t.type, exit: run.code, wallS: Math.round(run.ms / 100) / 10, turns: final.num_turns, costUsd: final.total_cost_usd,
    mcpCalls: mcp.length, allToolCalls: calls.length, toolsUsed: [...new Set(calls.map(c => c.name.replace('mcp__shanhejian__', '')))],
    addCalls: adds.length, addErrors: adds.filter(c => c.error).map(c => c.result && c.result.errors), firstAddOk: adds.length ? !adds[0].error : null,
    readErrors: mcp.filter(c => !/__add_/.test(c.name) && c.error).length, ids, item, checks, answer: answer.slice(0, 1500) };
}

const results = [], queue = [...TASKS];
async function worker() { for (let t; (t = queue.shift());) {
  console.log('start', t.id); const run = await runClaude(t); console.log('done ', t.id, run.code, Math.round(run.ms / 1000) + 's');
  results.push({ t, run }); } }
await Promise.all(Array.from({ length: par }, worker));
// score after all ran, against one fresh /api/contrib (the place lookup needs curated places too: ask /mcp list_places)
const contrib = await fetch(BASE + '/api/contrib').then(r => r.json());
const scored = [];
for (const { t, run } of results) {
  const s = await score(t, run, contrib);
  if (t.expect.near && s.item) {
    let ll = s.item._ll;
    if (!ll && s.item.place) { const r = await fetch(BASE + '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'list_places', arguments: { limit: 200 } } }) }).then(x => x.json());
      ll = (r.result.structuredContent.places.find(p => p.id === s.item.place) || {}).ll; }
    s.checks.push([`place within ${t.expect.km} km of [${t.expect.near}]`, !!ll && km(ll, t.expect.near) <= t.expect.km]);
    s.placeLL = ll; delete s.item._ll;
  }
  s.recovery = !!t.recovery;
  if (t.recovery) s.checks.push(['first call failed, as planted', s.firstAddOk === false]);
  s.success = s.exit === 0 && s.checks.every(c => c[1]);
  scored.push(s);
}
scored.sort((a, b) => TASKS.findIndex(t => t.id === a.id) - TASKS.findIndex(t => t.id === b.id));
const n = scored.length, adds = scored.filter(s => s.kind === 'add'), withErr = scored.filter(s => s.addErrors.length);
const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
const allAdds = scored.reduce((x, s) => x + s.addCalls, 0), okAddCalls = scored.reduce((x, s) => x + s.addCalls - s.addErrors.length, 0);
const summary = {
  tasks: n, taskSuccessRate: `${scored.filter(s => s.success).length}/${n}`,
  firstTryValidAddRate: `${adds.filter(s => !s.recovery && s.firstAddOk).length}/${adds.filter(s => !s.recovery).length} add tasks (recovery tasks excluded: their first call is wrong on purpose)`,
  addCallValidRate: `${okAddCalls}/${allAdds} add_* calls`,
  errorRecoveryRate: `${withErr.filter(s => s.ids.length > 0).length}/${withErr.length} tasks that hit an add_* error`,
  mcpCallsPerTask: avg(scored.map(s => s.mcpCalls)), allToolCallsPerTask: avg(scored.map(s => s.allToolCalls)),
  wallSecondsMedian: scored.map(s => s.wallS).sort((a, b) => a - b)[Math.floor(n / 2)], wallSecondsMean: avg(scored.map(s => s.wallS)),
  visibleOnLiveSite: `${adds.filter(s => s.item).length}/${adds.length} added items in /api/contrib`,
  costUsd: Math.round(scored.reduce((x, s) => x + (s.costUsd || 0), 0) * 100) / 100,
};
writeFileSync(join(out, 'results.json'), JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), summary, tasks: scored }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const s of scored) console.log(`${s.success ? 'OK  ' : 'FAIL'} ${s.id}  ${s.wallS}s  mcp ${s.mcpCalls}  adds ${s.addCalls} (err ${s.addErrors.length})  ${s.checks.filter(c => !c[1]).map(c => '✗ ' + c[0]).join('; ')}`);
