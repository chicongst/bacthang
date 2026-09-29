CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"number" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"closed_by" integer
);
--> statement-breakpoint
CREATE TABLE "season_standings" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"rank" integer NOT NULL,
	"points" integer NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "season_standings" ADD CONSTRAINT "season_standings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_workspace_number_idx" ON "seasons" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE INDEX "seasons_workspace_ended_idx" ON "seasons" USING btree ("workspace_id","ended_at");--> statement-breakpoint
CREATE UNIQUE INDEX "season_standings_season_user_idx" ON "season_standings" USING btree ("season_id","user_id");--> statement-breakpoint
INSERT INTO "seasons" ("workspace_id", "number", "started_at")
	SELECT "id", 1, "created_at" FROM "workspaces";--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "season_id" integer;--> statement-breakpoint
UPDATE "matches" SET "season_id" = "seasons"."id"
	FROM "seasons"
	WHERE "seasons"."workspace_id" = "matches"."workspace_id" AND "seasons"."ended_at" IS NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "season_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_season_idx" ON "matches" USING btree ("season_id");
