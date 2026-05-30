-- ─────────────────────────────────────────────────────────────────────────────
-- extras.sql — schema objects that `drizzle-kit push` CANNOT manage
-- ─────────────────────────────────────────────────────────────────────────────
-- The prod schema is maintained with `drizzle-kit push` (schema.ts → DB). But
-- push only mirrors what's expressible in schema.ts. Generated (computed) columns
-- and GIN full-text indexes live ONLY here. Run this file after any fresh DB or
-- `DROP SCHEMA public` reset, AND after a push if you've changed FTS below.
--
-- Apply:  pnpm --filter @floq/api db:extras
--   (or)  docker compose -f docker-compose.prod.yml exec -T postgres \
--             psql -U floq -d floq < apps/api/drizzle/extras.sql
--
-- Every statement is idempotent (IF NOT EXISTS) — safe to run any number of times.
-- ─────────────────────────────────────────────────────────────────────────────

-- Full-text search: generated tsvector columns + GIN indexes.
-- (Was migration 0016_fts_search.sql; the journal is frozen at 0013 and push
--  can't express generated columns, so this is the canonical home.)

ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_search tsvector
  GENERATED ALWAYS AS (to_tsvector('turkish', coalesce(content, ''))) STORED;
CREATE INDEX IF NOT EXISTS posts_content_search_idx ON posts USING gin(content_search);

ALTER TABLE actors ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(handle, '') || ' ' || coalesce(display_name, ''))) STORED;
CREATE INDEX IF NOT EXISTS actors_search_vector_idx ON actors USING gin(search_vector);
