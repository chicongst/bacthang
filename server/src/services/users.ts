import type { Db } from "../db/client.js";
import { users } from "../db/schema.js";
import type { DiscordProfile } from "./discord.js";

export async function upsertDiscordUser(db: Db, profile: DiscordProfile, now: Date) {
  const [u] = await db
    .insert(users)
    .values({ discordId: profile.id, name: profile.name, avatarUrl: profile.avatarUrl, lastLoginAt: now })
    .onConflictDoUpdate({
      target: users.discordId,
      set: { name: profile.name, avatarUrl: profile.avatarUrl, lastLoginAt: now },
    })
    .returning({ id: users.id, discordId: users.discordId, name: users.name, avatarUrl: users.avatarUrl });
  return u!;
}
