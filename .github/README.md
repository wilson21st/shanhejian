# 山河鉴 · Shanhejian

A history explorer: a 3D painted map of China lying as a scroll on a Song-dynasty desk, with a timeline of events,
people's journeys, recited Tang poems and 说书 (storyteller) scrolls.

**Live:** https://shanhejian.pages.dev

- Plain ES modules, no build step, zero npm packages. three.js and the LXGW WenKai webfont are vendored in `data/vendor/`.
- Run locally: `node server.mjs` → http://127.0.0.1:7814 (`HS_PORT` to change).
- Deploy: `tools/deploy/deploy-pages.sh` (Cloudflare Pages).

Code: MIT (see `LICENSE`). Third-party assets keep their own licences: fonts under `data/**/fonts` and `data/vendor` are SIL OFL 1.1 (licence text next to each file), three.js is MIT, paintings and photos are public domain or Creative Commons as listed in `data/**/CREDITS.md`, terrain from the Mapzen/AWS Terrain Tiles.
The background music the live site plays is not included in this repository (not free-licensed).

## Contributing events · 补充史事

The map plays the years 581–763 (隋 to the end of the 安史之乱). You, or your AI agent, can propose an event that is missing.
Every proposal becomes a pull request that a human reviews, so nothing reaches the live map unchecked.

**Flow:** `add_event` on the page → prefilled GitHub issue (label `event-proposal`) → you press *Submit* →
the [`event-proposal`](workflows/event-proposal.yml) Action validates it and opens a PR that appends it to
`data/contrib-events.json` → the maintainer merges → the next deploy shows it to everyone.

### For agents: the WebMCP tools

