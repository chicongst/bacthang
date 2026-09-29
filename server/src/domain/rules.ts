export const START_POINTS = 1000;
export const WIN_POINTS = 20;
export const LOSS_POINTS = -20;
/**
 * Giới hạn tính theo CẶP ĐẤU, không phải theo người: A đánh với B tối đa 3 trận mỗi ngày,
 * còn A đánh với C là hạn mức riêng. Tính theo người thì hai người đánh nhau nhiều
 * sẽ chặn mất cơ hội đánh với người khác trong ngày.
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

// Phải xếp từ cao xuống thấp: tierFor lấy mốc đầu tiên mà điểm đạt tới.
const TIERS: Tier[] = [
  { id: "master", name: "Cao Thủ", minPoints: 1400 },
  { id: "diamond", name: "Kim Cương", minPoints: 1300 },
  { id: "platinum", name: "Bạch Kim", minPoints: 1200 },
  { id: "gold", name: "Vàng", minPoints: 1100 },
  { id: "silver", name: "Bạc", minPoints: 1000 },
  { id: "bronze", name: "Đồng", minPoints: Number.NEGATIVE_INFINITY },
];

export function tierFor(points: number): Tier {
  return TIERS.find((t) => points >= t.minPoints)!;
}

export function tierLadder(): Array<{ id: TierId; name: string; minPoints: number | null }> {
  return [...TIERS]
    .reverse()
    .map((t) => ({ id: t.id, name: t.name, minPoints: Number.isFinite(t.minPoints) ? t.minPoints : null }));
}

// Việt Nam cố định UTC+7, không có giờ mùa hè.
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Khoảng [start, end) của ngày theo giờ Việt Nam chứa thời điểm `now`. */
export function vnDayRange(now: Date): { start: Date; end: Date } {
  const startMs = Math.floor((now.getTime() + VN_OFFSET_MS) / DAY_MS) * DAY_MS - VN_OFFSET_MS;
  return { start: new Date(startMs), end: new Date(startMs + DAY_MS) };
}

/** Dạng rút gọn gửi cho giao diện: giao diện tự dịch tên theo id. */
export function tierSummary(points: number): { id: TierId; name: string } {
  const { id, name } = tierFor(points);
  return { id, name };
}
