function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Thiếu biến môi trường ${name}. Xem deploy/.env.example.`);
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
    // Sau Caddy thì IP thật nằm ở X-Forwarded-For; rate limit tính theo IP nên cần tin header này.
    trustProxy: process.env.TRUST_PROXY !== "false",
  };
}
