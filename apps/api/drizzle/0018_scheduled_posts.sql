-- Scheduled posts: posts stored before their publish time
ALTER TABLE posts ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
CREATE INDEX IF NOT EXISTS posts_scheduled_at_idx ON posts(scheduled_at) WHERE scheduled_at IS NOT NULL;
