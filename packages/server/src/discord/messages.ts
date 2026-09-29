import type { ErrorCode } from "../errors.js";

export type Lang = "en" | "vi";

export function langOf(locale: string | undefined): Lang {
  return locale?.startsWith("vi") ? "vi" : "en";
}

export const MEDALS = ["🥇", "🥈", "🥉"];

const TEXT = {
  en: {
    signIn: (url: string) =>
      `You have not signed in yet. Open ${url}, sign in with Discord once, then run this again.`,
    noBoards: (url: string) => `You are not on a board yet. Join or create one at ${url}.`,
    waitingApproval: "The owner of the board you asked to join has not approved you yet.",
    pickBoard: (names: string) => `You are on several boards. Add the \`board\` option: ${names}.`,
    unknownBoard: "You are not on that board.",
    unknownOpponent: (who: string) => `${who} has not signed in yet, so there is nothing to record.`,
    recorded: (a: string, b: string, won: boolean) =>
      won ? `🏆 **${a}** beat **${b}**` : `**${b}** beat **${a}**`,
    standing: (points: number, delta: number, rank: number) =>
      `${points - delta} → **${points}** (${delta > 0 ? "+" : ""}${delta}) · now #${rank}`,
    remaining: (n: number, who: string) =>
      n === 0 ? `No matches left with ${who} today.` : `${n} more with ${who} today.`,
    season: (n: number) => `Season ${n}`,
    record: (w: number, l: number) => `${w}W ${l}L`,
    rank: (n: number) => `Rank #${n}`,
    points: (n: number) => `${n} points`,
    playedToday: (n: number) => `${n} played today`,
    leftToday: "Left today",
    andMore: (n: number) => `…and ${n} more.`,
    failed: "Something went wrong. Try again in a moment.",
  },
  vi: {
    signIn: (url: string) =>
      `Bạn chưa đăng nhập lần nào. Mở ${url}, đăng nhập bằng Discord một lần, rồi gõ lại.`,
    noBoards: (url: string) => `Bạn chưa ở bảng nào. Vào ${url} để tham gia hoặc tạo một bảng.`,
    waitingApproval: "Chủ bảng bạn xin vào chưa duyệt bạn.",
    pickBoard: (names: string) => `Bạn đang ở nhiều bảng. Thêm tuỳ chọn \`board\`: ${names}.`,
    unknownBoard: "Bạn không ở trong bảng đó.",
    unknownOpponent: (who: string) => `${who} chưa đăng nhập lần nào nên chưa ghi được.`,
    recorded: (a: string, b: string, won: boolean) =>
      won ? `🏆 **${a}** thắng **${b}**` : `**${b}** thắng **${a}**`,
    standing: (points: number, delta: number, rank: number) =>
      `${points - delta} → **${points}** (${delta > 0 ? "+" : ""}${delta}) · hạng #${rank}`,
    remaining: (n: number, who: string) =>
      n === 0 ? `Hôm nay hết lượt với ${who}.` : `Hôm nay còn ${n} trận với ${who}.`,
    season: (n: number) => `Mùa ${n}`,
    record: (w: number, l: number) => `${w}T ${l}B`,
    rank: (n: number) => `Hạng #${n}`,
    points: (n: number) => `${n} điểm`,
    playedToday: (n: number) => `đã đánh ${n} trận hôm nay`,
    leftToday: "Còn lại hôm nay",
    andMore: (n: number) => `…và ${n} người nữa.`,
    failed: "Có lỗi xảy ra. Thử lại sau một chút.",
  },
} as const;

export const say = (lang: Lang) => TEXT[lang];

const ERRORS: Record<Lang, Partial<Record<ErrorCode, string>>> = {
  en: {
    SELF_MATCH: "You cannot record a match against yourself.",
    OPPONENT_NOT_FOUND: "That person is not on this board.",
    NOT_MEMBER: "You are not on this board.",
    PENDING_APPROVAL: "The board owner has not approved you yet.",
    WORKSPACE_NOT_FOUND: "That board no longer exists.",
    RATE_LIMITED: "Too many requests. Wait a moment.",
  },
  vi: {
    SELF_MATCH: "Không ghi trận với chính mình được.",
    OPPONENT_NOT_FOUND: "Người đó không ở trong bảng này.",
    NOT_MEMBER: "Bạn không ở trong bảng này.",
    PENDING_APPROVAL: "Chủ bảng chưa duyệt bạn.",
    WORKSPACE_NOT_FOUND: "Bảng đó không còn nữa.",
    RATE_LIMITED: "Nhiều yêu cầu quá. Chờ một chút.",
  },
};

export function errorText(lang: Lang, code: ErrorCode): string {
  return ERRORS[lang][code] ?? TEXT[lang].failed;
}

export function limitReached(lang: Lang, opponent: string, limit: number): string {
  return lang === "vi"
    ? `Hôm nay bạn và ${opponent} đã đánh đủ ${limit} trận. Vẫn đánh được với người khác.`
    : `You and ${opponent} have played all ${limit} matches today. You can still play anyone else.`;
}

const NAME_WIDTH = 14;
// A display name is whatever the player typed into Discord. Inside a code fence a backtick
// would end the block early; outside one, these characters are markdown.
const MARKDOWN = /[\\`*_~|]/g;

const flatten = (name: string) => name.replace(/\s+/g, " ").trim();

/** For a name put in running text, where markdown applies. */
export const safeName = (name: string) => flatten(name).replace(MARKDOWN, (c) => `\\${c}`) || "?";

/** For a name put in the fixed-width table, where it is the fence that must survive. */
export function padName(name: string): string {
  const flat = flatten(name).replace(/`/g, "") || "?";
  const cut = flat.length > NAME_WIDTH ? `${flat.slice(0, NAME_WIDTH - 1)}…` : flat;
  return cut.padEnd(NAME_WIDTH);
}
