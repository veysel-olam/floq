ALTER TABLE "actors" ADD COLUMN "moved_to_uri" varchar(2048);--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "also_known_as" text[];--> statement-breakpoint
ALTER TABLE "instances" ADD COLUMN "suspended_at" timestamp;