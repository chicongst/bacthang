import type { FastifyInstance } from "fastify";
import { ID_SCHEMA, type IdParams, type RouteContext } from "../context.js";
import { approveMember, listMembers, removeMember } from "../../services/memberships.js";

type MemberParams = { Params: { id: string; userId: string } };
const memberParams = { params: { type: "object", properties: { id: ID_SCHEMA, userId: ID_SCHEMA } } } as const;

export async function memberRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  app.get<IdParams>(
    "/workspaces/:id/members",
    { schema: { params: { type: "object", properties: { id: ID_SCHEMA } } } },
    async (req) => {
      const { workspaceId } = await ctx.asOwner(req);
      return { members: await listMembers(ctx.db, workspaceId) };
    },
  );

  app.post<MemberParams>(
    "/workspaces/:id/members/:userId/approve",
    { schema: memberParams },
    async (req, reply) => {
      const { user, workspaceId } = await ctx.asOwner(req);
      const memberId = Number(req.params.userId);
      await approveMember(ctx.db, { workspaceId, userId: memberId, now: ctx.now() });
      req.log.info({ event: "member.approved", workspaceId, memberId, by: user.id });
      ctx.emit(workspaceId, "board");
      return reply.code(204).send();
    },
  );

  app.delete<MemberParams>("/workspaces/:id/members/:userId", { schema: memberParams }, async (req, reply) => {
    const { user, workspaceId } = await ctx.asOwner(req);
    const memberId = Number(req.params.userId);
    await removeMember(ctx.db, { workspaceId, userId: memberId, actorId: user.id, now: ctx.now() });
    req.log.warn({ event: "member.removed", workspaceId, memberId, by: user.id });
    ctx.emit(workspaceId, "board");
    return reply.code(204).send();
  });
}
