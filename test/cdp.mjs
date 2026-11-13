// Shared Chrome DevTools harness for the browser audits (REFACTOR §3): one place for the launch, the attach, the
// send/evaluate helpers and the stall guard, instead of ~25 lines copied into every audit.
//
//   import { chrome, sleep, BASE } from './cdp.mjs';
//   const c = await chrome({ tag: 'pose-audit', port: [9933, 200], args: ['--window-size=1280,640'] });
//   try { await c.send('Page.enable'); console.log(await c.ev('1+1')); } finally { c.kill(); }
//
// c.send(method, params)  raw CDP call, resolves with the whole reply ({ id, result } or { id, error })
// c.ev(expr)              Runtime.evaluate (returnByValue, awaitPromise) → the value; undefined if the page throws
// c.evx(expr)             the same, but a page exception is thrown here (for audits that must not read on past one)
// c.errs                  uncaught page exceptions (Runtime.exceptionThrown; needs Runtime.enable)
// c.events                every other CDP event, only when chrome({ keepEvents: true })
// c.kill()                close the socket and Chrome; safe to call twice
//
// Stall guard: a CDP call with no reply in HS_CDP_STALL seconds (default 120) is the "Chrome hangs at 0 CPU" stall seen
// in card- and gesture-audit (the page renders on, the reply never comes). The audit then prints CDP STALL, kills Chrome
// and exits 124, which run-all treats like its own time limit: killed and run once more.
import { spawn } from 'node:child_process';

export const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const BASE = (process.env.HS_URL || 'http://127.0.0.1:7814/').replace(/\/?$/, '/');
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const STALL_EXIT = 124;
const STALL = (+process.env.HS_CDP_STALL || 120) * 1000;

// tag names the throwaway profile (/tmp/hs-<tag>-<port>); port = [first, span]: a random debugging port in that range, so
// two audits started back to back never collide; args are extra Chrome flags (--headless=new and the port are implied)
export async function chrome({ tag = 'cdp', port = [9000, 400], args = [], keepEvents = false } = {}) {
  const PORT = port[0] + Math.floor(Math.random() * port[1]);
  const ch = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/hs-${tag}-${PORT}`, ...args, 'about:blank'], { stdio: 'ignore' });
  const wait = new Map(), errs = [], events = []; let ws, id = 0, dead = false;
  const kill = () => { if (dead) return; dead = true; for (const { tm } of wait.values()) clearTimeout(tm); wait.clear(); try { ws?.close(); } catch {} ch.kill(); };
  try {
    let list; for (let k = 0; k < 50; k++) { try { list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; } catch { await sleep(200); } }
    ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  } catch (e) { kill(); throw e; }
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { const w = wait.get(d.id); wait.delete(d.id); clearTimeout(w.tm); return w.r(d); }
    if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (keepEvents) events.push(d);
  };
  const send = (method, params = {}) => new Promise(r => {
    if (dead) return r({});
    const i = ++id, tm = setTimeout(() => {
      console.log(`CDP STALL: ${method} had no reply in ${STALL / 1000}s — Chrome killed, exit ${STALL_EXIT} (run-all reruns it)`);
      kill(); process.exit(STALL_EXIT);
    }, STALL);
    wait.set(i, { r, tm }); ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evx = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    return r.result?.result?.value;
  };
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  return { send, ev, evx, errs, events, kill, port: PORT };
}
