-- skills.sh leaderboard cache table
-- Stores scraped data from skills.sh (Vercel Labs agent skills marketplace)
-- Separate from the OpenClaw `skills` table — different data source and schema.
CREATE TABLE IF NOT EXISTS skills_sh (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
  name TEXT NOT NULL UNIQUE,
  source_repo TEXT NOT NULL,
  description TEXT,
  install_count INTEGER DEFAULT 0,
  all_time_rank INTEGER,
  trending_rank INTEGER,
  install_cmd TEXT,
  scraped_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS skills_sh_all_time_rank ON skills_sh(all_time_rank);
CREATE INDEX IF NOT EXISTS skills_sh_trending_rank ON skills_sh(trending_rank);
