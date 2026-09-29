import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import type { OpenAPIV3_1 } from "openapi-types";
import swaggerUi from "@fastify/swagger-ui";
import type { Db } from "./db/client.js";
import { AppError } from "./errors.js";
import { EventBus, type EventScope } from "./events.js";
import {
  DEFAULT_LIMITS,
  type Authed,
  type IdParams,
  type Limits,
  type RouteContext,
} from "./http/context.js";
import { authRoutes } from "./http/routes/auth.js";
import { eventRoutes } from "./http/routes/events.js";
import { matchRoutes } from "./http/routes/matches.js";
import { memberRoutes } from "./http/routes/members.js";
import { workspaceRoutes } from "./http/routes/workspaces.js";
import type { DiscordClient } from "./services/discord.js";
import { userForToken } from "./services/sessions.js";
import { requireMember, requireOwner } from "./services/memberships.js";

export { DEFAULT_LIMITS, type Limits } from "./http/context.js";

export const OPENAPI: Partial<OpenAPIV3_1.Document> = {
  openapi: "3.1.0",
  info: {
    title: "Bậc Thang API",
    description:
      "Scoring and ranking for a group that competes. Every route except /health and /auth/discord " +
      "needs a session token, and every route inside a workspace checks membership on the server.",
    version: "1.0.0",
    license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
  },
  tags: [
    { name: "auth", description: "Discord sign-in and session lifetime" },
    { name: "workspaces", description: "Groups, each with its own board" },
    { name: "members", description: "Approving and removing people, owner only" },
    { name: "matches", description: "Recording and undoing results" },
    { name: "events", description: "The realtime channel" },
  ],
  components: {
    securitySchemes: {
      bearer: { type: "http", scheme: "bearer", description: "The token returned by POST /auth/discord" },
    },
  },
  security: [{ bearer: [] }],
};

export interface AppOptions {
  db: Db;
  discord: DiscordClient;
  adminDiscordIds: string[];
  allowedRedirectUris: string[];
  now?: () => Date;
  logger?: boolean;
  bus?: EventBus;
  version?: string;
  trustProxy?: boolean;
  limits?: Limits | false;
  /** The Swagger UI at /docs. On by default; tests turn it off to stay quiet. */
  docs?: boolean;
}

function bearerToken(req: FastifyRequest): string | null {
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { db, discord } = opts;
  const limits = opts.limits === false ? null : (opts.limits ?? DEFAULT_LIMITS);
  const bus = opts.bus ?? new EventBus();
  const now = opts.now ?? (() => new Date());
  const admins = new Set(opts.adminDiscordIds);
  const redirects = new Set(opts.allowedRedirectUris);

  const app = Fastify({
    logger: opts.logger ?? true,
    // Turn off ajv coercion: "2" must not silently become the number 2.
    ajv: { customOptions: { coerceTypes: false } },
    trustProxy: opts.trustProxy ?? false,
  });

  if (limits) {
    await app.register(rateLimit, { global: true, max: limits.perWindow, timeWindow: limits.windowMs });
  }

  await app.register(swagger, { openapi: OPENAPI });
  if (opts.docs ?? true) {
    await app.register(swaggerUi, { routePrefix: "/docs", uiConfig: { docExpansion: "list" } });
  }

  // Changes on every deploy; the client compares it with the first value it saw to spot a stale page.
  const version = opts.version ?? String(Date.now());
  app.addHook("onSend", async (_req, reply) => {
    reply.header("x-app-version", version);
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found." } });
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message } });
    }
    if (err.statusCode === 429) {
      return reply
        .code(429)
        .send({ error: { code: "RATE_LIMITED", message: "Too many requests. Wait a moment and try again." } });
    }
    if (err.validation || (err.statusCode && err.statusCode >= 400 && err.statusCode < 500)) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: "Invalid request payload." } });
    }
    req.log.error(err);
    return reply.code(500).send({ error: { code: "INTERNAL", message: "Server error. Try again later." } });
  });

  async function requireUser(req: FastifyRequest): Promise<Authed> {
    const token = bearerToken(req);
    const user = token ? await userForToken(db, token, now()) : null;
    if (!user) throw new AppError("UNAUTHORIZED", 401, "Please sign in again.");
    return { ...user, isServerAdmin: admins.has(user.discordId) };
  }

  const ctx: RouteContext = {
    db,
    discord,
    bus,
    limits,
    now,
    isAllowedRedirect: (uri) => redirects.has(uri),
    isServerAdmin: (discordId) => admins.has(discordId),
    requireUser,
    async inWorkspace(req: FastifyRequest<IdParams>) {
      const user = await requireUser(req);
      const workspaceId = Number(req.params.id);
      await requireMember(db, workspaceId, user.id);
      return { user, workspaceId };
    },
    async asOwner(req: FastifyRequest<IdParams>) {
      const user = await requireUser(req);
      const workspaceId = Number(req.params.id);
      await requireOwner(db, workspaceId, user.id, user.isServerAdmin);
      return { user, workspaceId };
    },
    emit: (workspaceId: number, scope: EventScope) => bus.emit(workspaceId, scope),
    rateLimit: (max) => (limits && max ? { rateLimit: { max, timeWindow: limits.windowMs } } : {}),
  };

  app.get("/health", { schema: { summary: "Liveness probe", security: [] } }, async () => ({ ok: true }));
  await app.register(async (instance) => authRoutes(instance, ctx));
  await app.register(async (instance) => workspaceRoutes(instance, ctx));
  await app.register(async (instance) => memberRoutes(instance, ctx));
  await app.register(async (instance) => matchRoutes(instance, ctx));
  await app.register(async (instance) => eventRoutes(instance, ctx));

  return app;
}
