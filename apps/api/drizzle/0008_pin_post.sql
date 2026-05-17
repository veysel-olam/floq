ALTER TABLE "actors" ADD COLUMN "pinned_post_id" uuid REFERENCES "posts"("id") ON DELETE SET NULL;
CREATE INDEX "actors_pinned_post_idx" ON "actors" ("pinned_post_id");
