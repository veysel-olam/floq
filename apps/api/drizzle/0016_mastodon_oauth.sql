CREATE TABLE "masto_apps" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_id" text NOT NULL UNIQUE,
  "client_secret" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "website" varchar(2048),
  "redirect_uris" text NOT NULL,
  "scopes" varchar(500) NOT NULL DEFAULT 'read',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "masto_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL UNIQUE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "app_id" uuid REFERENCES "masto_apps"("id") ON DELETE cascade,
  "scopes" varchar(500) NOT NULL DEFAULT 'read',
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX "masto_tokens_user_idx" ON "masto_tokens" ("user_id");
CREATE INDEX "masto_tokens_token_idx" ON "masto_tokens" ("token");

CREATE TABLE "masto_auth_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE cascade,
  "app_id" uuid NOT NULL REFERENCES "masto_apps"("id") ON DELETE cascade,
  "redirect_uri" text NOT NULL,
  "scopes" varchar(500) NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
