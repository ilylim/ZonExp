CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TYPE "public"."quest_intensity" AS ENUM('light', 'moderate', 'hard');--> statement-breakpoint
CREATE TYPE "public"."quest_session_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."quest_type" AS ENUM('walk', 'run', 'mixed');--> statement-breakpoint
CREATE TABLE "achievements" (
	"achievement_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"awarded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"user_id" text PRIMARY KEY NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"completed_quests" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"quest_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"status" "quest_session_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"quest_id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"intensity" "quest_intensity" NOT NULL,
	"quest_type" "quest_type" NOT NULL,
	"xp_reward" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"territory_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"boundary_geojson" jsonb NOT NULL,
	"total_cells" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_exploration_cells" (
	"user_id" text NOT NULL,
	"h3_index" text NOT NULL,
	"discovered_at" timestamp DEFAULT now() NOT NULL,
	"territory_id" text NOT NULL,
	CONSTRAINT "user_exploration_cells_user_id_h3_index_pk" PRIMARY KEY("user_id","h3_index")
);
--> statement-breakpoint
CREATE TABLE "user_territory_stats" (
	"user_id" text NOT NULL,
	"territory_id" text NOT NULL,
	"opened_cells_count" integer DEFAULT 0 NOT NULL,
	"last_visit_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_territory_stats_user_id_territory_id_pk" PRIMARY KEY("user_id","territory_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"user_id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_active_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_sessions" ADD CONSTRAINT "quest_sessions_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_sessions" ADD CONSTRAINT "quest_sessions_quest_id_quests_quest_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("quest_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exploration_cells" ADD CONSTRAINT "user_exploration_cells_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_exploration_cells" ADD CONSTRAINT "user_exploration_cells_territory_id_territories_territory_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("territory_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_stats" ADD CONSTRAINT "user_territory_stats_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_territory_stats" ADD CONSTRAINT "user_territory_stats_territory_id_territories_territory_id_fk" FOREIGN KEY ("territory_id") REFERENCES "public"."territories"("territory_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD COLUMN "boundary_polygon" geometry(Polygon,4326);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "territories_boundary_gix" ON "territories" USING gist ("boundary_polygon");