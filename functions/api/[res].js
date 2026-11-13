// /api/events, /api/poems, /api/places, /api/shuoshu: the REST twin of /mcp (lib/rest.js). /api/contrib and /api/admin
// are their own files and take precedence over this dynamic route.
import { rest } from '../../lib/rest.js';
export const onRequest = ctx => rest(ctx);
