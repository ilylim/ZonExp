ALTER TABLE "quests" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "territories" ADD COLUMN "h3_cache" text[];--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_created_by_users_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;