export const START_POINTS = 1000;
export const WIN_POINTS = 20;
export const LOSS_POINTS = -20;
/**
 * The limit is per PAIR, not per person: A can play B three times a day, and A against C
 * has its own budget. Counting per person lets two heavy rivals use up each other's day
 * and block everyone else.
 */
export const DAILY_LIMIT_PER_PAIR = 3;

export const MAX_WORKSPACES_PER_OWNER = 20;
export const WORKSPACE_NAME_MIN = 2;
export const WORKSPACE_NAME_MAX = 40;

export type TierId = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master";
export interface Tier {
  id: TierId;
  name: string;
  minPoints: number;
}

// Must stay in descending order: tierFor takes the first threshold the score reaches.
const TIERS: Tier[] = [
  { id: "master", name: "Master", minPoints: 1400 },
  { id: "diamond", name: "Diamond", minPoints: 1300 },
  { id: "platinum", name: "Platinum", minPoints: 1200 },
  { id: "gold", name: "Gold", minPoints: 1100 },
  { id: "silver", name: "Silver", minPoints: 1000 },
  { id: "bronze", name: "Bronze", minPoints: Number.NEGATIVE_INFINITY },
];

export function tierFor(points: number): Tier {
  return TIERS.find((t) => points >= t.minPoints)!;
}

export function tierLadder(): Array<{ id: TierId; name: string; minPoints: number | null }> {
  return [...TIERS]
    .reverse()
    .map((t) => ({ id: t.id, name: t.name, minPoints: Number.isFinite(t.minPoints) ? t.minPoints : null }));
}

// Vietnam is a fixed UTC+7 with no daylight saving.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The half-open range [start, end) of the Vietnam-time day containing `now`. */
export function vnDayRange(now: Date): { start: Date; end: Date } {
  const startMs = Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS) };
}

/** Compact form for the client, which translates the name from the id itself. */
export function tierSummary(points: number): { id: TierId; name: string } {
  const { id, name } = tierFor(points);
  return { id, name };
}
