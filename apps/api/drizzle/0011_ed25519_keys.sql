ALTER TABLE "actors"
  ADD COLUMN "ed25519_public_key" text,
  ADD COLUMN "ed25519_private_key_encrypted" text;
