import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TierId } from "./types.js";

export type Lang = "vi" | "en";
const STORAGE_KEY = "ranking.lang";

const vi = {
  "app.tab.board": "Bảng",
  "app.tab.record": "Ghi trận",
  "app.tab.recent": "Gần đây",
  "app.tab.group": "Nhóm",
  "app.tab.rules": "Luật",
  "rules.points.title": "Cách tính điểm",
  "rules.points.win": "Thắng một trận",
  "rules.points.loss": "Thua một trận",
  "rules.daily.title": "Mỗi cặp {n} trận một ngày",
  "rules.daily.body": "Hai người đánh với nhau tối đa {n} trận mỗi ngày. Hết lượt với người này thì vẫn đánh được với người khác — hạn mức tính riêng cho từng cặp. Lượt mới mở lúc 0 giờ theo giờ Việt Nam.",
  "rules.tiers.title": "Trình độ",
  "rules.tiers.body": "Cứ 100 điểm là lên một hạng. Hạng cao nhất để mở, điểm vẫn chạy tiếp.",
  "rules.tiers.from": "từ {n}",
  "rules.tiers.under": "dưới {n}",
  "rules.tiers.you": "bạn ở đây",
  "rules.report.title": "Ghi trận",
  "rules.report.body": "Ai trong hai người cũng ghi được, không cần người kia xác nhận. Ghi nhầm thì chủ workspace xóa trận đó và điểm hoàn lại cho cả hai.",
  "app.loading": "Đang tải…",
  "app.retry": "Thử lại",
  "app.logout": "Đăng xuất",
  "app.mock": "dữ liệu mẫu",
  "app.live.on": "Đang cập nhật trực tiếp",
  "app.live.off": "Mất kết nối trực tiếp",
  "app.switch.find": "Tìm hoặc tạo workspace",
  "app.switch.pending": "chờ duyệt",
  "app.error.generic": "Có lỗi xảy ra.",
  "app.toast.recorded": "Đã ghi. {delta} điểm",
  "app.toast.deleted": "Đã xóa trận, điểm đã hoàn lại",
  "app.lang.switch": "Chuyển sang tiếng Anh",
  "app.stale": "Đã có bản mới",
  "app.staleReload": "Tải lại",

  "login.title": "Leo hạng cùng cả nhóm",
  "login.button": "Đăng nhập bằng Discord",
  "login.opening": "Đang mở Discord…",
  "login.hint.web": "Bạn sẽ được chuyển sang Discord để xác nhận, rồi quay lại trang này.",
  "login.hint.extension": "Cửa sổ Discord sẽ mở ra và popup này có thể tự đóng. Đăng nhập xong thì bấm lại icon extension.",

  "me.today": "{n} trận hôm nay",
  "tip.winrate": "Tỉ lệ thắng",
  "tip.last": "Trận gần nhất",
  "tip.never": "Chưa đánh trận nào",
  "tip.remaining": "Còn {n} lượt với bạn hôm nay",
  "tip.remainingNone": "Hết lượt với bạn hôm nay",
  "record.remaining": "còn {n}",
  "record.exhausted": "hết lượt",
  "record.allDone": "Hôm nay bạn đã đánh đủ lượt với tất cả mọi người.",
  "record.noOpponents": "Chưa có ai khác trong nhóm.",
  "me.aria": "Thứ hạng của bạn",

  "board.empty": "Chưa có ai trên bảng.",
  "board.record": "{w}T · {l}B",
  "board.rank": "Hạng {n}",

  "record.opponent": "Đối thủ",
  "record.search": "Tìm tên…",
  "record.pickAria": "Chọn đối thủ",
  "record.noone": "Không có ai tên như vậy.",
  "record.result": "Kết quả",
  "record.resultAria": "Kết quả trận",
  "record.win": "Tôi thắng",
  "record.loss": "Tôi thua",
  "record.saving": "Đang ghi…",
  "record.submit": "Ghi: {winner} thắng {loser}",
  "record.choose": "Chọn đối thủ trước, rồi mới chọn kết quả.",
  "record.pickResult": "Chọn thắng hay thua",
  "record.against": "với {name}",
  "record.doneSub": "Lượt mới mở lúc 0 giờ.",

  "recent.empty": "Chưa có trận nào được ghi.",
  "recent.beat": "thắng",
  "recent.by": "{name} ghi",
  "recent.today": "hôm nay",
  "recent.delete": "Xóa",
  "recent.cancel": "Hủy",
  "recent.deleteAria": "Xóa trận {winner} thắng {loser}",

  "group.pending": "Chờ duyệt ({n})",
  "group.approve": "Duyệt",
  "group.reject": "Từ chối",
  "group.members": "Thành viên ({n})",
  "group.owner": "chủ",
  "group.kick": "Đuổi",
  "group.cancel": "Hủy",
  "group.kickNote": "Người bị đuổi muốn vào lại phải xin và chờ bạn duyệt, kể cả khi workspace để công khai.",
  "group.settings": "Cài đặt",
  "group.name": "Tên workspace",
  "group.save": "Lưu",
  "group.failed": "Không thực hiện được.",
  "group.leave": "Rời workspace",
  "group.leaveConfirm": "Rời \"{name}\"? Điểm hiện tại sẽ mất.",
  "group.leaveDo": "Rời",
  "group.leaveButton": "Rời workspace này",

  "ws.eyebrow": "Workspace",
  "ws.enter": "Vào một workspace",
  "ws.createTitle": "Tạo workspace mới",
  "ws.name": "Tên workspace",
  "ws.namePlaceholder": "CLB Quận 1",
  "ws.public": "Công khai",
  "ws.publicHint": "Ai tìm thấy cũng vào được ngay",
  "ws.private": "Riêng tư",
  "ws.privateHint": "Phải xin, bạn duyệt mới vào được",
  "ws.modeAria": "Ai vào được",
  "ws.creating": "Đang tạo…",
  "ws.create": "Tạo workspace",
  "ws.back": "Quay lại tìm kiếm",
  "ws.backAria": "Quay lại",
  "ws.search": "Tìm tên workspace…",
  "ws.searching": "Đang tìm…",
  "ws.noResult": "Không có workspace nào tên như vậy.",
  "ws.memberCount": "{n} thành viên",
  "ws.go": "Vào",
  "ws.pending": "Chờ duyệt",
  "ws.join": "Tham gia",
  "ws.request": "Xin vào",
  "ws.requested": "Đã gửi yêu cầu vào \"{name}\". Chờ chủ workspace duyệt.",
  "ws.joinFailed": "Không vào được workspace này.",
  "ws.createFailed": "Không tạo được workspace.",
  "ws.searchFailed": "Không tìm được.",
  "ws.privateAria": "Riêng tư",

  "tier.bronze": "Đồng",
  "tier.silver": "Bạc",
  "tier.gold": "Vàng",
  "tier.platinum": "Bạch Kim",
  "tier.diamond": "Kim Cương",
  "tier.master": "Cao Thủ",

  "err.UNAUTHORIZED": "Bạn cần đăng nhập lại.",
  "err.NOT_MEMBER": "Bạn không ở trong workspace này.",
  "err.PENDING_APPROVAL": "Yêu cầu tham gia của bạn đang chờ chủ workspace duyệt.",
  "err.FORBIDDEN": "Chỉ chủ workspace mới làm được việc này.",
  "err.SELF_MATCH": "Không thể ghi trận với chính mình.",
  "err.OPPONENT_NOT_FOUND": "Đối thủ không còn trong workspace này.",
  "err.DAILY_LIMIT_REACHED": "Bạn đã đánh đủ {limit} trận hôm nay. Lượt mới mở lúc 0 giờ.",
  "err.OPPONENT_DAILY_LIMIT_REACHED": "Đối thủ đã đánh đủ {limit} trận hôm nay.",
  "err.NETWORK": "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.",
} as const;

