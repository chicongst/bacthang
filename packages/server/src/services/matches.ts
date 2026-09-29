import { and, asc, count, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/client.js";
import { matches, memberships, users } from "../db/schema.js";
import { DAILY_LIMIT_PER_PAIR, LOSS_POINTS, WIN_POINTS, vnDayRange } from "../domain/rules.js";
import { AppError } from "../errors.js";
import { currentSeason } from "./seasons.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Db | Tx;

/** Display only. The number that actually blocks a match is matchesTodayBetween. */
export async function matchesToday(db: Executor, workspaceId: number, userId: number, now: Date): Promise<number> {
  const { start, end } = vnDayRange(now);
  const [row] = await db
    .select({ n: count() })
    .from(matches)
    .where(
      and(
        eq(matches.workspaceId, workspaceId),
        isNull(matches.deletedAt),
        gte(matches.createdAt, start),
        lt(matches.createdAt, end),
        or(eq(matches.winnerId, userId), eq(matches.loserId, userId)),
      ),
    );
  return row?.n ?? 0;
}

/** Counts both directions: A beating B and B beating A are the same pair. */
export async function matchesTodayBetween(
  db: Executor,
  workspaceId: number,
  a: number,
  b: number,
  now: Date,
): Promise<number> {
  const { start, end } = vnDayRange(now);
  const [row] = await db
    .select({ n: count() })
    .from(matches)
    .where(
      and(
        eq(matches.workspaceId, workspaceId),
        isNull(matches.deletedAt),
        gte(matches.createdAt, start),
        lt(matches.createdAt, end),
        or(
          and(eq(matches.winnerId, a), eq(matches.loserId, b)),
          and(eq(matches.winnerId, b), eq(matches.loserId, a)),
        ),
      ),
    );
  return row?.n ?? 0;
}

/** One query for every opponent: asking per person turns into N+1 on the hottest path. */
export async function remainingTodayByOpponent(
  db: Executor,
  workspaceId: number,
  userId: number,
  now: Date,
): Promise<Map<number, number>> {
  const { start, end } = vnDayRange(now);
  // Group by column ordinal: drizzle qualifies column names in GROUP BY but not in SELECT,
  // so repeating the expression makes Postgres see two different expressions.
  const opponentId = sql<number>`case when ${matches.winnerId} = ${userId} then ${matches.loserId} else ${matches.winnerId} end`;
  const rows = await db
    .select({ opponentId, played: count() })
    .from(matches)
    .where(
      and(
        eq(matches.workspaceId, workspaceId),
        isNull(matches.deletedAt),
        gte(matches.createdAt, start),
        lt(matches.createdAt, end),
        or(eq(matches.winnerId, userId), eq(matches.loserId, userId)),
      ),
    )
    .groupBy(sql`1`);

  const remaining = new Map<number, number>();
  for (const row of rows) {
    remaining.set(Number(row.opponentId), Math.max(0, DAILY_LIMIT_PER_PAIR - row.played));
  }
  return remaining;
}

// Always lock in ascending user id order so two crossing transactions cannot deadlock.
async function lockMembers(tx: Tx, workspaceId: number, userIds: number[]) {
  return tx
    .select({ userId: memberships.userId, status: memberships.status, name: users.name })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), inArray(memberships.userId, userIds)))
    .orderBy(asc(memberships.userId))
    .for("update", { of: memberships });
}

export interface RecordMatchInput {
  workspaceId: number;
  reporterId: number;
  opponentId: number;
  result: "win" | "loss";
  now?: Date;
}

