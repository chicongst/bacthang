// Dữ liệu mẫu chỉ dùng với Vite dev server khi mở popup.html?mock — không vào bản build.
import type { Account, Board, Member, Player, RecentMatch, Rules, SearchResult, Tier } from "./types.js";

const tier = (p: number): Tier =>
  p >= 1400 ? { id: "master", name: "Cao Thủ" }
  : p >= 1300 ? { id: "diamond", name: "Kim Cương" }
  : p >= 1200 ? { id: "platinum", name: "Bạch Kim" }
  : p >= 1100 ? { id: "gold", name: "Vàng" }
  : p >= 1000 ? { id: "silver", name: "Bạc" }
  : { id: "bronze", name: "Đồng" };

const hoursAgo = (h: number) => new Date(Date.UTC(2026, 8, 17, 14 - h, 40)).toISOString();

// điểm = 1000 + (thắng − thua) × 20; hai số cuối: giờ trước trận gần nhất, lượt còn lại với tôi
const raw: Array<[string, number, number, number, number, number]> = [
  ["Hoàng Long", 1520, 58, 32, 2, 3],
  ["Minh Khang", 1380, 47, 28, 5, 1],
  ["Quốc Bảo", 1240, 39, 27, 20, 3],
  ["Thanh Tùng", 1160, 30, 22, 1, 0],
  ["Đức Huy", 1120, 28, 22, 26, 2],
  ["Văn Nam", 1060, 19, 16, 3, 0],
  ["Gia Hân", 1020, 9, 8, 50, 3],
  ["Trọng Nhân", 980, 6, 7, 72, 3],
];

export const players: Player[] = raw.map(([name, points, wins, losses, ago, left], i) => ({
  rank: i + 1,
  id: i + 1,
  name,
  avatarUrl: null,
  points,
  wins,
  losses,
  role: i === 3 ? "owner" : "member",
  tier: tier(points),
  lastMatchAt: hoursAgo(ago),
  remainingWithMe: i === 3 ? 0 : left,
}));

const meRow = players[3]!;

const rules: Rules = {
  startPoints: 1000,
  winPoints: 20,
  lossPoints: -20,
  dailyLimitPerPair: 3,
  tiers: [
    { id: "bronze", name: "Đồng", minPoints: null },
    { id: "silver", name: "Bạc", minPoints: 1000 },
    { id: "gold", name: "Vàng", minPoints: 1100 },
    { id: "platinum", name: "Bạch Kim", minPoints: 1200 },
    { id: "diamond", name: "Kim Cương", minPoints: 1300 },
    { id: "master", name: "Cao Thủ", minPoints: 1400 },
  ],
};

export const board: Board = {
  workspace: { id: 1, name: "CLB Quận 1", isPublic: true, memberCount: players.length },
  me: {
    id: meRow.id,
    name: meRow.name,
    avatarUrl: null,
    points: meRow.points,
    wins: meRow.wins,
    losses: meRow.losses,
    rank: meRow.rank,
    tier: meRow.tier,
    role: "owner",
    matchesToday: 1,
    dailyLimitPerPair: 3,
    winPoints: 20,
    lossPoints: -20,
    pendingCount: 2,
  },
  players,
  rules,
};

export const account: Account = {
  id: meRow.id,
  name: meRow.name,
  avatarUrl: null,
  isServerAdmin: false,
  workspaces: [
    { id: 1, name: "CLB Quận 1", isPublic: true, role: "owner", status: "active", points: 1160, tier: tier(1160) },
    { id: 2, name: "Nhóm công ty", isPublic: false, role: "member", status: "active", points: 1020, tier: tier(1020) },
    { id: 3, name: "Giải phường 5", isPublic: false, role: "member", status: "pending", points: 1000, tier: tier(1000) },
  ],
};

export const members: Member[] = [
  ...players.map((p) => ({
    userId: p.id,
    name: p.name,
    avatarUrl: null,
    role: p.role,
    status: "active" as const,
    points: p.points,
    wins: p.wins,
    losses: p.losses,
    tier: p.tier,
  })),
  { userId: 90, name: "Bảo Ngọc", avatarUrl: null, role: "member", status: "pending", points: 1000, wins: 0, losses: 0, tier: tier(1000) },
  { userId: 91, name: "Khánh Vy", avatarUrl: null, role: "member", status: "pending", points: 1000, wins: 0, losses: 0, tier: tier(1000) },
];

const allWorkspaces: SearchResult[] = [
  { id: 1, name: "CLB Quận 1", isPublic: true, memberCount: 8, myStatus: "active", myRole: "owner" },
  { id: 2, name: "Nhóm công ty", isPublic: false, memberCount: 12, myStatus: "active", myRole: "member" },
  { id: 3, name: "Giải phường 5", isPublic: false, memberCount: 21, myStatus: "pending", myRole: null },
  { id: 4, name: "CLB Quận 7", isPublic: true, memberCount: 15, myStatus: null, myRole: null },
  { id: 5, name: "Bida Thứ Bảy", isPublic: true, memberCount: 6, myStatus: null, myRole: null },
  { id: 6, name: "Cầu lông Tân Bình", isPublic: false, memberCount: 9, myStatus: null, myRole: null },
];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export function searchResults(q: string): SearchResult[] {
  const f = fold(q.trim());
  return f ? allWorkspaces.filter((w) => fold(w.name).includes(f)) : allWorkspaces;
}

const at = (h: number, m: number) => new Date(Date.UTC(2026, 8, 17, h - 7, m)).toISOString();
export const recent: RecentMatch[] = [
  { id: 42, createdAt: at(21, 40), winnerDelta: 20, loserDelta: -20, winner: players[3]!, loser: players[5]!, reportedBy: players[3]! },
  { id: 41, createdAt: at(21, 5), winnerDelta: 20, loserDelta: -20, winner: players[0]!, loser: players[1]!, reportedBy: players[1]! },
  { id: 40, createdAt: at(20, 30), winnerDelta: 20, loserDelta: -20, winner: players[2]!, loser: players[7]!, reportedBy: players[2]! },
];
