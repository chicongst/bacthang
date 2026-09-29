import { generateKeyPairSync, sign } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import type { Db } from "../src/db/client.js";
import type { DiscordClient } from "../src/services/discord.js";
import { recordMatch } from "../src/services/matches.js";
import { discordPublicKey, MAX_SIGNATURE_AGE_MS } from "../src/discord/verify.js";
import { memberships, users } from "../src/db/schema.js";
import { makeClub, makeUser, makeWorkspace, memberOf, openTestDb, resetDb } from "./helpers.js";

const REDIRECT = "https://ranking.test/";

const keys = generateKeyPairSync("ed25519");
const publicKeyHex = keys.publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");

const discord: DiscordClient = { exchangeCode: () => Promise.reject(new Error("unused")) };

let db: Db;
let pool: pg.Pool;
let app: FastifyInstance;
let clock: Date;

beforeAll(async () => {
  ({ db, pool } = await openTestDb());
  app = await buildApp({
    db,
    discord,
    adminDiscordIds: [],
    allowedRedirectUris: [REDIRECT],
    now: () => clock,
    logger: false,
    limits: false,
    discordPublicKey: publicKeyHex,
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

type Option = { name: string; value?: string | number; focused?: boolean };

function post(body: string, headers: Record<string, string>) {
  return app.inject({
    method: "POST",
    url: "/discord/interactions",
    headers: { "content-type": "application/json", ...headers },
    payload: body,
  });
}

function signed(body: string, at: Date = clock) {
  const timestamp = String(Math.floor(at.getTime() / 1000));
  return {
    "x-signature-timestamp": timestamp,
    "x-signature-ed25519": sign(null, Buffer.from(timestamp + body, "utf8"), keys.privateKey).toString("hex"),
  };
}

const send = (payload: object, at?: Date) => {
  const body = JSON.stringify(payload);
  return post(body, signed(body, at));
};

const command = (name: string, discordId: string, options: Option[] = [], locale = "en-US") => ({
  type: 2,
  locale,
  data: { name, options },
  member: { user: { id: discordId } },
});

const content = (res: Awaited<ReturnType<typeof send>>) =>
  (res.json() as { data?: { content?: string } }).data?.content ?? "";
const isEphemeral = (res: Awaited<ReturnType<typeof send>>) =>
  ((res.json() as { data?: { flags?: number } }).data?.flags ?? 0) === 64;
const mentions = (res: Awaited<ReturnType<typeof send>>) =>
  (res.json() as { data?: { allowed_mentions?: { parse?: string[] } } }).data?.allowed_mentions;

const rename = (db: Db, userId: number, name: string) =>
  db.update(users).set({ name }).where(eq(users.id, userId));

describe("signature", () => {
  it("answers Discord's ping", async () => {
    const res = await send({ type: 1 });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ type: 1 });
  });

  it("rejects a request with no signature", async () => {
    const res = await post(JSON.stringify({ type: 1 }), {});
    expect(res.statusCode).toBe(401);
  });

  it("rejects a body changed after signing", async () => {
    const body = JSON.stringify({ type: 1 });
    const res = await post(JSON.stringify({ type: 2 }), signed(body));
    expect(res.statusCode).toBe(401);
  });

  it("rejects a signature older than the replay window", async () => {
    const stale = new Date(clock.getTime() - MAX_SIGNATURE_AGE_MS - 1000);
    const res = await send({ type: 1 }, stale);
    expect(res.statusCode).toBe(401);
  });

  it("rejects a signature that is not hex", async () => {
    const body = JSON.stringify({ type: 1 });
    const res = await post(body, { ...signed(body), "x-signature-ed25519": "z".repeat(128) });
    expect(res.statusCode).toBe(401);
  });

  it("refuses to start with a key that is not 32 bytes", () => {
    expect(() => discordPublicKey("abcd")).toThrow(/64-character hex/);
  });
});

describe("/win", () => {
  it("records the match, shows the new points and tells the room", async () => {
    const { ws, people } = await makeClub(db, ["A", "B"]);
    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-B" }]));

    expect(res.statusCode).toBe(200);
    expect(content(res)).toContain("**A** beat **B**");
    expect(content(res)).toContain("1000 → **1020** (+20)");
    expect(content(res)).toContain("2 more with B today");
    expect(isEphemeral(res)).toBe(false);
    expect(await memberOf(db, ws.id, people.B!.id)).toMatchObject({ points: 980, losses: 1 });
  });

  it("records a loss the other way round", async () => {
    await makeClub(db, ["A", "B"]);
    const res = await send(command("loss", "d-A", [{ name: "opponent", value: "d-B" }]));
    expect(content(res)).toContain("**B** beat **A**");
    expect(content(res)).toContain("1000 → **980** (-20)");
  });

  it("refuses once the pair has played their three matches today", async () => {
    const { ws, people } = await makeClub(db, ["A", "B"]);
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: people.A!.id, opponentId: people.B!.id, result: "win", now: clock });
    }
    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-B" }]));
    expect(content(res)).toContain("all 3 matches today");
    expect(isEphemeral(res)).toBe(true);
  });

  it("says the day is used up once the third match goes in", async () => {
    const { ws, people } = await makeClub(db, ["A", "B"]);
    for (let i = 0; i < 2; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: people.A!.id, opponentId: people.B!.id, result: "win", now: clock });
    }
    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-B" }]));
    expect(content(res)).toContain("No matches left with B today");
  });

  it("says so when the opponent has never signed in", async () => {
    await makeClub(db, ["A", "B"]);
    const res = await send(command("win", "d-A", [{ name: "opponent", value: "999" }]));
    expect(content(res)).toContain("has not signed in yet");
    expect(isEphemeral(res)).toBe(true);
  });

  it("refuses an opponent who is on another board", async () => {
    await makeClub(db, ["A", "B"]);
    const outsider = await makeUser(db, "C");
    await makeWorkspace(db, outsider.id, { name: "Other Club" });
    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-C" }]));
    expect(content(res)).toContain("not on this board");
  });
});

