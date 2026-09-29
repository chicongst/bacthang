import { and, asc, count, desc, eq, ilike, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { matches, memberships, users, workspaces } from "../db/schema.js";
import {
  DAILY_LIMIT_PER_PAIR,
  LOSS_POINTS,
  MAX_WORKSPACES_PER_OWNER,
  START_POINTS,
  WIN_POINTS,
  WORKSPACE_NAME_MAX,
  WORKSPACE_NAME_MIN,
  tierFor,
  tierLadder,
} from "../domain/rules.js";
import { fold } from "../domain/text.js";
import { AppError } from "../errors.js";
import { matchesToday, remainingTodayByOpponent } from "./matches.js";

const tierDto = (points: number) => {
  const { id, name } = tierFor(points);
  return { id, name };
};

const RANK_ORDER = [desc(memberships.points), asc(memberships.pointsReachedAt), asc(memberships.userId)];

export type Membership = typeof memberships.$inferSelect;

export async function requireMember(db: Db, workspaceId: number, userId: number): Promise<Membership> {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
  if (!m || m.status === "removed") {
    throw new AppError("NOT_MEMBER", 403, "Bạn không ở trong workspace này.");
  }
  if (m.status === "pending") {
    throw new AppError("PENDING_APPROVAL", 403, "Yêu cầu tham gia của bạn đang chờ chủ workspace duyệt.");
  }
  return m;
}

export async function requireOwner(db: Db, workspaceId: number, userId: number, isServerAdmin: boolean) {
  if (isServerAdmin) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    if (!ws) throw new AppError("WORKSPACE_NOT_FOUND", 404, "Không tìm thấy workspace.");
    return;
  }
  const m = await requireMember(db, workspaceId, userId);
  if (m.role !== "owner") {
    throw new AppError("FORBIDDEN", 403, "Chỉ chủ workspace mới làm được việc này.");
  }
}

function workspaceName(raw: string): string {
  const name = raw.trim();
  if (name.length < WORKSPACE_NAME_MIN || name.length > WORKSPACE_NAME_MAX) {
    throw new AppError(
      "VALIDATION",
      400,
      `Tên workspace cần từ ${WORKSPACE_NAME_MIN} đến ${WORKSPACE_NAME_MAX} ký tự.`,
    );
  }
  return name;
}

export async function createWorkspace(db: Db, input: { name: string; isPublic: boolean; ownerId: number; now?: Date }) {
  const name = workspaceName(input.name);
  const now = input.now ?? new Date();

  const [owned] = await db
    .select({ n: count() })
    .from(workspaces)
    .where(eq(workspaces.ownerId, input.ownerId));
  if ((owned?.n ?? 0) >= MAX_WORKSPACES_PER_OWNER) {
    throw new AppError("VALIDATION", 400, `Mỗi người chỉ tạo được tối đa ${MAX_WORKSPACES_PER_OWNER} workspace.`);
  }

  return db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspaces)
      .values({ name, nameFolded: fold(name), isPublic: input.isPublic, ownerId: input.ownerId, createdAt: now })
      .returning();
    await tx.insert(memberships).values({
      workspaceId: ws!.id,
      userId: input.ownerId,
      role: "owner",
      status: "active",
      points: START_POINTS,
      pointsReachedAt: now,
      createdAt: now,
    });
    return ws!;
  });
}

export async function searchWorkspaces(db: Db, input: { q: string; userId: number; limit?: number }) {
  const q = input.q.trim();
  const memberCount = db
    .select({ workspaceId: memberships.workspaceId, n: count().as("n") })
    .from(memberships)
    .where(eq(memberships.status, "active"))
    .groupBy(memberships.workspaceId)
    .as("member_count");
  const mine = db
    .select({ workspaceId: memberships.workspaceId, status: memberships.status, role: memberships.role })
    .from(memberships)
    .where(eq(memberships.userId, input.userId))
    .as("mine");

  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      isPublic: workspaces.isPublic,
      memberCount: sql<number>`coalesce(${memberCount.n}, 0)::int`,
      myStatus: mine.status,
      myRole: mine.role,
    })
    .from(workspaces)
    .leftJoin(memberCount, eq(memberCount.workspaceId, workspaces.id))
    .leftJoin(mine, eq(mine.workspaceId, workspaces.id))
    .where(q ? ilike(workspaces.nameFolded, `%${fold(q)}%`) : undefined)
    .orderBy(desc(sql`coalesce(${memberCount.n}, 0)`), asc(workspaces.name))
    .limit(Math.min(input.limit ?? 20, 50));
}

export async function myWorkspaces(db: Db, userId: number) {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      isPublic: workspaces.isPublic,
      role: memberships.role,
      status: memberships.status,
      points: memberships.points,
    })
    .from(memberships)
    .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
    .where(and(eq(memberships.userId, userId), ne(memberships.status, "removed")))
    .orderBy(asc(workspaces.name));
  return rows.map((r) => ({ ...r, tier: tierDto(r.points) }));
}