export type Key = keyof typeof vi;

const en: Record<Key, string> = {
  "app.tab.board": "Board",
  "app.tab.record": "Add match",
  "app.tab.recent": "Recent",
  "app.tab.group": "Group",
  "app.tab.rules": "Rules",
  "rules.points.title": "How points work",
  "rules.points.win": "Win a match",
  "rules.points.loss": "Lose a match",
  "rules.daily.title": "{n} matches per pair per day",
  "rules.daily.body": "Two people can play each other at most {n} times a day. Running out against one person does not stop you playing anyone else — the limit is per pair. Slots reset at midnight, Vietnam time.",
  "rules.tiers.title": "Tiers",
  "rules.tiers.body": "Every 100 points moves you up a tier. The top tier is open-ended — points keep climbing.",
  "rules.tiers.from": "from {n}",
  "rules.tiers.under": "under {n}",
  "rules.tiers.you": "you're here",
  "rules.report.title": "Recording matches",
  "rules.report.body": "Either player can record the match; the other doesn't have to confirm. If it's wrong, the workspace owner deletes it and both players get their points back.",
  "app.loading": "Loading…",
  "app.retry": "Try again",
  "app.logout": "Sign out",
  "app.mock": "sample data",
  "app.live.on": "Live updates on",
  "app.live.off": "Live updates disconnected",
  "app.switch.find": "Find or create a workspace",
  "app.switch.pending": "awaiting approval",
  "app.error.generic": "Something went wrong.",
  "app.toast.recorded": "Saved. {delta} points",
  "app.toast.deleted": "Match deleted, points restored",
  "app.lang.switch": "Switch to Vietnamese",
  "app.stale": "A new version is available",
  "app.staleReload": "Reload",

  "login.title": "Climb the ranks together",
  "login.button": "Sign in with Discord",
  "login.opening": "Opening Discord…",
  "login.hint.web": "You'll be sent to Discord to confirm, then brought back here.",
  "login.hint.extension": "A Discord window opens and this popup may close. Once signed in, click the extension icon again.",

  "me.today": "{n} matches today",
  "tip.winrate": "Win rate",
  "tip.last": "Last match",
  "tip.never": "No matches yet",
  "tip.remaining": "{n} matches left with you today",
  "tip.remainingNone": "No matches left with you today",
  "record.remaining": "{n} left",
  "record.exhausted": "none left",
  "record.allDone": "You've used up today's matches with everyone.",
  "record.noOpponents": "Nobody else in the group yet.",
  "me.aria": "Your standing",

  "board.empty": "Nobody on the board yet.",
  "board.record": "{w}W · {l}L",
  "board.rank": "Rank {n}",

  "record.opponent": "Opponent",
  "record.search": "Search by name…",
  "record.pickAria": "Pick an opponent",
  "record.noone": "No one by that name.",
  "record.result": "Result",
  "record.resultAria": "Match result",
  "record.win": "I won",
  "record.loss": "I lost",
  "record.saving": "Saving…",
  "record.submit": "Save: {winner} beat {loser}",
  "record.choose": "Pick an opponent first, then choose the result.",
  "record.pickResult": "Choose win or loss",
  "record.against": "vs {name}",
  "record.doneSub": "Your quota resets at midnight.",

  "recent.empty": "No matches recorded yet.",
  "recent.beat": "beat",
  "recent.by": "added by {name}",
  "recent.today": "today",
  "recent.delete": "Delete",
  "recent.cancel": "Cancel",
  "recent.deleteAria": "Delete match {winner} beat {loser}",

  "group.pending": "Awaiting approval ({n})",
  "group.approve": "Approve",
  "group.reject": "Decline",
  "group.members": "Members ({n})",
  "group.owner": "owner",
  "group.kick": "Remove",
  "group.cancel": "Cancel",
  "group.kickNote": "Someone you remove has to request again and wait for your approval, even in a public workspace.",
  "group.settings": "Settings",
  "group.name": "Workspace name",
  "group.save": "Save",
  "group.failed": "That didn't work.",
  "group.leave": "Leave workspace",
  "group.leaveConfirm": "Leave \"{name}\"? You'll lose your points here.",
  "group.leaveDo": "Leave",
  "group.leaveButton": "Leave this workspace",

  "ws.eyebrow": "Workspace",
  "ws.enter": "Join a workspace",
  "ws.createTitle": "Create a workspace",
  "ws.name": "Workspace name",
  "ws.namePlaceholder": "Friday Night Club",
  "ws.public": "Public",
  "ws.publicHint": "Anyone who finds it can join right away",
  "ws.private": "Private",
  "ws.privateHint": "People request, you approve",
  "ws.modeAria": "Who can join",
  "ws.creating": "Creating…",
  "ws.create": "Create workspace",
  "ws.back": "Back to search",
  "ws.backAria": "Back",
  "ws.search": "Search workspaces…",
  "ws.searching": "Searching…",
  "ws.noResult": "No workspace by that name.",
  "ws.memberCount": "{n} members",
  "ws.go": "Open",
  "ws.pending": "Awaiting",
  "ws.join": "Join",
  "ws.request": "Request",
  "ws.requested": "Request sent to \"{name}\". Waiting for the owner to approve.",
  "ws.joinFailed": "Could not join this workspace.",
  "ws.createFailed": "Could not create the workspace.",
  "ws.searchFailed": "Search failed.",
  "ws.privateAria": "Private",

  "tier.bronze": "Bronze",
  "tier.silver": "Silver",
  "tier.gold": "Gold",
  "tier.platinum": "Platinum",
  "tier.diamond": "Diamond",
  "tier.master": "Master",

  "err.UNAUTHORIZED": "Please sign in again.",
  "err.NOT_MEMBER": "You're not in this workspace.",
  "err.PENDING_APPROVAL": "Your request is waiting for the owner to approve.",
  "err.FORBIDDEN": "Only the workspace owner can do that.",
  "err.SELF_MATCH": "You can't record a match against yourself.",
  "err.OPPONENT_NOT_FOUND": "That opponent is no longer in this workspace.",
  "err.DAILY_LIMIT_REACHED": "You've played all {limit} matches today. Your quota resets at midnight.",
  "err.OPPONENT_DAILY_LIMIT_REACHED": "Your opponent has played all {limit} matches today.",
  "err.NETWORK": "Can't reach the server. Check your connection and try again.",
};

