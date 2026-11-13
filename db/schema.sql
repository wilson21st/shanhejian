-- D1 database shanhejian-contrib (binding DB): contributions written through /mcp (functions/mcp.js).
-- One row per item; data is the normalised JSON the map reads (era.json event shape, poem event, or text 说书).
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('event', 'poem', 'shuoshu')),
  data TEXT NOT NULL,
  place TEXT,                 -- a new place {id,name,ll} the item introduced, or NULL
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL,      -- salted SHA-256 of the client IP, for rate limits only
  agent TEXT,                 -- clientInfo.name from initialize, if the client sent it
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS items_type ON items (type, hidden, created_at);
-- fixed-window counters: key = '<ip_hash>|h|<hour>' or '<ip_hash>|d|<day>'
CREATE TABLE IF NOT EXISTS hits (key TEXT PRIMARY KEY, n INTEGER NOT NULL, exp INTEGER NOT NULL);
