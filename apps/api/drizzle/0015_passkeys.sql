CREATE TABLE "passkeys" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "name" varchar(255) NOT NULL DEFAULT 'Passkey',
  "public_key" text NOT NULL,
  "counter" integer NOT NULL DEFAULT 0,
  "device_type" varchar(32),
  "backed_up" boolean NOT NULL DEFAULT false,
  "transports" text[],
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_used_at" timestamp
);
CREATE INDEX "passkeys_user_idx" ON "passkeys" ("user_id");
