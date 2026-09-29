import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { memberships, seasonStandings, seasons, users } from "../db/schema.js";
import { START_POINTS, tierSummary } from "../domain/rules.js";
import { AppError } from "../errors.js";
import { RANK_ORDER } from "./memberships.js";

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Db | Tx;

export async function currentSeason(db: Executor, workspaceId: number) {
  const [season] = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.workspaceId, workspaceId), isNull(seasons.endedAt)));
  if (!season) throw new AppError("NOT_FOUND", 404, "This workspace has no open season.");
  return season;
}

export async function startFirstSeason(tx: Tx, workspaceId: number, now: Date) {
  const [season] = await tx.insert(seasons).values({ workspaceId, number: 1, startedAt: now }).returning();
  return season!;
}

export async function listSeasons(db: Db, workspaceId: number) {
  return db
    .select({
      id: seasons.id,
      number: seasons.number,
      startedAt: seasons.startedAt,
      endedAt: seasons.endedAt,
    })
    .from(seasons)
    .where(eq(seasons.workspaceId, workspaceId))
    .orderBy(desc(seasons.number));
}

export async function seasonStandingsFor(db: Db, workspaceId: number, seasonId: number) {
  const [season] = await db
    .select()
    .from(seasons)
    .where(and(eq(seasons.id, seasonId), eq(seasons.workspaceId, workspaceId)));
  if (!season) throw new AppError("NOT_FOUND", 404, "Season not found.");
  if (!season.endedAt) {
    throw new AppError("VALIDATION", 400, "That season is still being played; read the board instead.");
  }

  const rows = await db
    .select({
      rank: seasonStandings.rank,
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      points: seasonStandings.points,
      wins: seasonStandings.wins,
      losses: seasonStandings.losses,
    })
    .from(seasonStandings)
    .innerJoin(users, eq(users.id, seasonStandings.userId))
    .where(eq(seasonStandings.seasonId, seasonId))
    .orderBy(asc(seasonStandings.rank));

  return {
    season: { id: season.id, number: season.number, startedAt: season.startedAt, endedAt: season.endedAt },
    players: rows.map((row) => ({ ...row, tier: tierSummary(row.points) })),
  };
}

/**
 * Closes the season and opens the next one. Matches are left alone: they carry the season
 * they were played in, so the history survives, and only the standings are frozen, because
 * the points they were computed from are about to be overwritten.
 */
export async function resetSeason(db: Db, input: { workspaceId: number; actorId: number; now?: Date }) {
  const { workspaceId, actorId, now = new Date() } = input;

  return db.transaction(async (tx) => {
    const season = await currentSeason(tx, workspaceId);

    const table = await tx
      .select({
        userId: memberships.userId,
        points: memberships.points,
        wins: memberships.wins,
        losses: memberships.losses,
      })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.status, "active")))
      .orderBy(...RANK_ORDER)
      .for("update", { of: memberships });

    if (table.length > 0) {
      await tx.insert(seasonStandings).values(
        table.map((row, index) => ({
          seasonId: season.id,
          userId: row.userId,
          rank: index + 1,
          points: row.points,
          wins: row.wins,
          losses: row.losses,
        })),
      );
    }

    await tx.update(seasons).set({ endedAt: now, closedBy: actorId }).where(eq(seasons.id, season.id));

    const [next] = await tx
      .insert(seasons)
      .values({ workspaceId, number: season.number + 1, startedAt: now })
      .returning();

    // Everyone starts level again, including members who are pending or were removed:
    // leaving the old points on a removed row would bring them back on re-approval.
    await tx
      .update(memberships)
      .set({ points: START_POINTS, wins: 0, losses: 0, pointsReachedAt: now })
      .where(eq(memberships.workspaceId, workspaceId));

    return { closed: season, started: next! };
  });
}
