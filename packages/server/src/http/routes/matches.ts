import type { FastifyInstance } from "fastify";
import { ID_SCHEMA, type IdParams, type RouteContext } from "../context.js";
import { deleteMatch, recentMatches, recordMatch } from "../../services/matches.js";
import { currentSeason, listSeasons, resetSeason, seasonStandingsFor } from "../../services/seasons.js";
import { getBoard } from "../../services/board.js";

const RECENT_LIMIT = 30;
const idParams = { params: { type: "object", properties: { id: ID_SCHEMA } } } as const;

export async function matchRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  app.get<IdParams>(
    "/workspaces/:id/matches",
    { schema: { ...idParams, tags: ["matches"], summary: "The most recent matches in a workspace" } },
    async (req) => {
      const { workspaceId } = await ctx.inWorkspace(req);
      const season = await currentSeason(ctx.db, workspaceId);
      return { matches: await recentMatches(ctx.db, workspaceId, season.id, RECENT_LIMIT) };
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

  app.get<IdParams>(
    "/workspaces/:id/seasons",
    { schema: { ...idParams, tags: ["seasons"], summary: "Every season this workspace has played" } },
    async (req) => {
      const { workspaceId } = await ctx.inWorkspace(req);
      return { seasons: await listSeasons(ctx.db, workspaceId) };
    },
  );

  app.get<{ Params: { id: string; seasonId: string } }>(
    "/workspaces/:id/seasons/:seasonId",
    {
      schema: {
        tags: ["seasons"],
        summary: "The final table of a season that has ended",
        params: { type: "object", properties: { id: ID_SCHEMA, seasonId: ID_SCHEMA } },
      },
    },
    async (req) => {
      const { workspaceId } = await ctx.inWorkspace(req);
      return seasonStandingsFor(ctx.db, workspaceId, Number(req.params.seasonId));
    },
  );

  app.post<IdParams>(
    "/workspaces/:id/seasons",
    {
      config: ctx.rateLimit(ctx.limits?.writePerWindow),
      schema: {
        ...idParams,
        tags: ["seasons"],
        summary: "Close the season and start the next one, putting everybody back to the starting points (owner only)",
      },
    },
    async (req, reply) => {
      const { user, workspaceId } = await ctx.asOwner(req);
      const { closed, started } = await resetSeason(ctx.db, { workspaceId, actorId: user.id, now: ctx.now() });
      req.log.warn({ event: "season.reset", workspaceId, closed: closed.number, started: started.number, by: user.id });
      ctx.emit(workspaceId, "board");
      return reply.code(201).send({ season: { id: started.id, number: started.number } });
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
