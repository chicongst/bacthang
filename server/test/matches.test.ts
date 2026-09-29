import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type pg from "pg";
import type { Db } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { deleteMatch, recentMatches, recordMatch, matchesToday, matchesTodayBetween } from "../src/services/matches.js";
import { AppError } from "../src/errors.js";
import { makeClub, makeUser, makeWorkspace, memberOf, openTestDb, resetDb } from "./helpers.js";

let db: Db;
let pool: pg.Pool;

beforeAll(async () => ({ db, pool } = await openTestDb()));
afterAll(async () => pool.end());
beforeEach(async () => resetDb(db));

async function club(names: string[]) {
  const c = await makeClub(db, names);
  ws = c.ws;
  return c;
}

let ws: { id: number };
const pointsOf = (userId: number) => memberOf(db, ws.id, userId);

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
}

// 2026-09-17 20:00 giờ VN
const EVENING = new Date("2026-09-17T13:00:00Z");

describe("recordMatch", () => {
  it("người ghi thắng: +20 cho mình, −20 cho đối thủ", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;

    const m = await recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: b.id, result: "win", now: EVENING });

    expect(m).toMatchObject({ winnerId: a.id, loserId: b.id, reportedBy: a.id, winnerDelta: 20, loserDelta: -20 });
    expect(await pointsOf(a.id)).toMatchObject({ points: 1020, wins: 1, losses: 0 });
    expect(await pointsOf(b.id)).toMatchObject({ points: 980, wins: 0, losses: 1 });
  });

  it("người ghi thua: đối thủ là người thắng", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;

    const m = await recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: b.id, result: "loss", now: EVENING });

    expect(m).toMatchObject({ winnerId: b.id, loserId: a.id, reportedBy: a.id });
    expect((await pointsOf(a.id)).points).toBe(980);
    expect((await pointsOf(b.id)).points).toBe(1020);
  });

  it("không tự đấu với chính mình", async () => {
    const a = await makeUser(db, "A");
    await expectCode(recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: a.id, result: "win", now: EVENING }), "SELF_MATCH");
  });

  it("đối thủ không ở trong workspace", async () => {
    const { people } = await club(["A", "B"]);
    const outsider = await makeUser(db, "NguoiNgoai");
    await expectCode(
      recordMatch(db, { workspaceId: ws.id, reporterId: people.A!.id, opponentId: outsider.id, result: "win", now: EVENING }),
      "OPPONENT_NOT_FOUND",
    );
  });

  it("người ghi không còn trong workspace thì bị chặn", async () => {
    const { people } = await club(["A", "B"]);
    const outsider = await makeUser(db, "NguoiNgoai2");
    await expectCode(
      recordMatch(db, { workspaceId: ws.id, reporterId: outsider.id, opponentId: people.A!.id, result: "win", now: EVENING }),
      "NOT_MEMBER",
    );
  });

  it("cùng một cặp chỉ đánh được 3 trận mỗi ngày", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: b.id, result: "win", now: EVENING });
    }
    await expectCode(
      recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: b.id, result: "win", now: EVENING }),
      "DAILY_LIMIT_REACHED",
    );
    expect((await pointsOf(a.id)).points).toBe(1060);
  });

  it("đủ lượt với người này vẫn đánh được với người khác", async () => {
    const { people } = await club(["A", "B", "C"]);
    const a = people.A!, b = people.B!, c = people.C!;
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: b.id, result: "win", now: EVENING });
    }
    // A–B hết lượt, nhưng A–C và B–C thì chưa
    await recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: c.id, result: "win", now: EVENING });
    await recordMatch(db, { workspaceId: ws.id, reporterId: b.id, opponentId: c.id, result: "win", now: EVENING });

    expect((await pointsOf(a.id)).points).toBe(1080);
    expect((await pointsOf(b.id)).points).toBe(960);
    expect((await pointsOf(c.id)).points).toBe(960);
    expect(await matchesToday(db, ws.id, a.id, EVENING)).toBe(4);
    expect(await matchesTodayBetween(db, ws.id, a.id, c.id, EVENING)).toBe(1);
  });

  it("đổi vai người ghi cũng vẫn là một cặp", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;
    await recordMatch(db, { workspaceId: ws.id, reporterId: a.id, opponentId: b.id, result: "win", now: EVENING });
    await recordMatch(db, { workspaceId: ws.id, reporterId: b.id, opponentId: a.id, result: "win", now: EVENING });
    await recordMatch(db, { workspaceId: ws.id, reporterId: b.id, opponentId: a.id, result: "loss", now: EVENING });
    await expectCode(
      recordMatch(db, { workspaceId: ws.id, reporterId: b.id, opponentId: a.id, result: "win", now: EVENING }),
      "DAILY_LIMIT_REACHED",
    );
  });


  it("qua 00:00 giờ VN thì được đánh lại", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;
    const lastMinute = new Date("2026-09-17T16:59:30Z"); // 23:59:30 giờ VN
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: lastMinute });
    }
    await expectCode(recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: lastMinute }), "DAILY_LIMIT_REACHED");

    const midnight = new Date("2026-09-17T17:00:00Z"); // 00:00 giờ VN ngày 18
    await recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: midnight });
    expect(await matchesToday(db, ws.id, a!.id, midnight)).toBe(1);
  });

  it("8 request song song cùng một cặp chỉ ghi được đúng 3 trận", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: EVENING })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect((await pointsOf(a!.id)).points).toBe(1060);
    expect((await pointsOf(b!.id)).points).toBe(940);
  });

  it("hai người ghi chéo nhau song song không bị deadlock", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        i % 2 === 0
          ? recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: EVENING })
          : recordMatch(db, { workspaceId: ws.id, reporterId: b!.id, opponentId: a!.id, result: "win", now: EVENING }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });
});

