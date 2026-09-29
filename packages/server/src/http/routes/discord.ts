import type { KeyObject } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { RouteContext } from "../context.js";
import { handleInteraction, type Interaction } from "../../discord/interactions.js";
import { isFromDiscord } from "../../discord/verify.js";

interface WithRawBody extends FastifyRequest {
  rawBody?: string;
}

const header = (req: FastifyRequest, name: string): string | undefined => {
  const value = req.headers[name];
  return typeof value === "string" ? value : undefined;
};

export interface DiscordRouteOptions {
  publicKey: KeyObject;
  signInUrl: string;
}

export async function discordRoutes(
  app: FastifyInstance,
  ctx: RouteContext,
  opts: DiscordRouteOptions,
): Promise<void> {
  // The signature covers the exact bytes Discord sent, so the parsed object cannot verify it.
  app.addContentTypeParser("application/json", { parseAs: "string" }, (req, body, done) => {
    (req as WithRawBody).rawBody = body as string;
    try {
      done(null, JSON.parse(body as string));
    } catch {
      done(null, {});
    }
  });

  app.post(
    "/discord/interactions",
    {
      schema: {
        tags: ["discord"],
        summary: "Slash commands, called by Discord and authenticated by its Ed25519 signature",
        security: [],
      },
    },
    async (req, reply) => {
      const signed = {
        signature: header(req, "x-signature-ed25519"),
        timestamp: header(req, "x-signature-timestamp"),
        body: (req as WithRawBody).rawBody ?? "",
      };
      // Discord reads a 401 here as "this endpoint is not mine" while registering it.
      if (!isFromDiscord(opts.publicKey, signed, ctx.now())) {
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "Invalid signature." } });
      }

      const response = await handleInteraction(
        {
          db: ctx.db,
          now: () => ctx.now(),
          emit: (workspaceId, scope) => ctx.emit(workspaceId, scope),
          signInUrl: opts.signInUrl,
        },
        req.body as Interaction,
      );
      return reply.send(response);
    },
  );
}
