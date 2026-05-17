ALTER TABLE "actors" ADD COLUMN IF NOT EXISTS "nostr_public_key" varchar(64);
ALTER TABLE "actors" ADD COLUMN IF NOT EXISTS "nostr_private_key_encrypted" text;
