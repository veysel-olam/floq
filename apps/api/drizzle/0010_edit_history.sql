CREATE TABLE "post_edits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "content_warning" varchar(500),
  "edited_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "post_edits_post_idx" ON "post_edits" ("post_id");
