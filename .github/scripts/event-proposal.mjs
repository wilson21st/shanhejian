#!/usr/bin/env node
// Turn an event-proposal issue into a change to data/contrib-events.json. Run by .github/workflows/event-proposal.yml.
// Reads the issue from $GITHUB_EVENT_PATH (never from the shell), validates with js/contrib-schema.js against every id and
// place already on the map, appends, and writes a result for the workflow: $RESULT_FILE = { ok, id?, title?, errors? }.
// Locally:  GITHUB_EVENT_PATH=event.json RESULT_FILE=/tmp/r.json node .github/scripts/event-proposal.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseIssueBody, validateEvent } from '../../js/contrib-schema.js';

const root = new URL('../../', import.meta.url).pathname;
const J = p => JSON.parse(readFileSync(root + p, 'utf8'));
const out = r => { writeFileSync(process.env.RESULT_FILE || '/dev/stdout', JSON.stringify(r, null, 1) + '\n'); process.exit(0); };

const issue = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')).issue;
const parsed = parseIssueBody(issue.body);
if (parsed.error) out({ ok: false, errors: [parsed.error] });

const CF = 'data/contrib-events.json';
const contrib = existsSync(root + CF) ? J(CF) : { places: {}, events: [] };
const world = J('data/world.json'), era = J('data/era.json'), poems = J('data/poems.json');
const places = { ...contrib.places, ...poems.places, ...era.places, ...world.places };
const ids = new Set([...world.events, ...era.events, ...poems.events, ...contrib.events].map(e => e.id));

const r = validateEvent(parsed.input, { places, ids });
if (!r.ok) out({ ok: false, errors: r.errors });

r.event.source = { issue: issue.number, by: issue.user && issue.user.login };
if (r.place) contrib.places[r.place.id] = { name: r.place.name, ll: r.place.ll };
contrib.events.push(r.event);
contrib.events.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
writeFileSync(root + CF, JSON.stringify(contrib, null, 1) + '\n');
out({ ok: true, id: r.event.id, title: r.event.title, date: r.event.date, place: r.place ? r.place.name : r.event.place });
