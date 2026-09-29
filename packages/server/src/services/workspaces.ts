import { asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { memberships, workspaces } from "../db/schema.js";
import {
  MAX_WORKSPACES_PER_OWNER,
  START_POINTS,
  TOURNAMENT_NAME_MAX,
  WORKSPACE_NAME_MAX,
  WORKSPACE_NAME_MIN,
} from "../domain/rules.js";
import { fold } from "../domain/text.js";
import { AppError } from "../errors.js";
import { startFirstSeason } from "./seasons.js";

function workspaceName(raw: string): string {
  const name = raw.trim();
  if (name.length < WORKSPACE_NAME_MIN || name.length > WORKSPACE_NAME_MAX) {
    throw new AppError(
      "VALIDATION",
      400,
      `Workspace name must be ${WORKSPACE_NAME_MIN} to ${WORKSPACE_NAME_MAX} characters.`,
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
    throw new AppError("VALIDATION", 400, `You can create at most ${MAX_WORKSPACES_PER_OWNER} workspaces.`);
  }

  return db.transaction(async (tx) => {
    const [ws] = await tx
      .insert(workspaces)
      .values({ name, nameFolded: fold(name), isPublic: input.isPublic, ownerId: input.ownerId, createdAt: now })
      .returning();
    await startFirstSeason(tx, ws!.id, now);
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


export async function updateWorkspace(
  db: Db,
  input: { workspaceId: number; name?: string; isPublic?: boolean; tournamentName?: string | null },
) {
  const patch: { name?: string; nameFolded?: string; isPublic?: boolean; tournamentName?: string | null } = {};
  if (input.name !== undefined) {
    const name = workspaceName(input.name);
    patch.name = name;
    patch.nameFolded = fold(name);
  }
  if (input.isPublic !== undefined) patch.isPublic = input.isPublic;
  if (input.tournamentName !== undefined) {
    const title = input.tournamentName?.trim() ?? "";
    if (title.length > TOURNAMENT_NAME_MAX) {
      throw new AppError("VALIDATION", 400, `The tournament name can be at most ${TOURNAMENT_NAME_MAX} characters.`);
    }
    // An empty string is how the owner takes the banner back down.
    patch.tournamentName = title || null;
  }
  if (Object.keys(patch).length === 0) throw new AppError("VALIDATION", 400, "Nothing to update.");

  const [ws] = await db.update(workspaces).set(patch).where(eq(workspaces.id, input.workspaceId)).returning();
  if (!ws) throw new AppError("WORKSPACE_NOT_FOUND", 404, "Workspace not found.");
  return ws;
}

