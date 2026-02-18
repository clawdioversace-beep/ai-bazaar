-- Custom migration: FTS5 full-text search index for the listings table
-- Source: https://www.sqlite.org/fts5.html (Section 4.4: External Content Tables)
--
-- NOTE: This migration must run AFTER 0000_groovy_leader.sql (the listings table creation).
-- The listings_fts virtual table is an external content table backed by `listings`.
-- Three triggers keep the FTS5 index in sync with the main table on INSERT/UPDATE/DELETE.
--
-- IMPORTANT: tags column in FTS5 receives the raw JSON string from the main table
-- (e.g. '["mcp-server","defi-tool"]'). The FTS5 tokenizer will index brackets and
-- quotes as tokens. For full-text search purposes this is acceptable — name/tagline/
-- description carry the primary relevance signal. Tag-specific filtering should use
-- exact JSON_EACH() or LIKE '%"tag-name"%' queries on the main listings.tags column,
-- not FTS5 MATCH queries.
--
-- To rebuild the entire index after bulk inserts that bypass triggers:
--   INSERT INTO listings_fts(listings_fts) VALUES('rebuild');

-- Create FTS5 virtual table backed by the listings table
CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
  name,
  tagline,
  description,
  tags,
  content='listings',
  content_rowid='rowid'
);

-- Populate the FTS5 index from any existing rows (safe to run on empty table)
INSERT INTO listings_fts(listings_fts) VALUES('rebuild');

-- INSERT trigger: sync new listings into the FTS5 index
CREATE TRIGGER IF NOT EXISTS listings_ai AFTER INSERT ON listings BEGIN
  INSERT INTO listings_fts(rowid, name, tagline, description, tags)
  VALUES (new.rowid, new.name, new.tagline, new.description, new.tags);
END;

-- DELETE trigger: remove deleted listings from the FTS5 index
CREATE TRIGGER IF NOT EXISTS listings_ad AFTER DELETE ON listings BEGIN
  INSERT INTO listings_fts(listings_fts, rowid, name, tagline, description, tags)
  VALUES ('delete', old.rowid, old.name, old.tagline, old.description, old.tags);
END;

-- UPDATE trigger: update FTS5 index when a listing changes (delete old entry, insert new)
CREATE TRIGGER IF NOT EXISTS listings_au AFTER UPDATE ON listings BEGIN
  INSERT INTO listings_fts(listings_fts, rowid, name, tagline, description, tags)
  VALUES ('delete', old.rowid, old.name, old.tagline, old.description, old.tags);
  INSERT INTO listings_fts(rowid, name, tagline, description, tags)
  VALUES (new.rowid, new.name, new.tagline, new.description, new.tags);
END;
