import { and, count, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { matches, memberships, users, workspaces } from "../db/schema.js";
import {
  DAILY_LIMIT_PER_PAIR,
  LOSS_POINTS,
  START_POINTS,
  WIN_POINTS,
  tierLadder,
  tierSummary,
} from "../domain/rules.js";
import { AppError } from "../errors.js";
import { RANK_ORDER, requireMember } from "./memberships.js";
import { matchesToday, remainingTodayByOpponent } from "./matches.js";

export async function getBoard(db: Db, input: { workspaceId: number; userId: number; now: Date }) {
  const { workspaceId, userId, now } = input;
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws) throw new AppError("WORKSPACE_NOT_FOUND", 404, "Không tìm thấy workspace.");
  const me = await requireMember(db, workspaceId, userId);

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
      points: memberships.points,
      wins: memberships.wins,
      losses: memberships.losses,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.status, "active")))
    .orderBy(...RANK_ORDER);

  const lastPlayed = new Map<number, string>();
  const lastRows = await db.execute<{ user_id: number; last_at: Date }>(sql`
    select user_id, max(created_at) as last_at from (
      select ${matches.winnerId} as user_id, ${matches.createdAt} as created_at
        from ${matches} where ${matches.workspaceId} = ${workspaceId} and ${matches.deletedAt} is null
      union all
      select ${matches.loserId} as user_id, ${matches.createdAt} as created_at
        from ${matches} where ${matches.workspaceId} = ${workspaceId} and ${matches.deletedAt} is null
    ) t group by user_id
  `);
  for (const row of lastRows.rows) lastPlayed.set(Number(row.user_id), new Date(row.last_at).toISOString());

  const remaining = await remainingTodayByOpponent(db, workspaceId, userId, now);
  const players = rows.map((r, i) => ({
    rank: i + 1,
    ...r,
    tier: tierSummary(r.points),
    lastMatchAt: lastPlayed.get(r.id) ?? null,
    remainingWithMe: r.id === userId ? 0 : (remaining.get(r.id) ?? DAILY_LIMIT_PER_PAIR),
  }));
  const mine = players.find((p) => p.id === userId)!;
  const [pending] = await db
    .select({ n: count() })
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.status, "pending")));

  return {
    workspace: { id: ws.id, name: ws.name, isPublic: ws.isPublic, memberCount: players.length },
    rules: {
      startPoints: START_POINTS,
      winPoints: WIN_POINTS,
      lossPoints: LOSS_POINTS,
      dailyLimitPerPair: DAILY_LIMIT_PER_PAIR,
      tiers: tierLadder(),
    },
    me: {
      id: userId,
      name: mine.name,
      avatarUrl: mine.avatarUrl,
      points: mine.points,
      wins: mine.wins,
      losses: mine.losses,
      rank: mine.rank,
      tier: mine.tier,
      role: me.role,
      matchesToday: await matchesToday(db, workspaceId, userId, now),
      dailyLimitPerPair: DAILY_LIMIT_PER_PAIR,
      winPoints: WIN_POINTS,
      lossPoints: LOSS_POINTS,
      pendingCount: me.role === "owner" ? (pending?.n ?? 0) : 0,
    },
    players,
  };
}
