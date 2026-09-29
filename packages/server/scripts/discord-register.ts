import { COMMANDS } from "../src/discord/commands.js";

const appId = process.env.DISCORD_APP_ID?.trim();
const token = process.env.DISCORD_BOT_TOKEN?.trim();

if (!appId || !token) {
  console.error("Set DISCORD_APP_ID and DISCORD_BOT_TOKEN first. Both are on the Discord application page.");
  process.exit(1);
}

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: "PUT",
  headers: { authorization: `Bot ${token}`, "content-type": "application/json" },
  body: JSON.stringify(COMMANDS),
});

if (!res.ok) {
  console.error(`Discord refused the commands: ${res.status} ${await res.text()}`);
  process.exit(1);
}

console.log(`Registered: ${COMMANDS.map((c) => `/${c.name}`).join(" ")}`);
