CREATE TABLE "hashtag_follows" (
  "actor_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "hashtag" varchar(100) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  PRIMARY KEY ("actor_id", "hashtag")
);
--> statement-breakpoint
CREATE INDEX "hashtag_follows_actor_idx" ON "hashtag_follows"("actor_id");
--> statement-breakpoint
CREATE INDEX "hashtag_follows_hashtag_idx" ON "hashtag_follows"("hashtag");
