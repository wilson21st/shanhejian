// Runs every audit and validator one after another and prints a pass/fail table (METRICS.md says what each one checks).
// One at a time on purpose: the browser audits share the GPU, and two at once fail each other's frame budgets.
//
//   node test/run-all.mjs                 # everything (~40 min; server on 127.0.0.1:7814, HS_URL overrides)
//   node test/run-all.mjs --quick         # skip the slow ones (card desktop, gesture desktop/win, flicker, alias, perf): ~15 min
//   node test/run-all.mjs --only ui,tilt  # just these ids
//   node test/run-all.mjs --out DIR       # full output of each run goes to DIR/<id>.txt (default /tmp/hs-run-all)
//   node test/run-all.mjs --limit 600     # seconds before any audit is killed (default: its own limit in AUDITS); a
//                                         # timeout is retried once, then marked FAIL timeout
//
// PASS = exit code 0. Each row also shows the audit's own last verdict line, its time and the load average when it
// started: the frame-time budgets (perf, gesture) are sensitive to a busy Mac, so a FAIL at load > 4 wants a rerun
// back-to-back with the previous page (HS_PAGE=base-….html) before it is believed.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadavg } from 'node:os';

const ROOT = new URL('..', import.meta.url).pathname;
const BASE = (process.env.HS_URL || 'http://127.0.0.1:7814/').replace(/\/?$/, '/');
const args = process.argv.slice(2), opt = k => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const OUT = opt('--out') || '/tmp/hs-run-all', ONLY = opt('--only')?.split(','), QUICK = args.includes('--quick');

// id, kind (data = validator on the JSON files, func = does a feature work, nf = non-functional), command, slow,
// time limit in seconds (about 3× its normal run on this Mac)
const AUDITS = [
  ['world', 'data', ['eval.mjs'], false, 60],
  ['era', 'data', ['test/eval-era.mjs'], false, 60],
  ['poems', 'data', ['eval-poems.mjs'], false, 60],
  ['battles', 'data', ['test/eval-battles.mjs'], false, 60],
  ['huimu', 'data', ['test/eval-huimu.mjs'], false, 60],
  ['people', 'data', ['test/eval-people.mjs'], false, 60],
  ['shuoshu-pace', 'data', ['test/shuoshu-pace-gate.mjs'], false, 180],
  ['capital', 'func', ['test/capital-audit.mjs'], false, 120],
  ['card-phone', 'func', ['test/card-audit.mjs', 'phone'], false, 900],
  ['card-desktop', 'func', ['test/card-audit.mjs', 'desktop'], true, 900],
  ['tilt', 'func', ['test/tilt-audit.mjs', 'all'], false, 180],
  ['bgm', 'func', ['test/bgm-audit.mjs'], false, 180],
  ['story', 'func', ['test/story-audit.mjs'], false, 300],
  ['entry-hit', 'func', ['test/entry-hit-audit.mjs'], false, 400],
  ['ui', 'nf', ['test/ui-audit.mjs'], false, 600],
  ['anim', 'nf', ['test/anim-audit.mjs'], false, 120],
  ['gesture-phone', 'nf', ['test/gesture-audit.mjs', 'phone'], false, 300],
  ['gesture-desktop', 'nf', ['test/gesture-audit.mjs', 'desktop'], true, 300],
  ['gesture-win', 'nf', ['test/gesture-audit.mjs', 'win'], true, 300],
  ['flicker', 'nf', ['test/flicker-audit.mjs'], true, 400],
  ['alias', 'nf', ['test/alias-audit.mjs'], true, 180],
  ['perf', 'nf', ['test/perf-audit.mjs'], true, 400],
  ['unroll', 'nf', ['test/unroll-audit.mjs'], true, 900],
  ['player', 'nf', ['test/player-audit.mjs'], false, 600],
  ['poem-sync', 'nf', ['test/poem-sync.mjs'], false, 300],
];

// an audit that waits on a page promise or CDP reply that never settles (seen in card- and gesture-audit: the page renders
// on, the audit waits forever) would hang the whole run, so each gets a time limit; its process group is killed, Chrome
// included, and it is run once more, since a stalled harness says nothing about the page
const LIMIT = opt('--limit') && +opt('--limit');
const run = (cmd, limit) => new Promise(res => {
  const p = spawn(process.execPath, cmd, { cwd: ROOT, env: process.env, detached: true }); let out = '', dead = false;
  const tm = setTimeout(() => { dead = true; out += `\nTIMEOUT after ${limit}s`; try { process.kill(-p.pid, 'SIGKILL'); } catch {} }, limit * 1000);
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  // exit 124 = the audit's own CDP stall guard fired (test/cdp.mjs): the same verdict as the time limit, sooner
  p.on('close', code => { clearTimeout(tm); res({ code: dead || code === 124 ? 'timeout' : code, out }); });
});

try { if ((await (await fetch(BASE + 'health')).json()).service !== 'history-sandbox') throw 0; }
catch { console.error(`no history-sandbox server at ${BASE} — start it with: node server.mjs`); process.exit(2); }
mkdirSync(OUT, { recursive: true });

const rows = [];
for (const [id, kind, cmd, slow, limit] of AUDITS) {
  if (ONLY ? !ONLY.includes(id) : QUICK && slow) continue;
  const load = loadavg()[0], t0 = Date.now();
  process.stdout.write(`${id.padEnd(16)}… `);
  let { code, out } = await run(cmd, LIMIT || limit);
  if (code === 'timeout') { process.stdout.write('timeout, retry… '); ({ code, out } = await run(cmd, LIMIT || limit)); }
  writeFileSync(`${OUT}/${id}.txt`, out);
  const verdict = out.split('\n').map(s => s.trim()).filter(s => /PASS|FAIL|✗|TIMEOUT/.test(s)).pop() || out.trim().split('\n').pop() || '';
  const r = { id, kind, ok: code === 0, code, s: (Date.now() - t0) / 1000, load, verdict: verdict.slice(0, 90) };
  rows.push(r); console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.s.toFixed(0)}s`);
}

console.log(`\n${'audit'.padEnd(16)} kind  result  time  load  verdict`);
for (const r of rows) console.log(`${r.id.padEnd(16)} ${r.kind.padEnd(5)} ${(r.ok ? 'PASS' : 'FAIL ' + r.code).padEnd(7)} ${(r.s.toFixed(0) + 's').padStart(5)} ${r.load.toFixed(1).padStart(5)}  ${r.verdict}`);
const bad = rows.filter(r => !r.ok);
writeFileSync(`${OUT}/summary.json`, JSON.stringify(rows, null, 1));
console.log(`\n${bad.length ? `FAIL: ${bad.map(r => r.id).join(', ')}` : `PASS: all ${rows.length}`}   (outputs in ${OUT})`);
process.exit(bad.length ? 1 : 0);
