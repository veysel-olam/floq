ALTER TABLE "actors" ADD COLUMN IF NOT EXISTS "actor_type" varchar(20) NOT NULL DEFAULT 'Person';

CREATE TABLE IF NOT EXISTS "ap_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "owner_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "rules" text,
  "is_open" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);