describe("identity", () => {
  it("points a stranger at the sign-in page", async () => {
    const res = await send(command("board", "not-a-user"));
    expect(content(res)).toContain(REDIRECT);
    expect(isEphemeral(res)).toBe(true);
  });

  it("points someone with no board at the sign-in page too", async () => {
    await makeUser(db, "Z");
    const res = await send(command("me", "d-Z"));
    expect(content(res)).toContain("not on a board yet");
    expect(content(res)).toContain(REDIRECT);
  });

  it("tells someone still waiting for approval, rather than that they have no board", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { name: "Private Club", isPublic: false });
    const waiting = await makeUser(db, "W");
    await db.insert(memberships).values({ workspaceId: ws.id, userId: waiting.id, status: "pending" });

    const res = await send(command("me", "d-W"));
    expect(content(res)).toContain("has not approved you yet");
    expect(content(res)).not.toContain("not on a board yet");
  });

  it("asks which board when someone is on more than one", async () => {
    const { people } = await makeClub(db, ["A", "B"]);
    await makeWorkspace(db, people.A!.id, { name: "Second Club" });
    const res = await send(command("board", "d-A"));
    expect(content(res)).toContain("several boards");
    expect(content(res)).toContain("Second Club");
  });

  it("uses the board given in the option", async () => {
    const { people } = await makeClub(db, ["A", "B"]);
    const second = await makeWorkspace(db, people.A!.id, { name: "Second Club" });
    const res = await send(command("board", "d-A", [{ name: "board", value: second.id }]));
    expect(content(res)).toContain("Second Club");
  });

  it("refuses a board the caller is not on", async () => {
    await makeClub(db, ["A", "B"]);
    const outsider = await makeUser(db, "C");
    const other = await makeWorkspace(db, outsider.id, { name: "Other Club" });
    const res = await send(command("board", "d-A", [{ name: "board", value: other.id }]));
    expect(content(res)).toContain("not on that board");
  });
});

