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

describe("creating a workspace", () => {
  it("the creator becomes owner and first member with 1000 points", async () => {
    const u = await makeUser(db, "Owner");
    const ws = await createWorkspace(db, { name: "Downtown Club", isPublic: true, ownerId: u.id });

    expect(ws).toMatchObject({ name: "Downtown Club", isPublic: true, ownerId: u.id });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ role: "owner", status: "active", points: 1000 });
    await expect(requireOwner(db, ws.id, u.id, false)).resolves.toBeUndefined();
  });

  it("names too short or too long are refused", async () => {
    const u = await makeUser(db, "Owner");
    await expectCode(createWorkspace(db, { name: "A", isPublic: true, ownerId: u.id }), "VALIDATION");
    await expectCode(createWorkspace(db, { name: "x".repeat(41), isPublic: true, ownerId: u.id }), "VALIDATION");
  });

  it("trims surrounding whitespace from the name", async () => {
    const u = await makeUser(db, "Owner");
    const ws = await createWorkspace(db, { name: "  Billiards Club  ", isPublic: true, ownerId: u.id });
    expect(ws.name).toBe("Billiards Club");
  });
});

describe("joining", () => {
  it("public workspace: joins immediately", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Guest");

    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "active" });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ status: "active", role: "member", points: 1000 });
  });

  it("private workspace: waits for the owner to approve", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: false });
    const u = await makeUser(db, "Guest");

    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
    await expectCode(requireMember(db, ws.id, u.id), "PENDING_APPROVAL");
    await expectCode(getBoard(db, { workspaceId: ws.id, userId: u.id, now: EVENING }), "PENDING_APPROVAL");

    await approveMember(db, { workspaceId: ws.id, userId: u.id });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ status: "active" });
    await expect(requireMember(db, ws.id, u.id)).resolves.toMatchObject({ status: "active" });
  });

  it("asking twice still creates one request", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: false });
    const u = await makeUser(db, "Guest");
    await joinWorkspace(db, { workspaceId: ws.id, userId: u.id });
    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
    expect((await listMembers(db, ws.id)).filter((m) => m.status === "pending")).toHaveLength(1);
  });

  it("approving someone who never asked reports not found", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Guest");
    await expectCode(approveMember(db, { workspaceId: ws.id, userId: u.id }), "NOT_FOUND");
  });

  it("workspace does not exist", async () => {
    const u = await makeUser(db, "Guest");
    await expectCode(joinWorkspace(db, { workspaceId: 9999, userId: u.id }), "WORKSPACE_NOT_FOUND");
  });
});

describe("removing members", () => {
  it("a removed member disappears from the board and cannot record matches", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Guest");
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

  it("someone removed from a public workspace still needs approval to return", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Guest");
    await addMember(db, ws.id, u.id);
    await removeMember(db, { workspaceId: ws.id, userId: u.id, actorId: owner.id });

    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
  });

  it("the owner cannot be removed", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id);
    await expectCode(removeMember(db, { workspaceId: ws.id, userId: owner.id, actorId: owner.id }), "OWNER_CANNOT_LEAVE");
  });

  it("a removed member who is approved back keeps their old points", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Guest");
    await addMember(db, ws.id, u.id);
    await recordMatch(db, { workspaceId: ws.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING });
    expect((await memberOf(db, ws.id, u.id)).points).toBe(1020);

    await removeMember(db, { workspaceId: ws.id, userId: u.id, actorId: owner.id });
    await joinWorkspace(db, { workspaceId: ws.id, userId: u.id });
    await approveMember(db, { workspaceId: ws.id, userId: u.id });

    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ points: 1020, wins: 1, losses: 0 });
  });
});

describe("leaving cannot wipe points", () => {
  it("losing then leaving and rejoining a public workspace keeps the lost points", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Guest");
    await addMember(db, ws.id, u.id);

    // three losses: 1000 - 60 = 940
    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: ws.id, reporterId: u.id, opponentId: owner.id, result: "loss", now: EVENING });
    }
    expect((await memberOf(db, ws.id, u.id)).points).toBe(940);

    await leaveWorkspace(db, { workspaceId: ws.id, userId: u.id });
    expect(await myWorkspaces(db, u.id)).toHaveLength(0);
    await expectCode(requireMember(db, ws.id, u.id), "NOT_MEMBER");

    // rejoining a public workspace needs no approval, but the old points come along
    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "active" });
    expect(await memberOf(db, ws.id, u.id)).toMatchObject({ points: 940, wins: 0, losses: 3 });
  });

  it("the budget used against a person survives leaving and rejoining", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const u = await makeUser(db, "Guest");
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

describe("permissions", () => {
  it("a plain member is not the owner", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id);
    const u = await makeUser(db, "Guest");
    await addMember(db, ws.id, u.id);
    await expectCode(requireOwner(db, ws.id, u.id, false), "FORBIDDEN");
  });

  it("an outsider cannot read the board", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id);
    const outsider = await makeUser(db, "Outsider");
    await expectCode(getBoard(db, { workspaceId: ws.id, userId: outsider.id, now: EVENING }), "NOT_MEMBER");
  });

  it("a server admin has owner rights in every workspace", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id);
    const admin = await makeUser(db, "ServerAdmin");
    await expect(requireOwner(db, ws.id, admin.id, true)).resolves.toBeUndefined();
  });

  it("renaming and switching public/private", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: true });
    const updated = await updateWorkspace(db, { workspaceId: ws.id, name: "New Club", isPublic: false });
    expect(updated).toMatchObject({ name: "New Club", isPublic: false });

    const u = await makeUser(db, "Guest");
    expect(await joinWorkspace(db, { workspaceId: ws.id, userId: u.id })).toEqual({ status: "pending" });
  });
});

