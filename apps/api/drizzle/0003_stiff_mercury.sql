ALTER TABLE "posts" ADD COLUMN "recipient_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_recipient_id_actors_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."actors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_recipient_idx" ON "posts" USING btree ("recipient_id");