# Remote MCP — eval results (2026-11-13)

Server: `https://shanhejian.pages.dev/mcp` (Cloudflare Pages Functions + D1).
Agent: Claude Code headless (`claude -p`, model default, `--strict-mcp-config`, only the shanhejian MCP server plus
WebFetch/WebSearch allowed). Runner: `node test/mcp-eval/run.mjs` (tasks in `tasks.json`).

## Protocol conformance — `node test/mcp-conformance.mjs`

38/38 checks pass against the live site: initialize + version negotiation, notifications → 202, GET → 405, batches,
unknown method / tool errors, `tools/list` schemas, every read tool, `add_*` with bad input (one error per field),
add → visible in `/api/contrib` → duplicate rejected → admin hide → gone → admin delete.

## Agent eval — 11 tasks

Main set (9 tasks: 4 read, 3 add event/poem, 1 add 说书, 1 browse-then-add):

- Task success rate: **9/9**
- First-try valid add rate: **5/5** add tasks; every `add_*` call valid on the first try (5/5)
- Tool calls per task: **3.7 MCP calls** (9 including web lookups for sources)
- Wall time: median **52 s**, mean 56.8 s (read tasks ~17 s, the 3-回 说书 212 s)
- Visible on the live site: **5/5** added items appeared in `/api/contrib` and on the map
- Cost: $3.09

Recovery set (2 tasks where the agent is handed flawed JSON — bad date, place name instead of id, non-https
source, 《》 in a poem title, swapped lon/lat):

- Task success rate: **2/2**
- Error-message recovery rate: **2/2** — each fixed every flagged field and succeeded on the second `add_*` call
- Tool calls per task: 4 MCP calls; wall time 30 s and 38 s
- Visible on the live site: **2/2**
- Cost: $0.44

Combined: 11/11 tasks, 7/7 additions live within seconds, no deploy. Live-map check in Chrome: the 赵州桥 event card,
the 《望庐山瀑布》 poem card (both with the 社区补充 badge via `?ev=`), and the 白江口 说书 in the 书目 list and
`shuoshu-text.html?c=`. All test rows were deleted afterwards.
