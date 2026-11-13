# 山河鉴 · Shanhejian

A history explorer: a 3D painted map of China lying as a scroll on a Song-dynasty desk, with a timeline of events,
people's journeys, recited Tang poems and 说书 (storyteller) scrolls.

**Live:** https://shanhejian.pages.dev

- Plain ES modules, no build step, zero npm packages. three.js and the LXGW WenKai webfont are vendored in `data/vendor/`.
- Run locally: `node server.mjs` → http://127.0.0.1:7814 (`HS_PORT` to change).
- Deploy: `tools/deploy/deploy-pages.sh` (Cloudflare Pages).

Code: MIT (see `LICENSE`). Fonts: SIL OFL 1.1. Images: public domain / CC, credited in `data/**/CREDITS.md`.
The background music the live site plays is not included in this repository (not free-licensed).