export async function recordMatch(db: Db, input: RecordMatchInput) {
  const { workspaceId, reporterId, opponentId, result, now = new Date() } = input;
  if (reporterId === opponentId) {
    throw new AppError("SELF_MATCH", 400, "You cannot record a match against yourself.");
  }

  return db.transaction(async (tx) => {
    const locked = await lockMembers(tx, workspaceId, [reporterId, opponentId]);
    const reporter = locked.find((m) => m.userId === reporterId);
    if (!reporter || reporter.status !== "active") {
      throw new AppError("NOT_MEMBER", 403, "You are no longer in this workspace.");
    }
    const opponent = locked.find((m) => m.userId === opponentId);
    if (!opponent || opponent.status !== "active") {
      throw new AppError("OPPONENT_NOT_FOUND", 404, "That opponent is no longer in this workspace.");
    }

    // Count after taking the lock, otherwise two parallel requests both slip through.
    if ((await matchesTodayBetween(tx, workspaceId, reporterId, opponentId, now)) >= DAILY_LIMIT_PER_PAIR) {
      throw new AppError(
        "DAILY_LIMIT_REACHED",
        409,
        `You and ${opponent.name} have played all ${DAILY_LIMIT_PER_PAIR} matches today. You can still play anyone else.`,
      );
    }

    const winnerId = result === "win" ? reporterId : opponentId;
    const loserId = result === "win" ? opponentId : reporterId;

    const season = await currentSeason(tx, workspaceId);
    const [match] = await tx
      .insert(matches)
      .values({
        workspaceId,
        seasonId: season.id,
        winnerId,
        loserId,
        reportedBy: reporterId,
        winnerDelta: WIN_POINTS,
        loserDelta: LOSS_POINTS,
        createdAt: now,
      })
      .returning();

    await applyPoints(tx, workspaceId, winnerId, WIN_POINTS, "win", now);
    await applyPoints(tx, workspaceId, loserId, LOSS_POINTS, "loss", now);

    return match!;
  });
}

async function applyPoints(tx: Tx, workspaceId: number, userId: number, delta: number, kind: "win" | "loss", now: Date) {
  await tx
    .update(memberships)
    .set({
      points: sql`${memberships.points} + ${delta}`,
      ...(kind === "win" ? { wins: sql`${memberships.wins} + 1` } : { losses: sql`${memberships.losses} + 1` }),
      pointsReachedAt: now,
    })
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
}

export async function deleteMatch(db: Db, input: { workspaceId: number; matchId: number; deletedBy: number; now?: Date }) {
  const { workspaceId, matchId, deletedBy, now = new Date() } = input;

  return db.transaction(async (tx) => {
    const [match] = await tx
      .select()
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.workspaceId, workspaceId), isNull(matches.deletedAt)))
      .for("update");
    if (!match) throw new AppError("NOT_FOUND", 404, "Match not found, or it was already deleted.");

    // Undoing a match returns points to the memberships, and those were reset when the
    // season closed. Refunding across that line would hand out points from a season that
    // is already in the books.
    const season = await currentSeason(tx, workspaceId);
    if (match.seasonId !== season.id) {
      throw new AppError("VALIDATION", 400, "That match belongs to a season that has already ended.");
    }

    await lockMembers(tx, workspaceId, [match.winnerId, match.loserId]);

    await tx
      .update(memberships)
      .set({
        points: sql`${memberships.points} - ${match.winnerDelta}`,
        wins: sql`${memberships.wins} - 1`,
        pointsReachedAt: now,
      })
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, match.winnerId)));
    await tx
      .update(memberships)
      .set({
        points: sql`${memberships.points} - ${match.loserDelta}`,
        losses: sql`${memberships.losses} - 1`,
        pointsReachedAt: now,
      })
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, match.loserId)));

    await tx.update(matches).set({ deletedAt: now, deletedBy }).where(eq(matches.id, matchId));
  });
}

const winner = alias(users, "winner");
const loser = alias(users, "loser");
const reporter = alias(users, "reporter");

export async function recentMatches(db: Db, workspaceId: number, seasonId: number, limit: number) {
  return db
    .select({
      id: matches.id,
      createdAt: matches.createdAt,
      winnerDelta: matches.winnerDelta,
      loserDelta: matches.loserDelta,
      winner: { id: winner.id, name: winner.name, avatarUrl: winner.avatarUrl },
      loser: { id: loser.id, name: loser.name, avatarUrl: loser.avatarUrl },
      reportedBy: { id: reporter.id, name: reporter.name },
    })
    .from(matches)
    .innerJoin(winner, eq(winner.id, matches.winnerId))
    .innerJoin(loser, eq(loser.id, matches.loserId))
    .innerJoin(reporter, eq(reporter.id, matches.reportedBy))
    .where(and(eq(matches.workspaceId, workspaceId), eq(matches.seasonId, seasonId), isNull(matches.deletedAt)))
    .orderBy(desc(matches.createdAt), desc(matches.id))
    .limit(limit);
}
