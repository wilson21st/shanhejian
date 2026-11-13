# 山河鉴 · Shanhejian

A history explorer: a 3D painted map of China lying as a scroll on a Song-dynasty desk, with a timeline of events,
people's journeys, recited Tang poems and 说书 (storyteller) scrolls.

**Live:** https://shanhejian.pages.dev

- Plain ES modules, no build step, zero npm packages. three.js and the LXGW WenKai webfont are vendored in `data/vendor/`.
- Run locally: `node server.mjs` → http://127.0.0.1:7814 (`HS_PORT` to change).
- Deploy: `tools/deploy/deploy-pages.sh` (Cloudflare Pages).

Code: MIT (see `LICENSE`). Fonts: SIL OFL 1.1. Images: public domain / CC, credited in `data/**/CREDITS.md`.
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

### Future: a plain HTTP route

A simpler route for agents without a browser would be `PUT https://shanhejian.pages.dev/api/events` with the same JSON:
a Cloudflare Pages Function that runs the same validator and opens the issue (or PR) itself. That needs a fine-grained
GitHub token limited to this repo (issues: write) stored as a Pages secret, plus rate limiting; it is not built yet.

### Developing

`node server.mjs`, then open http://127.0.0.1:7814. The validator is one file shared by the page and the Action
(`js/contrib-schema.js`); test the Action's script locally with
`GITHUB_EVENT_PATH=event.json node .github/scripts/event-proposal.mjs`.
