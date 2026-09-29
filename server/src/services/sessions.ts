import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// DB chỉ giữ hash: lộ bảng sessions cũng không dùng được token.
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: number, now: Date): Promise<string> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), lte(sessions.expiresAt, now)));

  const token = randomBytes(32).toString("base64url");
  await db.insert(sessions).values({
    userId,
    tokenHash: hash(token),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
  });
  return token;
}

export async function userForToken(db: Db, token: string, now: Date) {
  const [row] = await db
    .select({ id: users.id, discordId: users.discordId, name: users.name, avatarUrl: users.avatarUrl })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hash(token)), gt(sessions.expiresAt, now)));
  return row ?? null;
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hash(token)));
}