The page registers two tools with [WebMCP](https://github.com/webmachinelearning/webmcp) (`navigator.modelContext`,
Chrome's early preview) when the browser has it. In every browser the same tools are also on `window.shanhejianMCP`,
so an agent driving the page through DevTools / CDP / Playwright can call them:

```js
// read: events in a year range, optional kind / text filter; places:true adds every place id with [lon, lat]
shanhejianMCP.list_events({ from: 640, to: 650, kind: 'dip', places: true })

// propose: validated with js/contrib-schema.js, shown on this tab's map, returns a GitHub issue link
shanhejianMCP.add_event({
  title: '文成公主入藏', date: '0641-02', kind: 'dip',
  summary: '贞观十五年，文成公主由江夏王李道宗护送入吐蕃，与松赞干布成婚。',
  place: { name: '逻些', ll: [91.1, 29.65] },            // or an existing id from list_events, e.g. 'changan'
  who: ['文成公主', '松赞干布', '李道宗'],
  evidence: [{ type: 'text', title: '《旧唐书·吐蕃传》', cite: '《旧唐书》卷一百九十六上',
               url: 'https://zh.wikisource.org/wiki/舊唐書/卷196上', quote: '…' }],
})
// → { ok: true, id, event, previewStep, issueUrl, next }   or   { ok: false, errors: [...] }
```

`shanhejianMCP.tools` holds each tool's name, description and JSON Schema (`inputSchema`). The rules:
simplified Chinese; date `YYYY`, `YYYY-MM` or `YYYY-MM-DD` (Julian, 4-digit year, 0581–0763); `kind` one of
`mil` 军事 · `pol` 政局 · `dip` 外交 · `gov` 治理 · `cul` 文化 · `nat` 天象灾异; at least one source with an https link you
actually read; no HTML. The page writes nothing anywhere: the human submits the issue with their own GitHub account.

### Without an agent

Open a new issue with the **补充史事 · Event proposal** template and fill in the JSON. Editing the issue re-runs the checks.

## Connect an agent · 远程 MCP

山河鉴 is also a remote [MCP](https://modelcontextprotocol.io) server: **`https://shanhejian.pages.dev/mcp`**
(Streamable HTTP, stateless JSON, no login). Any agent can browse the map's events, poems and 说书, and add new ones.
**What an agent adds is live on the site at once** — on the map and timeline (events, poems) or the 书目 page (说书),
marked 社区补充 — with no deploy and no review gate. Every addition is validated first; the maintainer can hide it later.

### Claude Code

```sh
claude mcp add --transport http shanhejian https://shanhejian.pages.dev/mcp
claude -p "用 shanhejian 工具，把王翰的《凉州词》加到地图上"     # or just ask in a session
```

### Codex CLI

```sh
codex mcp add shanhejian --url https://shanhejian.pages.dev/mcp
```
or in `~/.codex/config.toml`:
```toml
[mcp_servers.shanhejian]
url = "https://shanhejian.pages.dev/mcp"
```

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):
```json
{ "mcpServers": { "shanhejian": { "url": "https://shanhejian.pages.dev/mcp" } } }
```

### WorkBuddy / CodeBuddy, Windsurf, Cline and other `mcpServers` clients

Add a server in the MCP settings with transport *Streamable HTTP* and the URL above. In JSON form:
```json
{ "mcpServers": { "shanhejian": { "type": "streamableHttp", "url": "https://shanhejian.pages.dev/mcp" } } }
```
(The key for the transport differs between clients: `"type": "http"` in VS Code's `.vscode/mcp.json` under `"servers"`,
`"httpUrl"` in Gemini CLI's `settings.json`, *Settings → Connectors → Add custom connector* in Claude Desktop / claude.ai.)
Only Claude Code was tested end to end (see *Metrics* below); the others are documented from their own docs.

### OpenClaw

```sh
openclaw mcp add shanhejian --url https://shanhejian.pages.dev/mcp --transport streamable-http
openclaw mcp doctor shanhejian --probe
```
(or `mcp.servers.shanhejian = { url, transport: "streamable-http" }` in the config). An OpenClaw agent with only
`web_fetch` + `exec` can use the plain-HTTP route below instead, with no config at all.

### Personal agents without MCP · plain HTTP

Many assistants (Grok, ChatGPT, Gemini, a personal bot on WhatsApp/Telegram) cannot add an MCP server but can fetch a
URL, send an HTTP request or run code. Give them one link:

> **`https://shanhejian.pages.dev/llms.txt`** — read this, then add … to 山河鉴

`/llms.txt` explains the site, the rules and a worked example of each addition. The same tools are plain REST
(same validator, same per-field errors, same rate limit), described as OpenAPI 3.1 at **`/openapi.json`** — importable
as a custom-GPT action or any function-calling tool set:

- `GET /api/events?q=&from=&to=&kind=&source=&limit=&offset=` · `GET /api/events/{id}` · `POST /api/events`
- `GET /api/poems?poet=&q=&from=&to=` · `GET /api/poems/{id}` · `POST /api/poems`
- `GET /api/shuoshu?q=` · `GET /api/shuoshu/{id}` · `POST /api/shuoshu`
- `GET /api/places?q=&near=lon,lat`

```sh
curl -X POST https://shanhejian.pages.dev/api/events -H 'Content-Type: application/json' -d @event.json
# 201 {"ok":true,"id":"c0652-…","url":"https://shanhejian.pages.dev/?ev=c0652-…","item":{…}}
# 400 {"ok":false,"errors":["date: YYYY, YYYY-MM or YYYY-MM-DD…","evidence[0].url: an https URL"]}   429 = rate limit
```
An assistant that can only *open* URLs (GET) can still read everything; to add, it hands its user the JSON and the
issue link in `/llms.txt`.

### Tools

| tool | what it does |
| --- | --- |
| `list_events` | events on the map, 581–763; filter by year range, kind, text, source (`curated` / `github` / `community`) |
| `get_event` | one event or poem in full: summary, why, who, debate, every piece of evidence with its url |
| `list_places` | find a place id (and `[lon, lat]`) by name, or the places nearest a point |
| `add_event` | add an event: title, date, kind, summary, place, evidence (≥ 1 https source) |
| `list_poems` | poems pinned on the map, by poet / text / years |
| `add_poem` | pin a poem where and when it was written: date, place, poem {poet, title, text[]}, summary, evidence |
| `list_shuoshu` / `get_shuoshu` | 说书 tellings, curated (with voice) and community (text) |
| `add_shuoshu` | a 说书 in text: title, year, era, blurb, dispute (where the sources disagree), 1–10 回, sources |

Each `add_*` tool's JSON Schema carries a full worked example. A failed call returns `isError: true` and
`{ok:false, errors:[…]}` with one message per wrong field (`date: YYYY, YYYY-MM or YYYY-MM-DD…`,
`evidence[0].url: an https URL`, `place: unknown id "x" — use a known place id (list_places…`), so the agent can fix
exactly that and call again. Validation is `js/contrib-schema.js`, shared with the page and the issue workflow.

**Guards:** schema validation, no HTML anywhere, size caps (64 KB a request, 3000 chars a 回, 8 sources), duplicate
check (same title + date), 20 additions an hour and 60 a day per IP (hashed), 3000 visible items in total. Moderation is
`POST /api/admin` with the maintainer's key (`hide` / `unhide` / `delete` / `list`); nothing else can change a row.

### How it is built

- `lib/tools.js` — the tool definitions and implementations, shared by every route below.
- `functions/api/[res].js`, `functions/api/[res]/[id].js` (`lib/rest.js`) — the REST twin; `functions/openapi.json.js`
  and `functions/llms.txt.js` build the spec and the agent guide from the same definitions.
- `functions/mcp.js` — the MCP endpoint (Cloudflare Pages Function): `initialize`, `ping`, `tools/list`, `tools/call`,
  batches; notifications get `202`; `GET` is `405` (no SSE stream needed, every answer is one JSON response).
- `lib/contrib-store.js` — reads the curated data from the deployed files and the contributions from a D1 database
  (`db/schema.sql`, table `items`, one row per contribution with a `hidden` flag).
- `GET /api/contrib` — every visible contribution as `{places, events, poems, shuoshu}`; `js/timeline.js`,
  `design-poem.html`, `shuoshu-list.html` and `shuoshu-text.html` read it, so additions show without a deploy.
  `?ev=<id>` on the map opens one event.
- `.github/workflows/contrib-export.yml` — nightly, copies `/api/contrib` into `data/contrib-d1.json` (git history +
  fallback when the API is unreachable).
- `test/mcp-conformance.mjs` — raw-HTTP protocol check; `test/mcp-eval/` — the agent eval below.
- The issue → pull request route above still works and stays the way to propose an event *for review*.

### Metrics

Measured 2026-11-13 with Claude Code headless against the live server; details in `test/mcp-eval/RESULTS.md`.

- Protocol conformance (`node test/mcp-conformance.mjs`): **53/53** (MCP, REST, `/openapi.json`, `/llms.txt`, admin)
- Task success: **12/12** (9 normal tasks + 2 that start from deliberately broken input + 1 over plain HTTP)
- Plain HTTP, no MCP (agent given only the `/llms.txt` URL and `curl`): **1/1** — read the guide, checked for a
  duplicate, added 「废五铢钱，始铸开元通宝」 with the first POST, live on the map; 97 s
- First-try valid `add_*` call: **5/5** on the normal tasks
- Error-message recovery: **2/2** — each broken call fixed in one retry from the per-field errors
- MCP tool calls per task: **3.7** (normal), 4 (recovery)
- Wall time: median **52 s** a task; reads ~17 s, a 3-回 说书 ~3.5 min
- Visible on the live site: **8/8** additions, within seconds, no deploy
