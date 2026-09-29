import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import type { Db } from "../src/db/client.js";
import { buildApp } from "../src/app.js";
import type { DiscordClient, DiscordProfile } from "../src/services/discord.js";
import { AppError } from "../src/errors.js";
import { openTestDb, resetDb } from "./helpers.js";

const REDIRECT = "https://ranking.test/";

let db: Db;
let pool: pg.Pool;
let app: FastifyInstance;
let clock: Date;

const profiles: Record<string, DiscordProfile> = {
  "code-a": { id: "111", name: "Alice", avatarUrl: "https://cdn.discordapp.com/avatars/111/x.png" },
  "code-b": { id: "222", name: "Bob", avatarUrl: null },
  "code-c": { id: "333", name: "Carol", avatarUrl: null },
  "code-admin": { id: "999", name: "Admin", avatarUrl: null },
};
const fakeDiscord: DiscordClient = {
  async exchangeCode(code) {
    const p = profiles[code];
    if (!p) throw new AppError("DISCORD_AUTH_FAILED", 401, "Discord sign-in failed. Please try again.");
    return p;
  },
};

beforeAll(async () => {
  ({ db, pool } = await openTestDb());
  app = await buildApp({
    db,
    discord: fakeDiscord,
    adminDiscordIds: ["999"],
    allowedRedirectUris: [REDIRECT],
    now: () => clock,
    logger: false,
    limits: false,
  });
  await app.ready();
});
afterAll(async () => {
  await app.close();
  await pool.end();
});
beforeEach(async () => {
  await resetDb(db);
  clock = new Date("2026-09-17T13:00:00Z"); // 20:00 Vietnam time
});

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function login(code: string) {
  const res = await app.inject({ method: "POST", url: "/auth/discord", payload: { code, redirectUri: REDIRECT } });
  expect(res.statusCode).toBe(200);
  const body = res.json() as {
    token: string;
    user: { id: number; name: string; isServerAdmin: boolean; workspaces: Array<Record<string, unknown>> };
  };
  return { ...body, headers: auth(body.token) };
}

async function makeWs(token: string, name = "Downtown Club", isPublic = true) {
  const res = await app.inject({ method: "POST", url: "/workspaces", headers: auth(token), payload: { name, isPublic } });
  expect(res.statusCode).toBe(201);
  return res.json().workspace as { id: number; name: string; isPublic: boolean };
}

const join = (token: string, wsId: number) =>
  app.inject({ method: "POST", url: `/workspaces/${wsId}/join`, headers: auth(token) });
const board = (token: string, wsId: number) =>
  app.inject({ method: "GET", url: `/workspaces/${wsId}/board`, headers: auth(token) });
const play = (token: string, wsId: number, opponentId: number, result: "win" | "loss") =>
  app.inject({ method: "POST", url: `/workspaces/${wsId}/matches`, headers: auth(token), payload: { opponentId, result } });

describe("sign-in", () => {
  it("a new user has no workspaces", async () => {
    const a = await login("code-a");
    expect(a.user).toMatchObject({ name: "Alice", isServerAdmin: false, workspaces: [] });

    const me = await app.inject({ method: "GET", url: "/me", headers: a.headers });
    expect(me.json()).toMatchObject({ name: "Alice", workspaces: [] });
  });

  it("signing in again keeps the workspaces already joined", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const again = await login("code-a");
    expect(again.user.workspaces).toMatchObject([{ id: ws.id, name: "Downtown Club", role: "owner", status: "active", points: 1000 }]);
  });

  it("a bad token returns 401", async () => {
    const res = await app.inject({ method: "GET", url: "/me", headers: auth("nope") });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
  });
});

describe("creating and searching workspaces", () => {
  it("the creator becomes owner and appears on the board", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const res = await board(a.token, ws.id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      workspace: { name: "Downtown Club", isPublic: true, memberCount: 1 },
      me: { rank: 1, points: 1000, role: "owner", matchesToday: 0, dailyLimitPerPair: 3, winPoints: 20, lossPoints: -20 },
      rules: { startPoints: 1000, winPoints: 20, lossPoints: -20, dailyLimitPerPair: 3 },
    });
    // Tier ladder travels with it, lowest first and open-ended at the bottom
    expect(res.json().rules.tiers).toEqual([
      { id: "bronze", name: "Bronze", minPoints: null },
      { id: "silver", name: "Silver", minPoints: 1000 },
      { id: "gold", name: "Gold", minPoints: 1100 },
      { id: "platinum", name: "Platinum", minPoints: 1200 },
      { id: "diamond", name: "Diamond", minPoints: 1300 },
      { id: "master", name: "Master", minPoints: 1400 },
    ]);
  });

  it("an invalid name returns 400", async () => {
    const a = await login("code-a");
    const res = await app.inject({ method: "POST", url: "/workspaces", headers: a.headers, payload: { name: "A", isPublic: true } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION");
  });

  it("search finds other workspaces with my own status", async () => {
    const a = await login("code-a");
    await makeWs(a.token, "Downtown Club");
    const b = await login("code-b");
    const res = await app.inject({ method: "GET", url: "/workspaces/search?q=downtown", headers: b.headers });
    expect(res.statusCode).toBe(200);
    expect(res.json().workspaces).toMatchObject([{ name: "Downtown Club", isPublic: true, memberCount: 1, myStatus: null }]);
  });
});

