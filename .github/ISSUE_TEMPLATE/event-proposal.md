---
name: 补充史事 · Event proposal
about: Propose a historical event (581–763 CE) for the map. The add_event tool on the site fills this in for you.
title: "[event] "
labels: event-proposal
---

<!-- Fill in the JSON below (simplified Chinese). A bot validates it and opens a pull request.
     kind: mil 军事 / pol 政局 / dip 外交 / gov 治理 / cul 文化 / nat 天象灾异
     place: an existing place id (window.shanhejianMCP.list_events({places:true}) on the site) or {"name": "...", "ll": [lon, lat]}
     evidence.type: text / archaeology / inscription / artifact / art / foreign / modern -->

```json
{
 "title": "",
 "date": "0641-02",
 "kind": "dip",
 "summary": "",
 "place": {"name": "", "ll": [0, 0]},
 "who": [],
 "evidence": [{"type": "text", "title": "", "cite": "", "url": "https://", "quote": ""}]
}
```
