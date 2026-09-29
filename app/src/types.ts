export type TierId = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";
export interface Tier {
  id: TierId;
  name: string;
}

export type Role = "owner" | "member";
export type MemberStatus = "active" | "pending" | "removed";
export type MatchResult = "win" | "loss";
export type Tab = "board" | "record" | "recent" | "group" | "rules";

export interface Account {
  id: number;
  name: string;
  avatarUrl: string | null;
  isServerAdmin: boolean;
  workspaces: WorkspaceSummary[];
}

export interface WorkspaceSummary {
  id: number;
  name: string;
  isPublic: boolean;
  role: Role;
  status: MemberStatus;
  points: number;
  tier: Tier;
}

export interface Player {
  rank: number;
  id: number;
  name: string;
  avatarUrl: string | null;
  points: number;
  wins: number;
  losses: number;
  role: Role;
  tier: Tier;
  lastMatchAt: string | null;
  remainingWithMe: number;
}

export interface BoardMe {
  id: number;
  name: string;
  avatarUrl: string | null;
  points: number;
  wins: number;
  losses: number;
  rank: number;
  tier: Tier;
  role: Role;
  matchesToday: number;
  dailyLimitPerPair: number;
  winPoints: number;
  lossPoints: number;
  pendingCount: number;
}

export interface TierStep {
  id: TierId;
  name: string;
  /** null means no lower bound: the bottom tier. */
  minPoints: number | null;
}

export interface Rules {
  startPoints: number;
  winPoints: number;
  lossPoints: number;
  dailyLimitPerPair: number;
  tiers: TierStep[];
}

export interface Board {
  workspace: { id: number; name: string; isPublic: boolean; memberCount: number };
  me: BoardMe;
  players: Player[];
  rules: Rules;
}

export interface SearchResult {
  id: number;
  name: string;
  isPublic: boolean;
  memberCount: number;
  myStatus: MemberStatus | null;
  myRole: Role | null;
}

export interface Member {
  userId: number;
  name: string;
  avatarUrl: string | null;
  role: Role;
  status: MemberStatus;
  points: number;
  wins: number;
  losses: number;
  tier: Tier;
}

export interface PersonRef {
  id: number;
  name: string;
  avatarUrl?: string | null;
}

export interface RecentMatch {
  id: number;
  createdAt: string;
  winnerDelta: number;
  loserDelta: number;
  winner: PersonRef;
  loser: PersonRef;
  reportedBy: PersonRef;
}

export type LoginMessage = { type: "login" };
export type LoginResponse = { ok: true } | { ok: false; message: string };