export async function joinWorkspace(db: Db, input: { workspaceId: number; userId: number; now?: Date }) {
  const now = input.now ?? new Date();

  return db.transaction(async (tx) => {
    const [ws] = await tx.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).for("update");
    if (!ws) throw new AppError("WORKSPACE_NOT_FOUND", 404, "Không tìm thấy workspace.");

    const [existing] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, input.userId)))
      .for("update");

    if (existing?.status === "active") return { status: "active" as const };
    if (existing?.status === "pending") return { status: "pending" as const };

    // Bị owner đuổi thì luôn phải xin lại; tự rời thì theo chế độ của workspace.
    const wasKicked = existing?.status === "removed" && existing.removedBy !== null;
    const status = wasKicked || !ws.isPublic ? ("pending" as const) : ("active" as const);

    if (existing) {
      // Giữ nguyên điểm cũ. Nếu đặt lại 1000 ở đây, ai thua sẽ rời nhóm rồi vào lại để xóa nợ.
      await tx.update(memberships).set({ status, removedBy: null }).where(eq(memberships.id, existing.id));
    } else {
      await tx.insert(memberships).values({
        workspaceId: ws.id,
        userId: input.userId,
        role: "member",
        status,
        points: START_POINTS,
        pointsReachedAt: now,
        createdAt: now,
      });
    }
    return { status };
  });
}

export async function listMembers(db: Db, workspaceId: number) {
  const rows = await db
    .select({
      userId: memberships.userId,
      name: users.name,
      avatarUrl: users.avatarUrl,
      role: memberships.role,
      status: memberships.status,
      points: memberships.points,
      wins: memberships.wins,
      losses: memberships.losses,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.workspaceId, workspaceId), ne(memberships.status, "removed")))
    .orderBy(asc(memberships.status), ...RANK_ORDER);
  return rows.map((r) => ({ ...r, tier: tierDto(r.points) }));
}

export async function approveMember(db: Db, input: { workspaceId: number; userId: number; now?: Date }) {
  const updated = await db
    .update(memberships)
    .set({ status: "active", removedBy: null })
    .where(
      and(
        eq(memberships.workspaceId, input.workspaceId),
        eq(memberships.userId, input.userId),
        eq(memberships.status, "pending"),
      ),
    )
    .returning({ id: memberships.id });
  if (updated.length === 0) throw new AppError("NOT_FOUND", 404, "Không có yêu cầu nào đang chờ của người này.");
}

/** Dùng cho cả từ chối yêu cầu lẫn đuổi thành viên. */
export async function removeMember(db: Db, input: { workspaceId: number; userId: number; actorId: number; now?: Date }) {
  const [target] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, input.workspaceId), eq(memberships.userId, input.userId)));
  if (!target || target.status === "removed") {
    throw new AppError("NOT_FOUND", 404, "Người này không ở trong workspace.");
  }
  if (target.role === "owner") {
    throw new AppError("OWNER_CANNOT_LEAVE", 400, "Không thể đưa chủ workspace ra khỏi workspace.");
  }
  await db.update(memberships).set({ status: "removed", removedBy: input.actorId }).where(eq(memberships.id, target.id));
}

/** Dòng thành viên ở lại cùng điểm: xóa đi thì ai thua chỉ cần rời rồi vào lại là sạch nợ. */
export async function leaveWorkspace(db: Db, input: { workspaceId: number; userId: number }) {
  const m = await requireMember(db, input.workspaceId, input.userId);
  if (m.role === "owner") {
    throw new AppError("OWNER_CANNOT_LEAVE", 400, "Chủ workspace không thể rời workspace của mình.");
  }
  await db.update(memberships).set({ status: "removed", removedBy: null }).where(eq(memberships.id, m.id));
}

export async function updateWorkspace(db: Db, input: { workspaceId: number; name?: string; isPublic?: boolean }) {
  const patch: { name?: string; nameFolded?: string; isPublic?: boolean } = {};
  if (input.name !== undefined) {
    const name = workspaceName(input.name);
    patch.name = name;
    patch.nameFolded = fold(name);
  }
  if (input.isPublic !== undefined) patch.isPublic = input.isPublic;
  if (Object.keys(patch).length === 0) throw new AppError("VALIDATION", 400, "Không có gì để đổi.");

  const [ws] = await db.update(workspaces).set(patch).where(eq(workspaces.id, input.workspaceId)).returning();
  if (!ws) throw new AppError("WORKSPACE_NOT_FOUND", 404, "Không tìm thấy workspace.");
  return ws;
}

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
    tier: tierDto(r.points),
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
