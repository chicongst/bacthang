import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb, runMigrations } from "./db/client.js";
import { createDiscordClient } from "./services/discord.js";

const config = loadConfig();
const { db, pool } = createDb(config.databaseUrl);
await runMigrations(db);

const app = await buildApp({
  db,
  discord: createDiscordClient({ clientId: config.discordClientId, clientSecret: config.discordClientSecret }),
  adminDiscordIds: config.adminDiscordIds,
  allowedRedirectUris: config.discordRedirectUris,
  trustProxy: config.trustProxy,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.host });
