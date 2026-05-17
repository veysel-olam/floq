CREATE TABLE "polls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "post_id" uuid NOT NULL UNIQUE REFERENCES "posts"("id") ON DELETE CASCADE,
  "multiple_choice" boolean DEFAULT false NOT NULL,
  "voters_count" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "poll_options" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "poll_id" uuid NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
  "text" varchar(100) NOT NULL,
  "votes_count" integer DEFAULT 0 NOT NULL,
  "position" integer DEFAULT 0 NOT NULL
);

CREATE TABLE "poll_votes" (
  "poll_id" uuid NOT NULL REFERENCES "polls"("id") ON DELETE CASCADE,
  "option_id" uuid NOT NULL REFERENCES "poll_options"("id") ON DELETE CASCADE,
  "actor_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "poll_votes_option_actor_idx" UNIQUE ("option_id", "actor_id")
);

CREATE INDEX "polls_post_idx" ON "polls" ("post_id");
CREATE INDEX "poll_options_poll_idx" ON "poll_options" ("poll_id");
CREATE INDEX "poll_votes_poll_idx" ON "poll_votes" ("poll_id");
CREATE INDEX "poll_votes_actor_idx" ON "poll_votes" ("actor_id");
