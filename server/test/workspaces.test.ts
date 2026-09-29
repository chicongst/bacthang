import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type pg from "pg";
import type { Db } from "../src/db/client.js";
import { AppError } from "../src/errors.js";
import { recordMatch, matchesToday } from "../src/services/matches.js";
import { createWorkspace, searchWorkspaces, updateWorkspace } from "../src/services/workspaces.js";
import { approveMember, joinWorkspace, leaveWorkspace, listMembers, myWorkspaces, removeMember, requireMember, requireOwner } from "../src/services/memberships.js";
import { getBoard } from "../src/services/board.js";
import { addMember, makeUser, makeWorkspace, memberOf, openTestDb, resetDb } from "./helpers.js";
import { MAX_WORKSPACES_PER_OWNER } from "../src/domain/rules.js";

let db: Db;
let pool: pg.Pool;

beforeAll(async () => ({ db, pool } = await openTestDb()));
afterAll(async () => pool.end());
beforeEach(async () => resetDb(db));

const EVENING = new Date("2026-09-17T13:00:00Z");

async function expectCode(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
}

describe("tạo workspace", () => {
  it("người tạo thành owner và là thành viên đầu tiên, 1000 điểm", async () => {
    const u = await makeUser(db, "Chủ");
    const ws = await createWorkspace(db, { name: "CLB Quận 1", isPublic: true, ownerId: u.id });

    expect(ws).toMatchObject({ name: "CLB Quận 1", isPublic: true, ownerId: u.id });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ role: "owner", status: "active", points: 1000 });
    await expect(requireOwner(db, ws.id, u.id, false)).resolves.toBeUndefined();
  });

  it("tên quá ngắn hoặc quá dài đều bị từ chối", async () => {
    const u = await makeUser(db, "Chủ");
    await expectCode(createWorkspace(db, { name: "A", isPublic: true, ownerId: u.id }), "VALIDATION");
    await expectCode(createWorkspace(db, { name: "x".repeat(41), isPublic: true, ownerId: u.id }), "VALIDATION");
  });

  it("tự cắt khoảng trắng thừa ở tên", async () => {
    const u = await makeUser(db, "Chủ");
    const ws = await createWorkspace(db, { name: "  CLB Bida  ", isPublic: true, ownerId: u.id });
    expect(ws.name).toBe("CLB Bida");
  });
});

describe("tham gia", () => {
  it("workspace public: vào được ngay", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Khách");

    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "active" });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ status: "active", role: "member", points: 1000 });
  });

  it("workspace private: phải chờ owner duyệt", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: false });
    const u = await makeUser(db, "Khách");

    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
    await expectCode(requireMember(db, ws.id, u.id), "PENDING_APPROVAL");
    await expectCode(getBoard(db, { workspaceId: ws.id, userId: u.id, now: EVENING }), "PENDING_APPROVAL");

    await approveMember(db, { workspaceId: ws.id, userId: u.id });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ status: "active" });
    await expect(requireMember(db, ws.id, u.id)).resolves.toMatchObject({ status: "active" });
  });

  it("xin vào hai lần vẫn chỉ là một yêu cầu", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: false });
    const u = await makeUser(db, "Khách");
    await joinWorkspace(db, { workspaceId: ws.id, userId: u.id });
    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
    expect((await listMembers(db, ws.id)).filter((m) => m.status === "pending")).toHaveLength(1);
  });

  it("duyệt người không hề xin vào thì báo không tìm thấy", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Khách");
    await expectCode(approveMember(db, { workspaceId: ws.id, userId: u.id }), "NOT_FOUND");
  });

  it("workspace không tồn tại", async () => {
    const u = await makeUser(db, "Khách");
    await expectCode(joinWorkspace(db, { workspaceId: 9999, userId: u.id }), "WORKSPACE_NOT_FOUND");
  });
});

