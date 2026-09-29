import type { FastifyInstance } from "fastify";
import { ID_SCHEMA, type IdParams, type RouteContext } from "../context.js";
import { AppError } from "../../errors.js";

const HEARTBEAT_MS = 25_000;

export async function eventRoutes(app: FastifyInstance, ctx: RouteContext): Promise<void> {
  const openStreams = new Map<number, number>();

  app.get<IdParams>(
    "/workspaces/:id/events",
    { schema: { params: { type: "object", properties: { id: ID_SCHEMA } } } },
    async (req, reply) => {
      const { user, workspaceId } = await ctx.inWorkspace(req);

      const open = openStreams.get(user.id) ?? 0;
      if (ctx.limits && open >= ctx.limits.streamsPerUser) {
        throw new AppError("TOO_MANY_STREAMS", 429, "Bạn đang mở quá nhiều kết nối. Đóng bớt tab rồi thử lại.");
      }
      openStreams.set(user.id, open + 1);

      reply.hijack();
      reply.raw.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      reply.raw.write(":\n\n");

      const unsubscribe = ctx.bus.subscribe(workspaceId, (event) => {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      });
      const heartbeat = setInterval(() => reply.raw.write(":\n\n"), HEARTBEAT_MS);

      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(heartbeat);
        unsubscribe();
        const left = (openStreams.get(user.id) ?? 1) - 1;
        if (left <= 0) openStreams.delete(user.id);
        else openStreams.set(user.id, left);
      };
      req.raw.on("close", stop);
      req.raw.on("error", stop);
    },
  );
}
