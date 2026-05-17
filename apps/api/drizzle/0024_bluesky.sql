CREATE TABLE IF NOT EXISTS "bluesky_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL UNIQUE,
  "did" varchar(256) NOT NULL,
  "handle" varchar(256) NOT NULL,
  "access_jwt" text NOT NULL,
  "refresh_jwt" text NOT NULL,
  "crosspost_enabled" boolean NOT NULL DEFAULT true,
  "import_enabled" boolean NOT NULL DEFAULT false,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
