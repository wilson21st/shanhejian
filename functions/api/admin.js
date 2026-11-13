// POST /api/admin (Authorization: Bearer <ADMIN_KEY>, a Pages secret): moderate community contributions.
//   {"action":"list"}                     every row incl. hidden ones (id, type, title, created_at, hidden, agent)
//   {"action":"hide"|"unhide"|"delete", "ids":["c0641..", …]}
import { sha } from '../../lib/contrib-store.js';

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });

export async function onRequestPost({ request, env }) {
  const got = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  // compare digests so the check takes the same time whatever the key
  if (!env.ADMIN_KEY || !got || (await sha(got)) !== (await sha(env.ADMIN_KEY))) return json({ ok: false, error: 'unauthorized' }, 401);
  let b; try { b = await request.json(); } catch { return json({ ok: false, error: 'body must be JSON' }, 400); }
  if (b.action === 'list') {
    const r = await env.DB.prepare('SELECT id, type, data, created_at, hidden, agent FROM items ORDER BY created_at').all();
    return json({ ok: true, items: r.results.map(x => { const d = JSON.parse(x.data); return { id: x.id, type: x.type, title: d.title, created_at: new Date(x.created_at).toISOString(), hidden: !!x.hidden, agent: x.agent }; }) });
  }
  const ids = Array.isArray(b.ids) ? b.ids.filter(x => typeof x === 'string').slice(0, 500) : [];
  if (!ids.length) return json({ ok: false, error: 'ids: array of item ids' }, 400);
  const sql = { hide: 'UPDATE items SET hidden = 1 WHERE id = ?', unhide: 'UPDATE items SET hidden = 0 WHERE id = ?', delete: 'DELETE FROM items WHERE id = ?' }[b.action];
  if (!sql) return json({ ok: false, error: 'action: list, hide, unhide or delete' }, 400);
  const res = await env.DB.batch(ids.map(id => env.DB.prepare(sql).bind(id)));
  return json({ ok: true, action: b.action, changed: res.reduce((n, r) => n + (r.meta.changes || 0), 0) });
}
