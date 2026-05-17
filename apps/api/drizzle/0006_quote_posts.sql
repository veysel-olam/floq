ALTER TABLE "posts" ADD COLUMN "quoted_post_id" uuid REFERENCES "posts"("id") ON DELETE SET NULL;
ALTER TABLE "posts" ADD COLUMN "quotes_count" integer DEFAULT 0 NOT NULL;
CREATE INDEX "posts_quoted_post_idx" ON "posts" ("quoted_post_id");