describe("deleteMatch", () => {
  it("hoàn lại điểm, số trận thắng/thua, và lượt trong ngày", async () => {
    const { people } = await club(["A", "B", "Admin"]);
    const a = people.A!, b = people.B!, admin = people.Admin!;
    const m = await recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: EVENING });

    await deleteMatch(db, { workspaceId: ws.id, matchId: m.id, deletedBy: admin!.id, now: EVENING });

    expect(await pointsOf(a!.id)).toMatchObject({ points: 1000, wins: 0 });
    expect(await pointsOf(b!.id)).toMatchObject({ points: 1000, losses: 0 });
    expect(await matchesToday(db, ws.id, a!.id, EVENING)).toBe(0);
    expect(await recentMatches(db, ws.id, 30)).toHaveLength(0);
  });

  it("xóa hai lần thì lần hai báo không tìm thấy, điểm không bị trừ thêm", async () => {
    const { people } = await club(["A", "B", "Admin"]);
    const a = people.A!, b = people.B!, admin = people.Admin!;
    const m = await recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: EVENING });
    await deleteMatch(db, { workspaceId: ws.id, matchId: m.id, deletedBy: admin!.id, now: EVENING });
    await expectCode(deleteMatch(db, { workspaceId: ws.id, matchId: m.id, deletedBy: admin!.id, now: EVENING }), "NOT_FOUND");
    expect((await pointsOf(a!.id)).points).toBe(1000);
  });

  it("hoàn theo điểm đã lưu trong trận, không theo hằng số hiện tại", async () => {
    const { people } = await club(["A", "B", "Admin"]);
    const a = people.A!, b = people.B!, admin = people.Admin!;
    const m = await recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: EVENING });
    // Giả lập trận ghi theo luật cũ (+25 / −5)
    const { matches } = await import("../src/db/schema.js");
    await db.update(matches).set({ winnerDelta: 25, loserDelta: -5 }).where(eq(matches.id, m.id));

    await deleteMatch(db, { workspaceId: ws.id, matchId: m.id, deletedBy: admin!.id, now: EVENING });
    expect((await pointsOf(a!.id)).points).toBe(1020 - 25);
    expect((await pointsOf(b!.id)).points).toBe(980 + 5);
  });
});

describe("recentMatches", () => {
  it("trả về trận mới nhất trước, kèm tên hai người", async () => {
    const { people } = await club(["A", "B"]);
    const a = people.A!, b = people.B!;
    await recordMatch(db, { workspaceId: ws.id, reporterId: a!.id, opponentId: b!.id, result: "win", now: new Date("2026-09-17T10:00:00Z") });
    await recordMatch(db, { workspaceId: ws.id, reporterId: b!.id, opponentId: a!.id, result: "win", now: new Date("2026-09-17T11:00:00Z") });

    const list = await recentMatches(db, ws.id, 30);
    expect(list.map((m) => m.winner.name)).toEqual(["B", "A"]);
    expect(list[0]).toMatchObject({ loser: { name: "A" }, reportedBy: { name: "B" } });
  });
});
