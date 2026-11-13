#!/usr/bin/env node
// 说书 engine: build story scripts (tools/shuoshu/<id>.mjs, clip DSL in tools/shuoshu/dsl.mjs) → data/shuoshu/<id>/story.json
// and the 书目 catalogue data/shuoshu/stories.json. Then render audio: node gen-shuoshu-audio.mjs <id>
//   node tools/shuoshu-script.mjs [id ...]      (no id = every story)
import { readdirSync } from 'node:fs';
import { build } from './shuoshu/dsl.mjs';
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(new URL('./shuoshu/', import.meta.url)).filter(f => /^[a-z]+\.mjs$/.test(f) && f !== 'dsl.mjs').map(f => f.slice(0, -4));
for (const id of ids) {
  const st = (await import(`./shuoshu/${id}.mjs`)).default;
  console.log(id, JSON.stringify(build(st)));
}
