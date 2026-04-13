CREATE TABLE "user_quest_assignments" (
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"route_color_index" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "user_quest_assignments_user_id_quest_id_pk" PRIMARY KEY("user_id","quest_id")
);
--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "latitude" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "longitude" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "quests" ADD COLUMN "route_description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_quest_assignments" ADD CONSTRAINT "user_quest_assignments_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quest_assignments" ADD CONSTRAINT "user_quest_assignments_quest_id_quests_quest_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("quest_id") ON DELETE cascade ON UPDATE no action;