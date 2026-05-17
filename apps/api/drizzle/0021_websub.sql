CREATE TABLE IF NOT EXISTS "websub_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic" varchar(512) NOT NULL,
  "callback" varchar(512) NOT NULL,
  "secret" varchar(256),
  "expires_at" timestamp,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("topic", "callback")
);
