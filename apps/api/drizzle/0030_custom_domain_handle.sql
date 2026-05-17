ALTER TABLE "actors" ADD COLUMN "custom_handle" varchar(253);
--> statement-breakpoint
ALTER TABLE "actors" ADD COLUMN "custom_handle_verified_at" timestamp;
--> statement-breakpoint
CREATE UNIQUE INDEX "actors_custom_handle_idx" ON "actors"("custom_handle") WHERE "custom_handle" IS NOT NULL;
