function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing environment variable ${name}. See deploy/.env.example.`);
  return v;
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export function loadConfig() {
  return {
    databaseUrl: required("DATABASE_URL"),
    port: Number(process.env.PORT ?? 3000),
    host: process.env.HOST ?? "0.0.0.0",
    discordClientId: required("DISCORD_CLIENT_ID"),
    discordClientSecret: required("DISCORD_CLIENT_SECRET"),
    discordRedirectUris: list(required("DISCORD_REDIRECT_URIS")),
    adminDiscordIds: list(process.env.ADMIN_DISCORD_IDS),
    // Opt in, never by default: trusting X-Forwarded-For on an exposed API lets anyone
    // forge the IP the rate limiter keys on.
    trustProxy: process.env.TRUST_PROXY === "true",
  };
}