describe("đuổi thành viên", () => {
  it("bị đuổi thì mất khỏi bảng và không ghi trận được nữa", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Khách");
    await addMember(db, ws.id, u.id);

    await removeMember(db, { workspaceId: ws.id, userId: u.id, actorId: owner.id });

    expect((await getBoard(db, { workspaceId: ws.id, userId: owner.id, now: EVENING })).players).toHaveLength(1);
    await expectCode(requireMember(db, ws.id, u.id), "NOT_MEMBER");
    await expectCode(
      recordMatch(db, { workspaceId: ws.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING }),
      "NOT_MEMBER",
    );
    expect(await myWorkspaces(db, u.id)).toHaveLength(0);
  });

  it("bị đuổi khỏi workspace public thì vào lại vẫn phải xin duyệt", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Khách");
    await addMember(db, ws.id, u.id);
    await removeMember(db, { workspaceId: ws.id, userId: u.id, actorId: owner.id });

    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
  });

  it("không đuổi được owner", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id);
    await expectCode(removeMember(db, { workspaceId: ws.id, userId: owner.id, actorId: owner.id }), "OWNER_CANNOT_LEAVE");
  });

  it("bị đuổi rồi được duyệt vào lại thì điểm cũ giữ nguyên", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Khách");
    await addMember(db, ws.id, u.id);
    await recordMatch(db, { workspaceId: ws.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING });
    expect((await memberOf(db, ws.id, u.id)).points).toBe(1020);

    await removeMember(db, { workspaceId: ws.id, userId: u.id, actorId: owner.id });
    await joinWorkspace(db, { workspaceId: ws.id, userId: u.id });
    await approveMember(db, { workspaceId: ws.id, userId: u.id });

    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ points: 1020, wins: 1, losses: 0 });
  });
});

describe("rời nhóm không xóa được điểm", () => {
  it("thua rồi tự rời, vào lại workspace public vẫn giữ nguyên điểm đã mất", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Khách");
    await addMember(db, ws.id, u.id);

    // thua 3 trận: 1000 − 60 = 940
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: u.id, opponentId: owner.id, result: "loss", now: EVENING });
    }
    expect((await memberOf(db, ws.id, u.id)).points).toBe(940);

    await leaveWorkspace(db, { workspaceId: ws.id, userId: u.id });
    expect(await myWorkspaces(db, u.id)).toHaveLength(0);
    await expectCode(requireMember(db, ws.id, u.id), "NOT_MEMBER");

    // vào lại workspace public: không cần duyệt, nhưng điểm cũ đi theo
    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "active" });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ points: 940, wins: 0, losses: 3 });
  });

  it("lượt đã dùng với một người cũng không mất khi rời rồi vào lại", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Khách");
    await addMember(db, ws.id, u.id);
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: u.id, opponentId: owner.id, result: "loss", now: EVENING });
    }
    await leaveWorkspace(db, { workspaceId: ws.id, userId: u.id });
    await joinWorkspace(db, { workspaceId: ws.id, userId: u.id });

    await expectCode(
      recordMatch(db, { workspaceId: ws.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING }),
      "DAILY_LIMIT_REACHED",
    );
  });
});

describe("phân quyền", () => {
  it("thành viên thường không phải owner", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Khách");
    await addMember(db, ws.id, u.id);
    await expectCode(requireOwner(db, ws.id, u.id, false), "FORBIDDEN");
  });

  it("người ngoài không xem được bảng", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id);
    const outsider = await makeUser(db, "NgoàiCuộc");
    await expectCode(getBoard(db, { workspaceId: ws.id, userId: outsider.id, now: EVENING }), "NOT_MEMBER");
  });

  it("admin máy chủ có quyền như owner ở mọi workspace", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id);
    const admin = await makeUser(db, "AdminMáyChủ");
    await expect(requireOwner(db, ws.id, admin.id, true)).resolves.toBeUndefined();
  });

  it("đổi tên và đổi public/private", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const updated = await updateWorkspace(db, { workspaceId: ws.id, name: "CLB Mới", isPublic: false });
    expect(updated).toMatchObject({ name: "CLB Mới", isPublic: false });

    const u = await makeUser(db, "Khách");
    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
  });
});

