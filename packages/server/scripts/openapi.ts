import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app.js";
import type { Db } from "../src/db/client.js";
import type { DiscordClient } from "../src/services/discord.js";

// The spec comes from the route schemas alone, so no database or Discord app is needed.
const unusable = new Proxy(
  {},
  {
    get() {
      throw new Error("The spec generator must not touch the database.");
    },
  },
) as Db;

const discord: DiscordClient = {
  exchangeCode: () => Promise.reject(new Error("unused")),
};

const app = await buildApp({
  db: unusable,
  discord,
  adminDiscordIds: [],
  allowedRedirectUris: [],
  logger: false,
  limits: false,
  docs: false,
  // A throwaway key: the slash command route only appears in the spec when one is set,
  // and the spec never contains the key itself.
  discordPublicKey: generateKeyPairSync("ed25519")
    .publicKey.export({ format: "der", type: "spki" })
    .subarray(12)
    .toString("hex"),
});
await app.ready();

const out = fileURLToPath(new URL("../openapi.json", import.meta.url));
writeFileSync(out, `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();

console.log(`Wrote ${out}`);
