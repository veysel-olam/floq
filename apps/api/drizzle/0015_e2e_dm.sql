ALTER TABLE "actors" ADD COLUMN IF NOT EXISTS "dm_public_key" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "encrypted_content" text;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "encryption_iv" varchar(64);
