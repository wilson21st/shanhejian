// GET /api/contrib: every visible community contribution from D1, in the shapes the front end already reads
// ({places, events, poems, shuoshu}); js/timeline.js and shuoshu-list.html merge it, so additions show with no deploy.
// The nightly .github/workflows/contrib-export.yml snapshots this into data/contrib-d1.json.
import { contribPayload } from '../../lib/contrib-store.js';

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify(await contribPayload(env)), { headers: { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=15', 'Access-Control-Allow-Origin': '*' } });
}
