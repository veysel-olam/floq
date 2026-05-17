-- Flow subscriptions
CREATE TABLE IF NOT EXISTS "flow_subscriptions" (
  "flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
  "actor_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_subscriptions_pair_idx" ON "flow_subscriptions"("flow_id","actor_id");
CREATE INDEX IF NOT EXISTS "flow_subscriptions_actor_idx" ON "flow_subscriptions"("actor_id");

-- Flow pinned posts
CREATE TABLE IF NOT EXISTS "flow_pinned_posts" (
  "flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "pinned_by" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "pinned_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_pinned_posts_pair_idx" ON "flow_pinned_posts"("flow_id","post_id");

-- Flow invites
CREATE TABLE IF NOT EXISTS "flow_invites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "flow_id" uuid NOT NULL REFERENCES "flows"("id") ON DELETE CASCADE,
  "code" varchar(16) NOT NULL,
  "created_by" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "max_uses" integer DEFAULT 100 NOT NULL,
  "used_count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_invites_code_idx" ON "flow_invites"("code");
CREATE INDEX IF NOT EXISTS "flow_invites_flow_idx" ON "flow_invites"("flow_id");

-- Add flow_post to notification type enum
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'flow_post';
