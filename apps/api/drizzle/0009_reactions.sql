CREATE TABLE "reactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "post_id" uuid NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "emoji" varchar(16) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "reactions_triple_idx" ON "reactions" ("actor_id", "post_id", "emoji");
CREATE INDEX "reactions_post_idx" ON "reactions" ("post_id");
CREATE INDEX "reactions_actor_idx" ON "reactions" ("actor_id");
