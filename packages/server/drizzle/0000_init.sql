CREATE TYPE "public"."member_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TYPE "public"."member_status" AS ENUM('active', 'pending', 'removed');--> statement-breakpoint
CREATE TABLE "matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"winner_id" integer NOT NULL,
	"loser_id" integer NOT NULL,
	"reported_by" integer NOT NULL,
	"winner_delta" integer NOT NULL,
	"loser_delta" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" integer,
	CONSTRAINT "matches_distinct_players" CHECK ("matches"."winner_id" <> "matches"."loser_id")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"status" "member_status" DEFAULT 'active' NOT NULL,
	"points" integer DEFAULT 1000 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"points_reached_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_id" text NOT NULL,
	"name" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_discord_id_unique" UNIQUE("discord_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"name_folded" text NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"owner_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_id_users_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_loser_id_users_id_fk" FOREIGN KEY ("loser_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "matches_workspace_created_idx" ON "matches" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "matches_workspace_winner_idx" ON "matches" USING btree ("workspace_id","winner_id","created_at");--> statement-breakpoint
CREATE INDEX "matches_workspace_loser_idx" ON "matches" USING btree ("workspace_id","loser_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_workspace_user_idx" ON "memberships" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "memberships_board_idx" ON "memberships" USING btree ("workspace_id","status","points");--> statement-breakpoint
CREATE INDEX "workspaces_name_folded_idx" ON "workspaces" USING btree ("name_folded");