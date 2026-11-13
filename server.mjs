// Static server for the POC. HS_PORT overrides 7814 (claimed in openclaw/tools/INDEX.md).
// Supports Range requests: iOS Safari refuses to play audio from servers that ignore them.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const PORT = +process.env.HS_PORT || 7814;
// .css/.woff2: the vendored WenKai font (data/vendor/) and css/map.css; a font served as text/html is refused by the browser
// and every label falls back to Kaiti
const TYPE = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.bin': 'application/octet-stream' };

createServer(async (req, res) => {
  // a path that starts with // parses as a host and throws; uncaught, it took the whole server (and the live /history) down
  let url; try { url = new URL(req.url, 'http://x'); } catch { res.statusCode = 400; return res.end('bad request'); }
  if (url.pathname === '/health') return res.end(JSON.stringify({ service: 'history-sandbox' }));
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  // the pages, their modules (js/, css/) and data/ (vendored three + font under data/vendor/); nothing else in the folder
  if (!/^\/([a-z0-9-]+\.html)?$|^\/js\/[a-z0-9-]+\.js$|^\/css\/[a-z0-9-]+\.css$|^\/data\//.test(rel)) { res.statusCode = 404; return res.end('not found'); }
  let body;
  try { body = await readFile(join(ROOT, rel === '/' ? 'index.html' : rel)); }
  catch { res.statusCode = 404; return res.end('not found'); }
  // data/vendor/ paths carry their version (three@0.170.0/…), so they cache like the CDN they replace; the rest is no-store
  const cache = rel.startsWith('/data/vendor/') ? 'public, max-age=31536000, immutable' : 'no-store';
  const headers = { 'content-type': TYPE[extname(rel)] || 'text/html; charset=utf-8', 'cache-control': cache, 'accept-ranges': 'bytes' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    const start = m[1] ? +m[1] : Math.max(0, body.length - +m[2]);
    const end = m[1] && m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
    res.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${body.length}`, 'content-length': end - start + 1 });
    return res.end(body.subarray(start, end + 1));
  }
  res.writeHead(200, { ...headers, 'content-length': body.length });
  res.end(body);
}).listen(PORT, '127.0.0.1', () => console.log(`history-sandbox on http://127.0.0.1:${PORT}`));
