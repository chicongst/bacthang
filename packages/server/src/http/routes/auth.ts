import type { FastifyInstance } from "fastify";
import type { RouteContext } from "../context.js";
import { AppError } from "../../errors.js";
import { createSession, revokeAllSessions, revokeSession } from "../../services/sessions.js";
import { upsertDiscordUser } from "../../services/users.js";
import { myWorkspaces } from "../../services/memberships.js";

export async function authRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  app.post<{ Body: { code: string; redirectUri: string } }>(
    "/auth/discord",
    {
      config: ctx.rateLimit(ctx.limits?.authPerWindow),
      schema: {
        tags: ["auth"],
        summary: "Exchange a Discord authorization code for a session token",
        security: [],
        body: {
          type: "object",
          required: ["code", "redirectUri"],
          additionalProperties: false,
          properties: {
            code: { type: "string", minLength: 1, maxLength: 200 },
            redirectUri: { type: "string", minLength: 1, maxLength: 300 },
          },
        },
      },
    },
    async (req) => {
      if (!ctx.isAllowedRedirect(req.body.redirectUri)) {
        throw new AppError("VALIDATION", 400, "That redirect URI is not allowed.");
      }
      const profile = await ctx.discord.exchangeCode(req.body.code, req.body.redirectUri);
      const at = ctx.now();
      const user = await upsertDiscordUser(ctx.db, profile, at);
      const token = await createSession(ctx.db, user.id, at);
      req.log.info({ event: "auth.login", userId: user.id });

      return {
        token,
        user: {
          ...user,
          isServerAdmin: ctx.isServerAdmin(user.discordId),
          workspaces: await myWorkspaces(ctx.db, user.id),
        },
      };
    },
  );

  const schema = (summary: string) => ({ schema: { tags: ["auth"], summary } });

  app.post("/auth/logout", schema("Sign out this device"), async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) await revokeSession(ctx.db, token);
    return reply.code(204).send();
  });

  app.post(
    "/auth/logout-all",
    { config: ctx.rateLimit(ctx.limits?.authPerWindow), ...schema("Sign out every device, revoking all sessions") },
    async (req, reply) => {
      const user = await ctx.requireUser(req);
      const revoked = await revokeAllSessions(ctx.db, user.id);
      req.log.warn({ event: "auth.logoutAll", userId: user.id, revoked });
      return reply.code(204).send();
    },
  );

  app.get("/me", schema("The signed-in account and its workspaces"), async (req) => {
    const user = await ctx.requireUser(req);
    return { ...user, workspaces: await myWorkspaces(ctx.db, user.id) };
  });
}
