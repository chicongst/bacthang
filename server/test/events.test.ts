import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import type { Db } from "../src/db/client.js";
import { buildApp } from "../src/app.js";
import { EventBus } from "../src/events.js";
import type { DiscordClient, DiscordProfile } from "../src/services/discord.js";
import { AppError } from "../src/errors.js";
import { openTestDb, resetDb } from "./helpers.js";

describe("EventBus", () => {
  it("chỉ gửi cho đúng workspace và dừng khi hủy đăng ký", () => {
    const bus = new EventBus();
    const a: string[] = [];
    const b: string[] = [];
    const stop = bus.subscribe(1, (e) => a.push(e.scope));
    bus.subscribe(2, (e) => b.push(e.scope));

    bus.emit(1, "board");
    bus.emit(2, "members");
    expect(a).toEqual(["board"]);
    expect(b).toEqual(["members"]);

    stop();
    bus.emit(1, "board");
    expect(a).toEqual(["board"]);
    expect(bus.listenerCount(1)).toBe(0);
  });

  it("một người nghe lỗi không chặn người khác", () => {
    const bus = new EventBus();
    const ok: string[] = [];
    bus.subscribe(1, () => {
      throw new Error("hỏng");
    });
    bus.subscribe(1, (e) => ok.push(e.scope));
    bus.emit(1, "board");
    expect(ok).toEqual(["board"]);
    expect(bus.listenerCount(1)).toBe(1); // người lỗi bị loại
  });
});

const REDIRECT = "https://abcdefghijklmnop.chromiumapp.org/discord";
const profiles: Record<string, DiscordProfile> = {
  "code-a": { id: "111", name: "Anh A", avatarUrl: null },
  "code-b": { id: "222", name: "Bé B", avatarUrl: null },
};
const fakeDiscord: DiscordClient = {
  async exchangeCode(code) {
    const p = profiles[code];
    if (!p) throw new AppError("DISCORD_AUTH_FAILED", 401, "sai code");
    return p;
  },
};

describe("kênh sự kiện qua HTTP", () => {
  let db: Db;
  let pool: pg.Pool;
  let app: FastifyInstance;
  let base: string;

  beforeAll(async () => {
    ({ db, pool } = await openTestDb());
    app = await buildApp({
      db,
      discord: fakeDiscord,
      adminDiscordIds: [],
      allowedRedirectUris: [REDIRECT],
      logger: false,
    });
    await app.listen({ port: 0, host: "127.0.0.1" });
    const addr = app.server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });
  afterAll(async () => {
    await app.close();
    await pool.end();
  });
  beforeEach(async () => resetDb(db));

  async function login(code: string) {
    const res = await fetch(`${base}/auth/discord`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, redirectUri: REDIRECT }),
    });
    return (await res.json()) as { token: string; user: { id: number } };
  }

  it("người ngoài workspace không mở được kênh", async () => {
    const a = await login("code-a");
    const ws = await (
      await fetch(`${base}/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${a.token}` },
        body: JSON.stringify({ name: "CLB Quận 1", isPublic: false }),
      })
    ).json();
    const b = await login("code-b");

    const res = await fetch(`${base}/workspaces/${ws.workspace.id}/events`, {
      headers: { authorization: `Bearer ${b.token}` },
    });
    expect(res.status).toBe(403);
    await res.text();

    const noAuth = await fetch(`${base}/workspaces/${ws.workspace.id}/events`);
    expect(noAuth.status).toBe(401);
    await noAuth.text();
  });

  it("ghi trận thì người đang mở kênh nhận được sự kiện", async () => {
    const a = await login("code-a");
    const ws = (
      await (
        await fetch(`${base}/workspaces`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${a.token}` },
          body: JSON.stringify({ name: "CLB Quận 1", isPublic: true }),
        })
      ).json()
    ).workspace as { id: number };
    const b = await login("code-b");
    await fetch(`${base}/workspaces/${ws.id}/join`, { method: "POST", headers: { authorization: `Bearer ${b.token}` } });

    // B mở kênh và chờ
    const ctrl = new AbortController();
    const stream = await fetch(`${base}/workspaces/${ws.id}/events`, {
      headers: { authorization: `Bearer ${b.token}` },
      signal: ctrl.signal,
    });
    expect(stream.status).toBe(200);
    expect(stream.headers.get("content-type")).toContain("text/event-stream");

    const events: string[] = [];
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    const collect = (async () => {
      let buf = "";
      while (events.length === 0) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        for (const frame of buf.split("\n\n")) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (line) events.push(JSON.parse(line.slice(5).trim()).scope);
        }
      }
    })();

    // đợi kênh vào sổ rồi mới ghi trận
    await new Promise((r) => setTimeout(r, 150));
    const rec = await fetch(`${base}/workspaces/${ws.id}/matches`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${a.token}` },
      body: JSON.stringify({ opponentId: b.user.id, result: "win" }),
    });
    expect(rec.status).toBe(201);

    await Promise.race([collect, new Promise((_, rej) => setTimeout(() => rej(new Error("quá hạn chờ sự kiện")), 5000))]);
    expect(events).toContain("board");

    ctrl.abort();
    await collect.catch(() => undefined);
  });

  describe("trần số kênh mở", () => {
    it("mở quá số kênh cho phép thì bị từ chối", async () => {
      const capped = await buildApp({
        db,
        discord: fakeDiscord,
        adminDiscordIds: [],
        allowedRedirectUris: [REDIRECT],
        logger: false,
        limits: { windowMs: 60_000, perWindow: 1000, authPerWindow: 100, writePerWindow: 100, streamsPerUser: 1 },
      });
      await capped.listen({ port: 0, host: "127.0.0.1" });
      const addr = capped.server.address();
      const url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;

      const login = await fetch(`${url}/auth/discord`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: "code-a", redirectUri: REDIRECT }),
      }).then((r) => r.json() as Promise<{ token: string }>);

      const ws = await fetch(`${url}/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${login.token}` },
        body: JSON.stringify({ name: "CLB Kênh", isPublic: true }),
      }).then((r) => r.json() as Promise<{ workspace: { id: number } }>);

      const ctrl = new AbortController();
      const first = await fetch(`${url}/workspaces/${ws.workspace.id}/events`, {
        headers: { authorization: `Bearer ${login.token}` },
        signal: ctrl.signal,
      });
      expect(first.status).toBe(200);

      const second = await fetch(`${url}/workspaces/${ws.workspace.id}/events`, {
        headers: { authorization: `Bearer ${login.token}` },
      });
      expect(second.status).toBe(429);
      expect((await second.json()).error.code).toBe("TOO_MANY_STREAMS");

      ctrl.abort();
      await capped.close();
    });
  });
});