describe("searching workspaces", () => {
  it("search ignores case and returns member count and my status", async () => {
    const owner = await makeUser(db, "Owner");
    // Keeps a Vietnamese name on purpose: this is what accent folding is for.
    const a = await makeWorkspace(db, owner.id, { name: "CLB Quận 1" });
    await makeWorkspace(db, owner.id, { name: "Company Group" });
    const u = await makeUser(db, "Guest");
    await joinWorkspace(db, { workspaceId: a.id, userId: u.id });

    // typing without accents must still match
    expect(await searchWorkspaces(db, { q: "quan", userId: u.id })).toHaveLength(1);
    expect(await searchWorkspaces(db, { q: "CLB", userId: u.id })).toHaveLength(1);
    const found = await searchWorkspaces(db, { q: "quận", userId: u.id });
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "CLB Quận 1", memberCount: 2, myStatus: "active" });

    const all = await searchWorkspaces(db, { q: "", userId: u.id });
    expect(all).toHaveLength(2);
    expect(all.find((w) => w.name === "Company Group")).toMatchObject({ myStatus: null, memberCount: 1 });
  });
});

describe("isolation between workspaces", () => {
  it("points and the per-pair limit are tracked per workspace", async () => {
    const owner = await makeUser(db, "Owner");
    const u = await makeUser(db, "Guest");
    const w1 = await makeWorkspace(db, owner.id, { name: "Club One" });
    const w2 = await makeWorkspace(db, owner.id, { name: "Club Two" });
    await addMember(db, w1.id, u.id);
    await addMember(db, w2.id, u.id);

    for (let i = 0; i < 3; i++) {
      await recordMatch(db, { workspaceId: w1.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING });
    }
    await expectCode(
      recordMatch(db, { workspaceId: w1.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING }),
      "DAILY_LIMIT_REACHED",
    );

    // The other workspace still has its full budget and unchanged points
    expect(await matchesToday(db, w2.id, u.id, EVENING)).toBe(0);
    expect((await memberOf(db, w2.id, u.id)).points).toBe(1000);
    expect((await memberOf(db, w1.id, u.id)).points).toBe(1060);

    await recordMatch(db, { workspaceId: w2.id, reporterId: u.id, opponentId: owner.id, result: "win", now: EVENING });
    expect((await memberOf(db, w2.id, u.id)).points).toBe(1020);

    const board2 = await getBoard(db, { workspaceId: w2.id, userId: u.id, now: EVENING });
    expect(board2.workspace.name).toBe("Club Two");
    expect(board2.me).toMatchObject({ points: 1020, rank: 1, matchesToday: 1 });
  });

  it("a user in several workspaces gets all of them from myWorkspaces", async () => {
    const owner = await makeUser(db, "Owner");
    const u = await makeUser(db, "Guest");
    const w1 = await makeWorkspace(db, owner.id, { name: "Club One" });
    const w2 = await makeWorkspace(db, owner.id, { name: "Club Two" });
    await addMember(db, w1.id, u.id);
    await joinWorkspace(db, { workspaceId: w2.id, userId: u.id });

    const mine = await myWorkspaces(db, u.id);
    expect(mine.map((w) => w.name)).toEqual(["Club One", "Club Two"]);
    expect(mine[0]).toMatchObject({ role: "member", status: "active", tier: { id: "silver" } });
  });
});

describe("member list", () => {
  it("includes pending requests, visible to the owner", async () => {
    const owner = await makeUser(db, "Owner");
    const ws = await makeWorkspace(db, owner.id, { isPublic: false });
    const u = await makeUser(db, "Guest");
    await joinWorkspace(db, { workspaceId: ws.id, userId: u.id });

    const members = await listMembers(db, ws.id);
    expect(members.map((m) => [m.name, m.status, m.role])).toEqual([
      ["Owner", "active", "owner"],
      ["Guest", "pending", "member"],
    ]);

    const board = await getBoard(db, { workspaceId: ws.id, userId: owner.id, now: EVENING });
    expect(board.me.pendingCount).toBe(1);
    expect(board.players).toHaveLength(1); // pending members are not on the board yet
  });
});

describe("spam limits", () => {
  it("a user cannot create more workspaces than allowed", async () => {
    const u = await makeUser(db, "Owner");
    for (let i = 0; i < MAX_WORKSPACES_PER_OWNER; i++) {
      await createWorkspace(db, { name: `Club ${i}`, isPublic: true, ownerId: u.id });
    }
    await expectCode(createWorkspace(db, { name: "One Too Many", isPublic: true, ownerId: u.id }), "VALIDATION");
  });
});
