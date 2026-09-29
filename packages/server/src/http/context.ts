import type { FastifyRequest } from "fastify";
import type { Db } from "../db/client.js";
import type { EventBus, EventScope } from "../events.js";
import type { DiscordClient } from "../services/discord.js";

export interface Limits {
  windowMs: number;
  perWindow: number;
  authPerWindow: number;
  writePerWindow: number;
  streamsPerUser: number;
}

export const DEFAULT_LIMITS: Limits = {
  windowMs: 60_000,
  perWindow: 300,
  authPerWindow: 10,
  writePerWindow: 40,
  streamsPerUser: 5,
};

export interface Authed {
  id: number;
  discordId: string;
  name: string;
  avatarUrl: string | null;
  isServerAdmin: boolean;
}

export interface InWorkspace {
  user: Authed;
  workspaceId: number;
}

export type IdParams = { Params: { id: string } };

export interface RouteContext {
  db: Db;
  discord: DiscordClient;
  bus: EventBus;
  limits: Limits | null;
  now(): Date;
  isAllowedRedirect(uri: string): boolean;
  isServerAdmin(discordId: string): boolean;
  requireUser(req: FastifyRequest): Promise<Authed>;
  inWorkspace(req: FastifyRequest<IdParams>): Promise<InWorkspace>;
  asOwner(req: FastifyRequest<IdParams>): Promise<InWorkspace>;
  emit(workspaceId: number, scope: EventScope): void;
  rateLimit(max: number | undefined): Record<string, unknown>;
}

export const ID_SCHEMA = { type: "string", pattern: "^[1-9][0-9]{0,9}$" } as const;
