-- Manual migration: Starter packs tables for Phase 6
-- Creates starter_packs table and pack_tools junction table for M:N relationship

CREATE TABLE IF NOT EXISTS starter_packs (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pack_tools (
  pack_id TEXT NOT NULL REFERENCES starter_packs(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  narrative TEXT NOT NULL,
  PRIMARY KEY (pack_id, tool_id)
);

-- Indexes for join performance
CREATE INDEX IF NOT EXISTS idx_pack_tools_pack_id ON pack_tools(pack_id);
CREATE INDEX IF NOT EXISTS idx_pack_tools_tool_id ON pack_tools(tool_id);
