import { useCallback, useRef, useState, type ReactNode } from "react";
import type { Player } from "../types.js";
import { useLang } from "../i18n.js";

/** position: fixed để thẻ không bị vùng cuộn của danh sách cắt mất. */
export function PlayerTip({ player, isMe, children }: { player: Player; isMe: boolean; children: ReactNode }) {
  const { t, locale } = useLang();
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const anchor = useRef<HTMLSpanElement>(null);

  const open = useCallback(() => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return;
    // Gần mép trên thì lật xuống dưới, nếu không thẻ sẽ che mất phần đầu trang.
    const below = rect.top < 150;
    setPos({ x: rect.left + rect.width / 2, y: below ? rect.bottom : rect.top, below });
  }, []);
  const close = useCallback(() => setPos(null), []);

  const played = player.wins + player.losses;
  const winRate = played === 0 ? null : Math.round((player.wins / played) * 100);
  const last = player.lastMatchAt
    ? new Intl.DateTimeFormat(locale, {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(player.lastMatchAt))
    : null;

  return (
    <span
      className="tip-anchor"
      ref={anchor}
      tabIndex={0}
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      // Trên điện thoại không có rê chuột, nên chạm vào là bật/tắt thẻ.
      onClick={() => (pos ? close() : open())}
    >
      {children}
      {pos && (
        <span className={`tip ${pos.below ? "below" : ""}`} role="tooltip" style={{ left: pos.x, top: pos.y }}>
          <span className="tip-name">{player.name}</span>
          <span className="tip-row">
            <span>{t("tip.winrate")}</span>
            <b className="num">{winRate === null ? "—" : `${winRate}%`}</b>
          </span>
          <span className="tip-row">
            <span>{t("board.record", { w: player.wins, l: player.losses })}</span>
            <b className="num">{player.points}</b>
          </span>
          <span className="tip-sub">
            {t("tip.last")}: {last ?? t("tip.never")}
          </span>
          {!isMe && (
            <span className={`tip-left ${player.remainingWithMe === 0 ? "out" : ""}`}>
              {player.remainingWithMe === 0
                ? t("tip.remainingNone")
                : t("tip.remaining", { n: player.remainingWithMe })}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
