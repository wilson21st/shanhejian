// lib/contrib-store.js: the server side of community contributions, used by the Pages Functions in functions/
// (/mcp, /api/contrib, /api/admin). Reads the curated data straight from the deployed static files (env.ASSETS) and the
// contributions from the D1 database bound as DB (schema: db/schema.sql). Validation is js/contrib-schema.js, the same
// module the page and the event-proposal Action use.
import { KINDS, SPAN, validateEvent, validatePoem, validateShuoshu } from '../js/contrib-schema.js';

export const SITE = 'https://shanhejian.pages.dev';
export const LIMITS = { body: 64 * 1024, perHour: 20, perDay: 60, rows: 3000 };

// curated data, cached per isolate (a deploy starts new isolates, so it never goes stale)
let BASE = null;
export async function base(env, url) {
  if (BASE) return BASE;
  const get = p => env.ASSETS.fetch(new Request(new URL(p, url))).then(r => r.ok ? r.json() : null).catch(() => null);
  const [world, era, poems, contrib, stories] = await Promise.all(['/data/world.json', '/data/era.json', '/data/poems.json',
    '/data/contrib-events.json', '/data/shuoshu/stories.json'].map(get));
  const c = contrib || { places: {}, events: [] };
  const places = { ...c.places, ...poems.places, ...era.places, ...world.places };
  // the same event list the map plays (js/timeline.js EVS), minus the minute-by-minute 626 detail of world.json
  const events = [...era.events.filter(e => e.id !== 's626xwm').map(e => ({ ...e, source: 'curated' })),
    ...c.events.map(e => ({ ...e, source: 'github' }))];
  BASE = { places, events, poems: poems.events.map(e => ({ ...e, source: 'curated' })), stories: (stories || []).map(s => ({ ...s, source: 'curated' })),
    ids: new Set([...world.events, ...era.events, ...poems.events, ...c.events].map(e => e.id)) };
  return BASE;
}

// contributions: every visible row (or all rows for the admin)
export async function rows(env, { all = false } = {}) {
  const r = await env.DB.prepare(`SELECT id, type, data, place, created_at, hidden FROM items ${all ? '' : 'WHERE hidden = 0'} ORDER BY created_at`).all();
  return r.results.map(x => ({ id: x.id, type: x.type, data: JSON.parse(x.data), place: x.place ? JSON.parse(x.place) : null, created_at: x.created_at, hidden: !!x.hidden }));
}

// everything merged: places, events (incl. contributed), poems, stories
export async function world(env, url) {
  const b = await base(env, url), R = await rows(env);
  const places = { ...b.places };
  for (const r of R) if (r.place) places[r.place.id] = { name: r.place.name, ll: r.place.ll, contrib: true };
  const tag = r => ({ ...r.data, source: 'community', addedAt: new Date(r.created_at).toISOString() });
  return { places, rows: R, events: [...b.events, ...R.filter(r => r.type === 'event').map(tag)],
    poems: [...b.poems, ...R.filter(r => r.type === 'poem').map(tag)], stories: [...b.stories, ...R.filter(r => r.type === 'shuoshu').map(tag)],
    ids: new Set([...b.ids, ...(await env.DB.prepare('SELECT id FROM items').all()).results.map(x => x.id)]) };
}

// GET /api/contrib payload: the visible contributions in the shapes the front end already reads
export async function contribPayload(env) {
  const R = await rows(env), places = {};
  for (const r of R) if (r.place) places[r.place.id] = { name: r.place.name, ll: r.place.ll };
  const of = t => R.filter(r => r.type === t).map(r => ({ ...r.data, addedAt: new Date(r.created_at).toISOString() }));
  return { generated: new Date().toISOString(), places, events: of('event'), poems: of('poem'), shuoshu: of('shuoshu') };
}

export const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
  .map(b => b.toString(16).padStart(2, '0')).join('');
export const ipHash = async (req, env) => (await sha((env.ADMIN_KEY || 'salt') + '|' + (req.headers.get('CF-Connecting-IP') || 'local'))).slice(0, 24);

// fixed-window rate limit on writes; returns null or an error message
export async function rateLimit(env, ih) {
  const now = Date.now(), h = Math.floor(now / 3600e3), d = Math.floor(now / 86400e3);
  const keys = [[`${ih}|h|${h}`, LIMITS.perHour, (h + 1) * 3600e3, 'hour'], [`${ih}|d|${d}`, LIMITS.perDay, (d + 1) * 86400e3, 'day']];
  for (const [k, max, exp, w] of keys) {
    const r = await env.DB.prepare('SELECT n FROM hits WHERE key = ?').bind(k).first();
    if (r && r.n >= max) return `rate limit: at most ${max} additions per ${w} from one address; try again after ${new Date(exp).toISOString()}`;
  }
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE hidden = 0').first();
  if (total.n >= LIMITS.rows) return 'the contribution store is full for now; please open a GitHub issue instead (https://github.com/wilson21st/shanhejian/issues)';
  await env.DB.batch(keys.map(([k, , exp]) => env.DB.prepare('INSERT INTO hits (key, n, exp) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET n = n + 1').bind(k, exp)));
  // tidy expired counters now and then
  if (Math.random() < 0.05) await env.DB.prepare('DELETE FROM hits WHERE exp < ?').bind(now).run();
  return null;
}

const VALIDATE = { event: validateEvent, poem: validatePoem, shuoshu: validateShuoshu };
// validate + store one contribution; returns the tool result object
export async function add(type, input, { env, req, url }) {
  const W = await world(env, url);
  const r = VALIDATE[type](input, { places: W.places, ids: W.ids });
  if (!r.ok) return { ok: false, errors: r.errors };
  const ih = await ipHash(req, env), limited = await rateLimit(env, ih);
  if (limited) return { ok: false, errors: [limited] };
  const item = r.event || r.story;
  await env.DB.prepare('INSERT INTO items (id, type, data, place, created_at, ip_hash, agent, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, 0)')
    .bind(item.id, type, JSON.stringify(item), r.place ? JSON.stringify(r.place) : null, Date.now(), ih, (req.headers.get('User-Agent') || '').slice(0, 120)).run();
  const link = type === 'shuoshu' ? `${SITE}/shuoshu-text.html?c=${item.id}` : `${SITE}/?ev=${item.id}`;
  return { ok: true, id: item.id, type, live: true, url: link, item, newPlace: r.place || undefined,
    note: 'Live now for everyone: ' + (type === 'shuoshu' ? 'listed on 说书 · 书目 (shuoshu-list.html) as a community telling.' : 'on the map and timeline, marked 社区补充.')
      + ' It is copied into the GitHub repo nightly. The maintainer can hide it.' };
}

export { KINDS, SPAN };
