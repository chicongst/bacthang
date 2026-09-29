import { vi } from "vitest";
import type { Api } from "@app/api.js";
import type { Platform } from "@app/platform.js";
import type { Account, Board, Player, RecentMatch } from "@app/types.js";

export function makePlayer(over: Partial<Player> = {}): Player {
  return {
    rank: 1,
    id: 1,
    name: "Player",
    avatarUrl: null,
    points: 1000,
    wins: 0,
    losses: 0,
    role: "member",
    tier: { id: "silver", name: "Silver" },
    lastMatchAt: null,
    remainingWithMe: 3,
    ...over,
  };
}

export function makeBoard(over: Partial<Board> = {}): Board {
  const me = makePlayer({ id: 1, name: "Me", role: "owner" });
  const rival = makePlayer({ id: 2, rank: 2, name: "Rival" });
  return {
    workspace: { id: 7, name: "Test Club", isPublic: true, memberCount: 2 },
    rules: {
      startPoints: 1000,
      winPoints: 20,
      lossPoints: -20,
      dailyLimitPerPair: 3,
      tiers: [{ id: "bronze", name: "Bronze", minPoints: null }],
    },
    me: {
      id: me.id,
      name: me.name,
      avatarUrl: null,
      points: me.points,
      wins: me.wins,
      losses: me.losses,
      rank: me.rank,
      tier: me.tier,
      role: "owner",
      matchesToday: 0,
      dailyLimitPerPair: 3,
      winPoints: 20,
      lossPoints: -20,
      pendingCount: 0,
    },
    players: [me, rival],
    ...over,
  };
}

export function makeAccount(over: Partial<Account> = {}): Account {
  return {
    id: 1,
    name: "Me",
    avatarUrl: null,
    isServerAdmin: false,
    workspaces: [
      { id: 7, name: "Test Club", isPublic: true, role: "owner", status: "active", points: 1000, tier: { id: "silver", name: "Silver" } },
    ],
    ...over,
  };
}

export interface Fake {
  platform: Platform;
  api: { [K in keyof Api]: ReturnType<typeof vi.fn> };
  activeWorkspace: number | null;
}

export function makePlatform(over: { board?: Board; account?: Account; recent?: RecentMatch[]; token?: string | null } = {}): Fake {
  const board = over.board ?? makeBoard();
  const account = over.account ?? makeAccount();
  let activeWorkspace: number | null = account.workspaces[0]?.id ?? null;
  let token = over.token === undefined ? "test-token" : over.token;

  const api = {
    base: "http://test",
    exchangeDiscordCode: vi.fn(),
    me: vi.fn(async () => account),
    search: vi.fn(async () => []),
    createWorkspace: vi.fn(async () => ({ id: 9 })),
    join: vi.fn(async () => ({ status: "active" as const })),
    leave: vi.fn(async () => undefined),
    board: vi.fn(async () => board),
    recent: vi.fn(async () => over.recent ?? []),
    record: vi.fn(async () => board),
    deleteMatch: vi.fn(async () => undefined),
    members: vi.fn(async () => []),
    approve: vi.fn(async () => undefined),
    removeMember: vi.fn(async () => undefined),
    updateWorkspace: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
  } as unknown as Fake["api"];

  const platform: Platform = {
    api: api as unknown as Api,
    boardName: "Bảng Xếp Hạng",
    isMock: true,
    onServerChanged: () => undefined,
    getToken: async () => token,
    onTokenChange: () => () => undefined,
    clearToken: async () => {
      token = null;
    },
    startLogin: async () => ({ ok: true }),
    getActiveWorkspace: async () => activeWorkspace,
    setActiveWorkspace: async (id) => {
      activeWorkspace = id;
    },
  };

  return {
    platform,
    api,
    get activeWorkspace() {
      return activeWorkspace;
    },
  };
}
