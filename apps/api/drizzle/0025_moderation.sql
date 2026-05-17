CREATE TABLE IF NOT EXISTS "block_lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(200) NOT NULL,
  "url" varchar(512) NOT NULL UNIQUE,
  "enabled" boolean NOT NULL DEFAULT true,
  "last_fetched_at" timestamp,
  "entries_count" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "block_list_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "list_id" uuid NOT NULL REFERENCES "block_lists"("id") ON DELETE CASCADE,
  "domain" varchar(256) NOT NULL,
  "severity" varchar(20) NOT NULL DEFAULT 'suspend',
  "comment" text,
  UNIQUE ("list_id", "domain")
);

CREATE TABLE IF NOT EXISTS "content_labels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "post_id" uuid REFERENCES "posts"("id") ON DELETE CASCADE,
  "actor_id" uuid REFERENCES "actors"("id") ON DELETE CASCADE,
  "label" varchar(64) NOT NULL,
  "source" varchar(50) NOT NULL DEFAULT 'system',
  "labeler_url" varchar(512),
  "confidence" integer NOT NULL DEFAULT 100,
  "created_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "moderation_appeals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL UNIQUE REFERENCES "reports"("id") ON DELETE CASCADE,
  "appellant_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "reviewed_by" uuid REFERENCES "actors"("id") ON DELETE SET NULL,
  "review_note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "reviewed_at" timestamp
);
