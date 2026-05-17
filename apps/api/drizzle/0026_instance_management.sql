-- Federation health tracking on instances
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "delivery_failure_count" integer NOT NULL DEFAULT 0;
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "last_delivery_at" timestamp;
ALTER TABLE "instances" ADD COLUMN IF NOT EXISTS "last_delivery_success" boolean;

-- Instance settings (singleton)
CREATE TABLE IF NOT EXISTS "instance_settings" (
  "id" integer PRIMARY KEY DEFAULT 1,
  "registration_mode" varchar(20) NOT NULL DEFAULT 'open',
  "max_post_length" integer NOT NULL DEFAULT 500,
  "approval_note" text,
  "closed_reason" text,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
INSERT INTO "instance_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;

-- Instance rules
CREATE TABLE IF NOT EXISTS "instance_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "text" text NOT NULL,
  "hint" text,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Pending registrations (approval mode)
CREATE TABLE IF NOT EXISTS "pending_registrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(256) NOT NULL UNIQUE,
  "username" varchar(100) NOT NULL,
  "reason" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "review_note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "reviewed_at" timestamp
);
