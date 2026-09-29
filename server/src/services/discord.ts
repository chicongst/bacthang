import { AppError } from "../errors.js";

export interface DiscordProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface DiscordClient {
  exchangeCode(code: string, redirectUri: string): Promise<DiscordProfile>;
}

const API = "https://discord.com/api/v10";
const CDN = "https://cdn.discordapp.com";

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

function failed(): AppError {
  return new AppError("DISCORD_AUTH_FAILED", 401, "Đăng nhập Discord không thành công. Thử lại nhé.");
}

export function avatarUrlFor(user: Pick<DiscordUser, "id" | "avatar">): string {
  if (user.avatar) return `${CDN}/avatars/${user.id}/${user.avatar}.png?size=128`;
  // Avatar mặc định của Discord cho hệ tên người dùng mới.
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `${CDN}/embed/avatars/${index}.png`;
}

export function createDiscordClient(opts: { clientId: string; clientSecret: string }): DiscordClient {
  return {
    async exchangeCode(code, redirectUri) {
      const tokenRes = await fetch(`${API}/oauth2/token`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: opts.clientId,
          client_secret: opts.clientSecret,
        }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (!tokenRes?.ok) throw failed();
      const { access_token } = (await tokenRes.json()) as { access_token?: string };
      if (!access_token) throw failed();

      const meRes = await fetch(`${API}/users/@me`, {
        headers: { authorization: `Bearer ${access_token}` },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null);
      if (!meRes?.ok) throw failed();
      const u = (await meRes.json()) as DiscordUser;

      return { id: u.id, name: u.global_name || u.username, avatarUrl: avatarUrlFor(u) };
    },
  };
}
