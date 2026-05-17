-- visibility enum value ('close_friends') is added at API startup outside any transaction.
-- This file only handles the table + indexes, which are safe inside a transaction.

CREATE TABLE close_friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX close_friends_pair_idx ON close_friends(actor_id, target_id);
CREATE INDEX close_friends_actor_idx ON close_friends(actor_id);
CREATE INDEX close_friends_target_idx ON close_friends(target_id);