describe("tìm workspace", () => {
  it("tìm không phân biệt hoa thường, kèm số thành viên và trạng thái của tôi", async () => {
    const owner = await makeUser(db, "Chủ");
    const a = await makeWorkspace(db, owner.id, { name: "CLB Quận 1" });
    await makeWorkspace(db, owner.id, { name: "Nhóm công ty" });
    const u = await makeUser(db, "Khách");
    await joinWorkspace(db, { workspaceId: a.id, userId: u.id });

    // gõ không dấu vẫn phải ra
    expect(await searchWorkspaces(db, { q: "quan", userId: u.id })).toHaveLength(1);
    expect(await searchWorkspaces(db, { q: "CLB", userId: u.id })).toHaveLength(1);
    const found = await searchWorkspaces(db, { q: "quận", userId: u.id });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "CLB Quận 1", memberCount: 2, myStatus: "active" });

    const all = await searchWorkspaces(db, { q: "", userId: u.id });
    expect(all).toHaveLength(2);
    expect(all.find((w) => w.name === "Nhóm công ty")).toMatchObject({ myStatus: null, memberCount: 1 });
  });
});

describe("tách biệt giữa các workspace", () => {
  it("điểm và giới hạn mỗi cặp tính riêng từng workspace", async () => {
    const owner = await makeUser(db, "Chủ");
    const u = await makeUser(db, "Khách");
    const w1 = await makeWorkspace(db, owner.id, { name: "CLB Một" });
    const w2 = await makeWorkspace(db, owner.id, { name: "CLB Hai" });
    await addMember(db, w1.id, u.id);
    await addMember(db, w2.id, u.id);

    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: w1.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING });
    }
    await expectCode(
      recordMatch(db, { workspaceId: w1.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING }),
      "DAILY_LIMIT_REACHED",
    );

    // Workspace kia vẫn còn nguyên lượt và điểm chưa đổi
    expect(await matchesToday(db, w2.id, u.id, EVENING)).toBe(0);
    expect((await memberOf(db, w2.id, u.id)).points).toBe(1000);
    expect((await memberOf(db, w1.id, u.id)).points).toBe(1060);

    await recordMatch(db, { workspaceId: w2.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING });
    expect((await memberOf(db, w2.id, u.id)).points).toBe(1020);

    const board2 = await getBoard(db, { workspaceId: w2.id, userId: u.id, now: EVENING });
    expect(board2.workspace.name).toBe("CLB Hai");
    expect(board2.me).toMatchObject({ points: 1020, rank: 1, matchesToday: 1 });
  });

  it("một người ở nhiều workspace, myWorkspaces trả về đủ", async () => {
    const owner = await makeUser(db, "Chủ");
    const u = await makeUser(db, "Khách");
    const w1 = await makeWorkspace(db, owner.id, { name: "CLB Một" });
    const w2 = await makeWorkspace(db, owner.id, { name: "CLB Hai" });
    await addMember(db, w1.id, u.id);
    await joinWorkspace(db, { workspaceId: w2.id, userId: u.id });

    const mine = await myWorkspaces(db, u.id);
    expect(mine.map((w) => w.name)).toEqual(["CLB Hai", "CLB Một"]);
    expect(mine[0]).toMatchObject({ role: "member", status: "active", tier: { id: "silver" } });
  });
});

describe("danh sách thành viên", () => {
  it("gồm cả người đang chờ duyệt, chủ workspace thấy được", async () => {
    const owner = await makeUser(db, "Chủ");
    const ws = await makeWorkspace(db, owner.id, { isPublic: false });
    const u = await makeUser(db, "Khách");
    await joinWorkspace(db, { workspaceId: ws.id, userId: u.id });

    const members = await listMembers(db, ws.id);
    expect(members.map((m) => [m.name, m.status, m.role])).toEqual([
      ["Chủ", "active", "owner"],
      ["Khách", "pending", "member"],
    ]);

    const board = await getBoard(db, { workspaceId: ws.id, userId: owner.id, now: EVENING });
    expect(board.me.pendingCount).toBe(1);
    expect(board.players).toHaveLength(1); // người chờ duyệt chưa lên bảng
  });
});

describe("chống spam", () => {
  it("một người không tạo quá số workspace cho phép", async () => {
    const u = await makeUser(db, "Chủ");
    for (let i = 0; i < MAX_WORKSPACES_PER_OWNER; i++) {
      await createWorkspace(db, { name: `CLB số ${i}`, isPublic: true, ownerId: u.id });
    }
    await expectCode(createWorkspace(db, { name: "CLB thừa", isPublic: true, ownerId: u.id }), "VALIDATION");
  });
});
