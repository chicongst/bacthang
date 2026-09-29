import type { FastifyInstance } from "fastify";
import type { RouteContext } from "../context.js";
import { AppError } from "../../errors.js";
import { createSession, revokeSession } from "../../services/sessions.js";
import { upsertDiscordUser } from "../../services/users.js";
import { myWorkspaces } from "../../services/memberships.js";

export async function authRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  app.post<{ Body: { code: string; redirectUri: string } }>(
    "/auth/discord",
    {
      config: ctx.rateLimit(ctx.limits?.authPerWindow),
      schema: {
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
        throw new AppError("VALIDATION", 400, "Địa chỉ chuyển hướng không được phép.");
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

  app.post("/auth/logout", async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (token) await revokeSession(ctx.db, token);
    return reply.code(204).send();
  });

  app.get("/me", async (req) => {
    const user = await ctx.requireUser(req);
    return { ...user, workspaces: await myWorkspaces(ctx.db, user.id) };
  });
}
