import type { FastifyInstance } from "fastify";
import { ID_SCHEMA, type IdParams, type RouteContext } from "../context.js";
import { deleteMatch, recentMatches, recordMatch } from "../../services/matches.js";
import { getBoard } from "../../services/board.js";

const RECENT_LIMIT = 30;
const idParams = { params: { type: "object", properties: { id: ID_SCHEMA } } } as const;

export async function matchRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  app.get<IdParams>(
    "/workspaces/:id/matches",
    { schema: { ...idParams, tags: ["matches"], summary: "The most recent matches in a workspace" } },
    async (req) => {
      const { workspaceId } = await ctx.inWorkspace(req);
      return { matches: await recentMatches(ctx.db, workspaceId, RECENT_LIMIT) };
    },
  );

  app.post<IdParams & { Body: { opponentId: number; result: "win" | "loss" } }>(
    "/workspaces/:id/matches",
    {
      config: ctx.rateLimit(ctx.limits?.writePerWindow),
      schema: {
        ...idParams,
        tags: ["matches"],
        summary: "Record a result and get the updated board back",
        body: {
          type: "object",
          required: ["opponentId", "result"],
          additionalProperties: false,
          properties: {
            opponentId: { type: "integer", minimum: 1 },
            result: { type: "string", enum: ["win", "loss"] },
          },
        },
      },
    },
    async (req, reply) => {
      const user = await ctx.requireUser(req);
      const workspaceId = Number(req.params.id);
      const at = ctx.now();
      const match = await recordMatch(ctx.db, {
        workspaceId,
        reporterId: user.id,
        opponentId: req.body.opponentId,
        result: req.body.result,
        now: at,
      });
      req.log.info({ event: "match.recorded", workspaceId, matchId: match.id, by: user.id });
      ctx.emit(workspaceId, "board");

      const board = await getBoard(ctx.db, { workspaceId, userId: user.id, now: at });
      return reply.code(201).send({ match, ...board });
    },
  );

  app.delete<{ Params: { id: string; matchId: string } }>(
    "/workspaces/:id/matches/:matchId",
    {
      schema: {
        tags: ["matches"],
        summary: "Undo a match and give both players their points back (owner only)",
        params: { type: "object", properties: { id: ID_SCHEMA, matchId: ID_SCHEMA } },
      },
    },
    async (req, reply) => {
      const { user, workspaceId } = await ctx.asOwner(req);
      const matchId = Number(req.params.matchId);
      await deleteMatch(ctx.db, { workspaceId, matchId, deletedBy: user.id, now: ctx.now() });
      req.log.warn({ event: "match.deleted", workspaceId, matchId, by: user.id });
      ctx.emit(workspaceId, "board");
      return reply.code(204).send();
    },
  );
}
