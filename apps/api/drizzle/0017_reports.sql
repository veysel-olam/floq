-- Report reason enum
DO $$ BEGIN
  CREATE TYPE "report_reason" AS ENUM ('spam','harassment','hate_speech','misinformation','nsfw','violence','other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "report_status" AS ENUM ('pending','reviewed_accepted','reviewed_rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reports table
CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reporter_id" uuid NOT NULL REFERENCES "actors"("id") ON DELETE CASCADE,
  "post_id" uuid REFERENCES "posts"("id") ON DELETE CASCADE,
  "reported_actor_id" uuid REFERENCES "actors"("id") ON DELETE CASCADE,
  "reason" report_reason NOT NULL,
  "details" text,
  "status" report_status DEFAULT 'pending' NOT NULL,
  "reviewed_by" uuid REFERENCES "actors"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "review_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "reports_status_idx" ON "reports"("status");
CREATE INDEX IF NOT EXISTS "reports_post_idx" ON "reports"("post_id");
CREATE INDEX IF NOT EXISTS "reports_reporter_idx" ON "reports"("reporter_id");

-- isAdmin on actors
ALTER TABLE "actors" ADD COLUMN IF NOT EXISTS "is_admin" boolean DEFAULT false NOT NULL;
