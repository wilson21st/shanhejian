#!/bin/bash
# Public deploy of 山河鉴 to Cloudflare Pages (project shanhejian, no login). Ships only the pages, js/, css/, data/
# (the same paths server.mjs serves) minus data/voice-spike and data/design-people; tools/ (6 GB of models) never leaves.
set -e
cd "$(dirname "$0")/../.."
OUT="$(mktemp -d)/site"; mkdir -p "$OUT"
cp index.html shuoshu.html shuoshu-list.html xuanwumen.html mawei.html design-poem.html "$OUT/"
cp -R js css "$OUT/"
rsync -a --exclude voice-spike --exclude design-people --exclude .DS_Store data "$OUT/"
printf '/data/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n' > "$OUT/_headers"
cd "$(dirname "$OUT")"
npx -y wrangler@4 pages deploy site --project-name shanhejian --branch main --commit-dirty=true
