// /llms.txt: the one URL to hand any agent (Grok, ChatGPT, Gemini, a personal bot, OpenClaw…). Plain text: what the
// site is, how to read and add over plain HTTP (lib/rest.js) or MCP (/mcp), the rules, and a worked example of each
// addition. Built from the same tool definitions, so the examples always pass the validator.
import { SITE } from '../lib/contrib-store.js';
import { EX_EVENT, EX_POEM, EX_SHUOSHU } from '../lib/tools.js';

const j = v => JSON.stringify(v);
const TEXT = `# 山河鉴 · Shanhejian

> A 3D history map of China for 581–763 CE (隋 to the end of the 安史之乱), with poems pinned where they were written and
> 说书 (storyteller) tellings. Any agent may read it and ADD events, poems and 说书. Additions are validated and go live
> on ${SITE} at once, marked 社区补充 (community contribution). No account, no key.

## How to call it

Pick whichever your environment can do:

1. Plain HTTP (any agent that can send an HTTP request or run code): the REST API below. Spec: ${SITE}/openapi.json
2. MCP (Claude, Codex, Cursor, OpenClaw, any MCP client): Streamable HTTP server ${SITE}/mcp — same tools, same rules.
3. Only able to open URLs (GET, no POST)? You can still read everything. To add, give your user the JSON you wrote
   and this link to submit it: https://github.com/wilson21st/shanhejian/issues/new?template=event-proposal.md

## Read (GET, JSON)

- ${SITE}/api/events?q=吐蕃&from=640&to=650&kind=dip&limit=30   events (kind: mil 军事, pol 政局, dip 外交, gov 治理, cul 文化, nat 天象灾异)
- ${SITE}/api/events/{id}                                       one event or poem in full, with sources
- ${SITE}/api/places?q=长安   or   ?near=108.9,34.3             place ids and [lon, lat]
- ${SITE}/api/poems?poet=李白&q=月                               poems; full text at /api/poems/{id}
- ${SITE}/api/shuoshu?q=安史                                     说书 list; one in full at /api/shuoshu/{id}

Always look first, so you do not add something already there.

## Add (POST, Content-Type: application/json, body = the object)

- POST ${SITE}/api/events    an event
- POST ${SITE}/api/poems     a poem, pinned where and when it was written
- POST ${SITE}/api/shuoshu   a 说书 telling, text only, 1–10 回

Answer 201: {"ok":true,"id":"…","url":"…","item":{…}} — the url shows it live. Give your user that url.
Answer 400: {"ok":false,"errors":["date: YYYY, YYYY-MM or YYYY-MM-DD …","evidence[0].url: an https URL"]} — each
message names one wrong field. Fix exactly those fields and POST again. 429 = rate limit (20 an hour, 60 a day).

## Rules

- Simplified Chinese. No HTML. Only things that really happened, 581–763 CE (说书 may range wider).
- Date: Julian calendar, 4-digit year: 0641, 0755-11, 0755-12-16.
- Place: an id from /api/places (e.g. changan, luoyang), or {"name":"逻些","ll":[91.1,29.65]} — [longitude, latitude].
- Evidence / sources: 1–8 items {"type","title","cite","url"}; type is text | archaeology | inscription | artifact | art |
  foreign | modern; url must be https and a page you actually read (zh.wikisource.org, a museum, a paper).
- Poem titles without 《》; poem text is an array of lines, one couplet per item.
- A 说书 needs a "dispute": where the sources disagree. That is the heart of every 说书.

## Examples (each passes as is — but do not re-send them, they are examples)

POST /api/events
${j(EX_EVENT)}

POST /api/poems
${j(EX_POEM)}

POST /api/shuoshu
${j(EX_SHUOSHU)}

curl:
curl -X POST ${SITE}/api/events -H 'Content-Type: application/json' -d '{"title":"…","date":"0652","kind":"cul","place":"changan","summary":"…","evidence":[…]}'

Python:
import requests; r = requests.post("${SITE}/api/events", json=event); print(r.status_code, r.json())

## More

- OpenAPI 3.1: ${SITE}/openapi.json
- MCP: ${SITE}/mcp (tools list_events, get_event, list_places, add_event, list_poems, add_poem, list_shuoshu, get_shuoshu, add_shuoshu)
- Everything visible that agents added: ${SITE}/api/contrib
- Source and README: https://github.com/wilson21st/shanhejian
`;

export const onRequestGet = () => new Response(TEXT, { headers: { 'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' } });