const DICTS: Record<Lang, Record<Key, string>> = { vi, en };

export type Params = Record<string, string | number>;
export type T = (key: Key, params?: Params) => string;

function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

function detect(): Lang {
  // ?lang=en để gửi link theo đúng ngôn ngữ mong muốn
  const forced = new URLSearchParams(location.search).get("lang");
  if (forced === "vi" || forced === "en") return forced;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "vi" || saved === "en") return saved;
  } catch {
    /* trình duyệt chặn lưu trữ */
  }
  return navigator.language?.toLowerCase().startsWith("vi") ? "vi" : "en";
}

interface LangContext {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
  tierName: (id: TierId) => string;
  /** Không có bản dịch cho mã lỗi thì giữ nguyên văn của máy chủ. */
  tError: (code: string, fallback: string, params?: Params) => string;
  locale: string;
}

const Ctx = createContext<LangContext | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* không lưu được thì thôi */
    }
  }, []);

  const value = useMemo<LangContext>(() => {
    const dict = DICTS[lang];
    const t: T = (key, params) => format(dict[key] ?? key, params);
    return {
      lang,
      setLang,
      t,
      locale: lang === "vi" ? "vi-VN" : "en-GB",
      tierName: (id) => t(`tier.${id}` as Key),
      tError: (code, fallback, params) => {
        const key = `err.${code}` as Key;
        return key in dict ? format(dict[key], params) : fallback;
      },
    };
  }, [lang, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang(): LangContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("Thiếu LangProvider");
  return ctx;
}
