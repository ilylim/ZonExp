ALTER TABLE "quest_sessions" ADD COLUMN "initial_distance_meters" integer;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "location" geometry NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "quests" DROP COLUMN "longitude";