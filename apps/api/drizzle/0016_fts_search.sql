-- Full-text search columns (generated, stored) + GIN indexes
ALTER TABLE posts ADD COLUMN IF NOT EXISTS content_search tsvector GENERATED ALWAYS AS (
  to_tsvector('turkish', coalesce(content, ''))
) STORED;
CREATE INDEX IF NOT EXISTS posts_content_search_idx ON posts USING gin(content_search);

ALTER TABLE actors ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
  to_tsvector('simple', coalesce(handle, '') || ' ' || coalesce(display_name, ''))
) STORED;
CREATE INDEX IF NOT EXISTS actors_search_vector_idx ON actors USING gin(search_vector);
