import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { START_POINTS } from "../domain/rules.js";

export const memberRole = pgEnum("member_role", ["owner", "member"]);
export const memberStatus = pgEnum("member_status", ["active", "pending", "removed"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  discordId: text("discord_id").notNull().unique(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaces = pgTable(
  "workspaces",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    nameFolded: text("name_folded").notNull(),
    tournamentName: text("tournament_name"),
    isPublic: boolean("is_public").notNull().default(true),
    ownerId: integer("owner_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("workspaces_name_folded_idx").on(t.nameFolded)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull().default("member"),
    status: memberStatus("status").notNull().default("active"),
    points: integer("points").notNull().default(START_POINTS),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    pointsReachedAt: timestamp("points_reached_at", { withTimezone: true }).notNull().defaultNow(),
    /** Who removed this member. null means they left on their own. */
    removedBy: integer("removed_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Better a failed transaction than a silently wrong counter.
    check("memberships_counts_not_negative", sql`${t.wins} >= 0 and ${t.losses} >= 0`),
    uniqueIndex("memberships_workspace_user_idx").on(t.workspaceId, t.userId),
    index("memberships_board_idx").on(t.workspaceId, t.status, t.points),
  ],
);

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    winnerId: integer("winner_id")
      .notNull()
      .references(() => users.id),
    loserId: integer("loser_id")
      .notNull()
      .references(() => users.id),
    reportedBy: integer("reported_by")
      .notNull()
      .references(() => users.id),
    // Store the points actually applied so deleting a match refunds exactly, even after the rules change.
    winnerDelta: integer("winner_delta").notNull(),
    loserDelta: integer("loser_delta").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => users.id),
  },
  (t) => [
    check("matches_distinct_players", sql`${t.winnerId} <> ${t.loserId}`),
    index("matches_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("matches_workspace_winner_idx").on(t.workspaceId, t.winnerId, t.createdAt),
    index("matches_workspace_loser_idx").on(t.workspaceId, t.loserId, t.createdAt),
  ],
);
