import type { FastifyInstance } from "fastify";
import { ID_SCHEMA, type IdParams, type RouteContext } from "../context.js";
import { WORKSPACE_NAME_MAX, WORKSPACE_NAME_MIN } from "../../domain/rules.js";
import { createWorkspace, searchWorkspaces, updateWorkspace } from "../../services/workspaces.js";
import { joinWorkspace, leaveWorkspace } from "../../services/memberships.js";
import { getBoard } from "../../services/board.js";

const NAME = { type: "string", minLength: WORKSPACE_NAME_MIN, maxLength: WORKSPACE_NAME_MAX } as const;
const idParams = { params: { type: "object", properties: { id: ID_SCHEMA } } } as const;

export async function workspaceRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  app.get<{ Querystring: { q?: string } }>(
    "/workspaces/search",
    { schema: { querystring: { type: "object", properties: { q: { type: "string", maxLength: 60 } } } } },
    async (req) => {
      const user = await ctx.requireUser(req);
      return { workspaces: await searchWorkspaces(ctx.db, { q: req.query.q ?? "", userId: user.id }) };
    },
  );

  app.post<{ Body: { name: string; isPublic: boolean } }>(
    "/workspaces",
    {
      config: ctx.rateLimit(ctx.limits?.writePerWindow),
      schema: {
        body: {
          type: "object",
          required: ["name", "isPublic"],
          additionalProperties: false,
          properties: { name: NAME, isPublic: { type: "boolean" } },
        },
      },
    },
    async (req, reply) => {
      const user = await ctx.requireUser(req);
      const workspace = await createWorkspace(ctx.db, { ...req.body, ownerId: user.id, now: ctx.now() });
      req.log.info({ event: "workspace.created", workspaceId: workspace.id, ownerId: user.id });
      return reply.code(201).send({ workspace });
    },
  );

  app.post<IdParams>("/workspaces/:id/join", { schema: idParams }, async (req) => {
    const user = await ctx.requireUser(req);
    const workspaceId = Number(req.params.id);
    const result = await joinWorkspace(ctx.db, { workspaceId, userId: user.id, now: ctx.now() });
    req.log.info({ event: "workspace.joined", workspaceId, userId: user.id, status: result.status });
    ctx.emit(workspaceId, result.status === "active" ? "board" : "members");
    return result;
  });

  app.post<IdParams>("/workspaces/:id/leave", { schema: idParams }, async (req, reply) => {
    const { user, workspaceId } = await ctx.inWorkspace(req);
    await leaveWorkspace(ctx.db, { workspaceId, userId: user.id });
    req.log.info({ event: "workspace.left", workspaceId, userId: user.id });
    ctx.emit(workspaceId, "board");
    return reply.code(204).send();
  });

  app.get<IdParams>("/workspaces/:id/board", { schema: idParams }, async (req) => {
    const user = await ctx.requireUser(req);
    return getBoard(ctx.db, { workspaceId: Number(req.params.id), userId: user.id, now: ctx.now() });
  });

  app.patch<IdParams & { Body: { name?: string; isPublic?: boolean } }>(
    "/workspaces/:id",
    {
      schema: {
        ...idParams,
        body: {
          type: "object",
          additionalProperties: false,
          properties: { name: NAME, isPublic: { type: "boolean" } },
        },
      },
    },
    async (req) => {
      const { user, workspaceId } = await ctx.asOwner(req);
      const workspace = await updateWorkspace(ctx.db, { workspaceId, ...req.body });
      req.log.info({ event: "workspace.updated", workspaceId, by: user.id });
      ctx.emit(workspaceId, "board");
      return { workspace };
    },
  );
}
