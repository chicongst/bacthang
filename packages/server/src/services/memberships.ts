import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { memberships, users, workspaces } from "../db/schema.js";
import { START_POINTS, tierSummary } from "../domain/rules.js";
import { AppError } from "../errors.js";

export type Membership = typeof memberships.$inferSelect;

export const RANK_ORDER = [desc(memberships.points), asc(memberships.pointsReachedAt), asc(memberships.userId)];

export async function requireMember(db: Db, workspaceId: number, userId: number): Promise<Membership> {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
  if (!m || m.status === "removed") {
    throw new AppError("NOT_MEMBER", 403, "You are not in this workspace.");
  }
  if (m.status === "pending") {
    throw new AppError("PENDING_APPROVAL", 403, "Your request is waiting for the workspace owner to approve it.");
  }
  return m;
}

export async function requireOwner(db: Db, workspaceId: number, userId: number, isServerAdmin: boolean) {
  if (isServerAdmin) {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    if (!ws) throw new AppError("WORKSPACE_NOT_FOUND", 404, "Workspace not found.");
    return;
  }
  const m = await requireMember(db, workspaceId, userId);
  if (m.role !== "owner") {
    throw new AppError("FORBIDDEN", 403, "Only the workspace owner can do this.");
  }
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
  return rows.map((r) => ({ ...r, tier: tierSummary(r.points) }));
}

export async function joinWorkspace(db: Db, input: { workspaceId: number; userId: number; now?: Date }) {
  const now = input.now ?? new Date();

  return db.transaction(async (tx) => {
    const [ws] = await tx.select().from(workspaces).where(eq(workspaces.id, input.workspaceId)).for("update");
    if (!ws) throw new AppError("WORKSPACE_NOT_FOUND", 404, "Workspace not found.");

    const [existing] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.workspaceId, ws.id), eq(memberships.userId, input.userId)))
      .for("update");

    if (existing?.status === "active") return { status: "active" as const };
    if (existing?.status === "pending") return { status: "pending" as const };

    // Someone removed by the owner always has to ask again; leaving on your own follows the workspace mode.
    const wasKicked = existing?.status === "removed" && existing.removedBy !== null;
    const status = wasKicked || !ws.isPublic ? ("pending" as const) : ("active" as const);

    if (existing) {
      // Keep the old points. Resetting to 1000 here lets a losing player leave and rejoin to wipe the debt.
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
  return rows.map((r) => ({ ...r, tier: tierSummary(r.points) }));
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
  if (updated.length === 0) throw new AppError("NOT_FOUND", 404, "No pending request from this person.");
}

export async function removeMember(db: Db, input: { workspaceId: number; userId: number; actorId: number; now?: Date }) {
  const [target] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, input.workspaceId), eq(memberships.userId, input.userId)));
  if (!target || target.status === "removed") {
    throw new AppError("NOT_FOUND", 404, "This person is not in the workspace.");
  }
  if (target.role === "owner") {
    throw new AppError("OWNER_CANNOT_LEAVE", 400, "The workspace owner cannot be removed.");
  }
  await db.update(memberships).set({ status: "removed", removedBy: input.actorId }).where(eq(memberships.id, target.id));
}

/** The membership row stays with its points: deleting it lets a loser rejoin with a clean slate. */
export async function leaveWorkspace(db: Db, input: { workspaceId: number; userId: number }) {
  const m = await requireMember(db, input.workspaceId, input.userId);
  if (m.role === "owner") {
    throw new AppError("OWNER_CANNOT_LEAVE", 400, "The owner cannot leave their own workspace.");
  }
  await db.update(memberships).set({ status: "removed", removedBy: null }).where(eq(memberships.id, m.id));
}

