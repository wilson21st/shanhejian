// /api/events/{id}, /api/poems/{id}, /api/shuoshu/{id} (lib/rest.js)
import { rest } from '../../../lib/rest.js';
export const onRequest = ctx => rest(ctx);
