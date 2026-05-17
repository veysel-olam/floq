CREATE TABLE "custom_emojis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "shortcode" varchar(64) NOT NULL,
  "domain" varchar(253),
  "image_url" text NOT NULL,
  "ap_id" text,
  "visible_in_picker" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "custom_emojis_shortcode_domain_idx" ON "custom_emojis" ("shortcode", "domain");
CREATE INDEX "custom_emojis_domain_idx" ON "custom_emojis" ("domain");
