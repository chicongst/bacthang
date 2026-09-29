import { and, eq, sql } from "drizzle-orm";
import { createDb, runMigrations, type Db } from "../src/db/client.js";
import { memberships, users } from "../src/db/schema.js";
import { createWorkspace } from "../src/services/workspaces.js";

const URL = process.env.TEST_DATABASE_URL ?? "postgres://postgres:test@localhost:54329/ranking_test";

export async function openTestDb() {
  const { db, pool } = createDb(URL);
  // Container Postgres khởi động lại một lần trong lúc init; chờ nó sẵn sàng hẳn.
  for (let attempt = 0; ; attempt++) {
    try {
      await pool.query("select 1");
      break;
    } catch (err) {
      if (attempt >= 20) throw err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  await runMigrations(db);
  return { db, pool };
}

export async function resetDb(db: Db) {
  await db.execute(sql`TRUNCATE sessions, matches, memberships, workspaces, users RESTART IDENTITY CASCADE`);
}

export async function makeUser(db: Db, name: string) {
  const [u] = await db.insert(users).values({ discordId: `d-${name}`, name }).returning();
  return u!;
}

export async function makeWorkspace(db: Db, ownerId: number, opts: { name?: string; isPublic?: boolean } = {}) {
  return createWorkspace(db, {
    name: opts.name ?? "CLB Thử",
    isPublic: opts.isPublic ?? true,
    ownerId,
  });
}

export async function addMember(db: Db, workspaceId: number, userId: number) {
  await db.insert(memberships).values({ workspaceId, userId, role: "member", status: "active" });
}

export async function memberOf(db: Db, workspaceId: number, userId: number) {
  const [m] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, userId)));
  return m!;
}

/** Một workspace với owner + các thành viên, tiện cho test ghi trận. */
export async function makeClub(db: Db, names: string[], opts: { isPublic?: boolean } = {}) {
  const people: Record<string, { id: number; name: string }> = {};
  const [firstName, ...rest] = names;
  const owner = await makeUser(db, firstName!);
  people[firstName!] = owner;
  const ws = await makeWorkspace(db, owner.id, opts);
  for (const n of rest) {
    const u = await makeUser(db, n);
    await addMember(db, ws.id, u.id);
    people[n] = u;
  }
  return { ws, people, owner };
}