describe("joining", () => {
  it("public: joining shows the board right away", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token, "Open Club", true);
    const b = await login("code-b");

    const res = await join(b.token, ws.id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "active" });
    expect((await board(b.token, ws.id)).json().workspace.memberCount).toBe(2);
  });

  it("private: pending until the owner approves, then the board opens", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token, "Closed Club", false);
    const b = await login("code-b");

    expect((await join(b.token, ws.id)).json()).toEqual({ status: "pending" });
    const denied = await board(b.token, ws.id);
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe("PENDING_APPROVAL");

    const owner = await board(a.token, ws.id);
    expect(owner.json().me.pendingCount).toBe(1);

    const ok = await app.inject({ method: "POST", url: `/workspaces/${ws.id}/members/${b.user.id}/approve`, headers: a.headers });
    expect(ok.statusCode).toBe(204);
    expect((await board(b.token, ws.id)).statusCode).toBe(200);
  });

  it("a non-member cannot read the board", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    const res = await board(b.token, ws.id);
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("NOT_MEMBER");
  });
});

describe("owner permissions", () => {
  it("a plain member cannot list members, change settings or delete matches", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    await join(b.token, ws.id);
    const rec = await play(b.token, ws.id, a.user.id, "win");
    const matchId = rec.json().match.id as number;

    for (const res of [
      await app.inject({ method: "GET", url: `/workspaces/${ws.id}/members`, headers: b.headers }),
      await app.inject({ method: "PATCH", url: `/workspaces/${ws.id}`, headers: b.headers, payload: { isPublic: false } }),
      await app.inject({ method: "DELETE", url: `/workspaces/${ws.id}/members/${a.user.id}`, headers: b.headers }),
      await app.inject({ method: "DELETE", url: `/workspaces/${ws.id}/matches/${matchId}`, headers: b.headers }),
    ]) {
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe("FORBIDDEN");
    }
  });

  it("removing a member drops them from the board and blocks their matches", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    await join(b.token, ws.id);

    const kick = await app.inject({ method: "DELETE", url: `/workspaces/${ws.id}/members/${b.user.id}`, headers: a.headers });
    expect(kick.statusCode).toBe(204);

    expect((await board(a.token, ws.id)).json().workspace.memberCount).toBe(1);
    expect((await board(b.token, ws.id)).statusCode).toBe(403);
    const blocked = await play(b.token, ws.id, a.user.id, "win");
    expect(blocked.statusCode).toBe(403);
    // Rejoining a public workspace still needs approval
    expect((await join(b.token, ws.id)).json()).toEqual({ status: "pending" });
  });

  it("the owner can rename and switch public/private", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token, "Old Club", true);
    const res = await app.inject({
      method: "PATCH",
      url: `/workspaces/${ws.id}`,
      headers: a.headers,
      payload: { name: "New Club", isPublic: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().workspace).toMatchObject({ name: "New Club", isPublic: false });

    const b = await login("code-b");
    expect((await join(b.token, ws.id)).json()).toEqual({ status: "pending" });
  });

  it("a server admin can delete matches in any workspace", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    await join(b.token, ws.id);
    const rec = await play(a.token, ws.id, b.user.id, "win");
    const matchId = rec.json().match.id as number;

    const admin = await login("code-admin");
    expect(admin.user.isServerAdmin).toBe(true);
    const res = await app.inject({ method: "DELETE", url: `/workspaces/${ws.id}/matches/${matchId}`, headers: admin.headers });
    expect(res.statusCode).toBe(204);
    expect((await board(a.token, ws.id)).json().me.points).toBe(1000);
  });

  it("leaving and rejoining a public workspace needs no approval and keeps the points", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    await join(b.token, ws.id);
    await play(a.token, ws.id, b.user.id, "win"); // B drops to 980

    const left = await app.inject({ method: "POST", url: `/workspaces/${ws.id}/leave`, headers: b.headers });
    expect(left.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/me", headers: b.headers })).json().workspaces).toEqual([]);

    expect((await join(b.token, ws.id)).json()).toEqual({ status: "active" });
    expect((await board(b.token, ws.id)).json().me).toMatchObject({ points: 980, losses: 1 });
  });

  it("the owner cannot leave their own workspace", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const res = await app.inject({ method: "POST", url: `/workspaces/${ws.id}/leave`, headers: a.headers });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("OWNER_CANNOT_LEAVE");
  });
});