describe("/board and /me", () => {
  it("lists the standings in rank order, only to the caller", async () => {
    const { ws, people } = await makeClub(db, ["A", "B", "C"]);
    await recordMatch(db, { workspaceId: ws.id, reporterId: people.B!.id, opponentId: people.C!.id, result: "win", now: clock });

    const res = await send(command("board", "d-A"));
    const text = content(res);
    expect(text).toContain("Test Club");
    expect(text).toContain("Season 1");
    expect(text.indexOf(" 1  B")).toBeLessThan(text.indexOf(" 3  C"));
    expect(isEphemeral(res)).toBe(true);
  });

  it("cuts a long board off and says how many are hidden", async () => {
    const names = Array.from({ length: 15 }, (_, i) => `P${String(i).padStart(2, "0")}`);
    await makeClub(db, names);
    const res = await send(command("board", "d-P00"));
    expect(content(res)).toContain("and 3 more");
  });

  it("shows rank, points and what is left today", async () => {
    await makeClub(db, ["A", "B"]);
    const res = await send(command("me", "d-A"));
    expect(content(res)).toContain("Rank #1");
    expect(content(res)).toContain("1000 points");
    expect(content(res)).toContain("Left today: B 3");
  });
});

describe("a name is whatever the player typed", () => {
  it("never lets a display name mention anyone", async () => {
    const { people } = await makeClub(db, ["A", "B"]);
    await rename(db, people.B!.id, "@everyone");

    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-B" }]));
    expect(isEphemeral(res)).toBe(false);
    expect(content(res)).toContain("@everyone");
    expect(mentions(res)).toEqual({ parse: [] });
  });

  it("escapes markdown in a name instead of rendering it", async () => {
    const { people } = await makeClub(db, ["A", "B"]);
    await rename(db, people.B!.id, "**Boss**");

    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-B" }]));
    expect(content(res)).toContain("\\*\\*Boss\\*\\*");
  });

  it("keeps a backtick in a name from closing the standings block", async () => {
    const { people } = await makeClub(db, ["A", "B"]);
    await rename(db, people.B!.id, "``` hi");

    const res = await send(command("board", "d-A"));
    expect(content(res).match(/```/g)).toHaveLength(2);
  });
});

describe("autocomplete", () => {
  it("offers the boards the caller is on, filtered by what they typed", async () => {
    const { people } = await makeClub(db, ["A", "B"]);
    await makeWorkspace(db, people.A!.id, { name: "Second Club" });
    const res = await send({
      type: 4,
      data: { name: "board", options: [{ name: "board", value: "sec", focused: true }] },
      member: { user: { id: "d-A" } },
    });
    expect(res.json()).toMatchObject({ type: 8, data: { choices: [{ name: "Second Club" }] } });
  });
});

describe("language", () => {
  it("answers in Vietnamese when Discord says the caller is Vietnamese", async () => {
    await makeClub(db, ["A", "B"]);
    const res = await send(command("me", "d-A", [], "vi"));
    expect(content(res)).toContain("Hạng #1");
    expect(content(res)).toContain("1000 điểm");
  });

  it("records a match in Vietnamese", async () => {
    await makeClub(db, ["A", "B"]);
    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-B" }], "vi"));
    expect(content(res)).toContain("**A** thắng **B**");
    expect(content(res)).toContain("hạng #1");
    expect(content(res)).toContain("Hôm nay còn 2 trận với B");
  });

  it("explains the daily limit in Vietnamese", async () => {
    const { ws, people } = await makeClub(db, ["A", "B"]);
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: people.A!.id, opponentId: people.B!.id, result: "win", now: clock });
    }
    const res = await send(command("win", "d-A", [{ name: "opponent", value: "d-B" }], "vi"));
    expect(content(res)).toContain("đã đánh đủ 3 trận");
  });

  it("uses Vietnamese for the board and for a board it cannot find", async () => {
    const { people } = await makeClub(db, ["A", "B"]);
    await makeWorkspace(db, people.A!.id, { name: "Second Club" });
    const asked = await send(command("board", "d-A", [], "vi"));
    expect(content(asked)).toContain("nhiều bảng");

    const missing = await send(command("board", "d-A", [{ name: "board", value: 9999 }], "vi"));
    expect(content(missing)).toContain("không ở trong bảng đó");
  });
});
