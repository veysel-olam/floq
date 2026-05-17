CREATE TABLE IF NOT EXISTS "relays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "inbox_url" varchar(512) NOT NULL UNIQUE,
  "actor_url" varchar(512) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now()
);