describe("recording matches", () => {
  it("returns the updated board", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    await join(b.token, ws.id);

    const res = await play(a.token, ws.id, b.user.id, "win");
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({
      match: { winnerId: a.user.id, loserId: b.user.id, workspaceId: ws.id },
      me: { points: 1020, wins: 1, matchesToday: 1, rank: 1 },
    });
    expect(res.json().players.map((p: { name: string; points: number }) => [p.name, p.points])).toEqual([
      ["Alice", 1020],
      ["Bob", 980],
    ]);
  });

  it("cannot record against someone from another workspace", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    const res = await play(a.token, ws.id, b.user.id, "win");
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("OPPONENT_NOT_FOUND");
  });

  it("the per-pair limit is tracked per workspace", async () => {
    const a = await login("code-a");
    const b = await login("code-b");
    const w1 = await makeWs(a.token, "Club One");
    const w2 = await makeWs(a.token, "Club Two");
    await join(b.token, w1.id);
    await join(b.token, w2.id);

    for (let i = 0; i < 3; i++) await play(a.token, w1.id, b.user.id, "win");
    const blocked = await play(a.token, w1.id, b.user.id, "win");
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe("DAILY_LIMIT_REACHED");

    const other = await play(a.token, w2.id, b.user.id, "win");
    expect(other.statusCode).toBe(201);
    expect(other.json().me).toMatchObject({ points: 1020, matchesToday: 1 });
    expect((await board(a.token, w1.id)).json().me.points).toBe(1060);
  });

  it("running out against one person still allows recording with another", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    const c = await login("code-c");
    await join(b.token, ws.id);
    await join(c.token, ws.id);

    for (let i = 0; i < 3; i++) await play(a.token, ws.id, b.user.id, "win");
    const blocked = await play(a.token, ws.id, b.user.id, "win");
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.message).toContain("You can still play anyone else");

    // This is exactly the hole in the old rule: B against C must still work
    expect((await play(b.token, ws.id, c.user.id, "win")).statusCode).toBe(201);
    expect((await play(a.token, ws.id, c.user.id, "win")).statusCode).toBe(201);
  });

  it("the board carries each player's last match time", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    await join(b.token, ws.id);

    let players = (await board(a.token, ws.id)).json().players as Array<{ id: number; lastMatchAt: string | null }>;
    expect(players.every((p) => p.lastMatchAt === null)).toBe(true);

    await play(a.token, ws.id, b.user.id, "win");
    players = (await board(a.token, ws.id)).json().players;
    for (const p of players) expect(new Date(p.lastMatchAt!).toISOString()).toBe(clock.toISOString());
  });

  it("the board reports how many matches are left with each person", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    const b = await login("code-b");
    const c = await login("code-c");
    await join(b.token, ws.id);
    await join(c.token, ws.id);

    await play(a.token, ws.id, b.user.id, "win");
    const players = (await board(a.token, ws.id)).json().players as Array<{ id: number; remainingWithMe: number }>;
    const by = (id: number) => players.find((p) => p.id === id)!.remainingWithMe;
    expect(by(b.user.id)).toBe(2);
    expect(by(c.user.id)).toBe(3);
    expect(by(a.user.id)).toBe(0); // you never play yourself
  });

  it("a malformed payload returns 400", async () => {
    const a = await login("code-a");
    const ws = await makeWs(a.token);
    for (const payload of [{ opponentId: 2, result: "draw" }, { result: "win" }, { opponentId: "2", result: "win" }]) {
      const res = await app.inject({ method: "POST", url: `/workspaces/${ws.id}/matches`, headers: a.headers, payload });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe("VALIDATION");
    }
  });

  it("match history is separate per workspace", async () => {
    const a = await login("code-a");
    const b = await login("code-b");
    const w1 = await makeWs(a.token, "Club One");
    const w2 = await makeWs(a.token, "Club Two");
    await join(b.token, w1.id);
    await join(b.token, w2.id);
    await play(a.token, w1.id, b.user.id, "win");

    const m1 = await app.inject({ method: "GET", url: `/workspaces/${w1.id}/matches`, headers: a.headers });
    const m2 = await app.inject({ method: "GET", url: `/workspaces/${w2.id}/matches`, headers: a.headers });
    expect(m1.json().matches).toHaveLength(1);
    expect(m2.json().matches).toEqual([]);
  });
});

describe("health", () => {
  it("needs no sign-in", async () => {
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });
});

describe("server version", () => {
  it("every response carries the x-app-version header", async () => {
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.headers["x-app-version"]).toBeTruthy();

    const a = await login("code-a");
    const me = await app.inject({ method: "GET", url: "/me", headers: a.headers });
    expect(me.headers["x-app-version"]).toBe(health.headers["x-app-version"]);
  });
});

describe("rate limiting", () => {
  it("hammering sign-in is blocked with 429", async () => {
    const limited = await buildApp({
      db,
      discord: fakeDiscord,
      adminDiscordIds: [],
      allowedRedirectUris: [REDIRECT],
      logger: false,
      limits: { windowMs: 60_000, perWindow: 100, authPerWindow: 3, writePerWindow: 100, streamsPerUser: 5 },
    });
    await limited.ready();

    const attempt = () =>
      limited.inject({ method: "POST", url: "/auth/discord", payload: { code: "code-a", redirectUri: REDIRECT } });

    for (let i = 0; i < 3; i++) expect((await attempt()).statusCode).toBe(200);

    const blocked = await attempt();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error).toMatchObject({ code: "RATE_LIMITED" });

    await limited.close();
  });
});
