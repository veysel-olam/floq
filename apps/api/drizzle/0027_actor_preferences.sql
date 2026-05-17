CREATE TABLE "actor_preferences" (
  "actor_id"              uuid PRIMARY KEY REFERENCES "actors"("id") ON DELETE CASCADE,
  "dm_enabled"            boolean NOT NULL DEFAULT true,
  "allow_reply_from"      varchar(20) NOT NULL DEFAULT 'everyone',
  "hide_likes_count"      boolean NOT NULL DEFAULT false,
  "hide_read_receipts"    boolean NOT NULL DEFAULT false,
  "default_visibility"    varchar(20) NOT NULL DEFAULT 'public',
  "filter_bots"           boolean NOT NULL DEFAULT false,
  "hide_boosts"           boolean NOT NULL DEFAULT false,
  "min_account_age_filter" integer NOT NULL DEFAULT 0,
  "nsfw_mode"             varchar(20) NOT NULL DEFAULT 'blur',
  "preferred_languages"   varchar(10)[] NOT NULL DEFAULT '{}',
  "hide_short_videos"     boolean NOT NULL DEFAULT false,
  "usage_time_limit"      integer NOT NULL DEFAULT 0,
  "updated_at"            timestamp NOT NULL DEFAULT now()
);
