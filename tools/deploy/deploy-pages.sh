#!/bin/bash
# Public deploy of 山河鉴 to Cloudflare Pages (project shanhejian, no login). Ships only the pages, js/, css/, data/
# (the same paths server.mjs serves) minus data/voice-spike and data/design-people; tools/ (6 GB of models) never leaves.
# Also ships the Pages Functions (functions/: /mcp, /api/contrib, /api/admin) with the modules they import (lib/, js/),
# and wrangler.toml binds the D1 database shanhejian-contrib as DB (schema: db/schema.sql). ADMIN_KEY is a Pages secret.
set -e
cd "$(dirname "$0")/../.."
ROOT="$(mktemp -d)"; OUT="$ROOT/site"; mkdir -p "$OUT"
cp index.html shuoshu.html shuoshu-list.html shuoshu-text.html xuanwumen.html mawei.html design-poem.html "$OUT/"
cp -R js css "$OUT/"
rsync -a --exclude voice-spike --exclude design-people --exclude .DS_Store data "$OUT/"
printf '/data/vendor/*\n  Cache-Control: public, max-age=31536000, immutable\n' > "$OUT/_headers"
# functions resolve ../js and ../lib from the project root, so both sit next to functions/ (outside the static output)
cp -R functions lib js "$ROOT/"
cat > "$ROOT/wrangler.toml" <<'TOML'
name = "shanhejian"
pages_build_output_dir = "site"
compatibility_date = "2026-11-01"

[[d1_databases]]
binding = "DB"
database_name = "shanhejian-contrib"
database_id = "6d56926e-b2a5-4474-8b29-8945dc78f850"
TOML
cd "$ROOT"
npx -y wrangler@4 pages deploy site --project-name shanhejian --branch main --commit-dirty=true
