-- Bookmark Collections
CREATE TABLE bookmark_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX bookmark_collections_actor_idx ON bookmark_collections(actor_id);

-- Add collection_id to bookmarks
ALTER TABLE bookmarks ADD COLUMN collection_id UUID REFERENCES bookmark_collections(id) ON DELETE SET NULL;

CREATE INDEX bookmarks_collection_idx ON bookmarks(collection_id);
