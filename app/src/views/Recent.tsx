import { useState } from "react";
import type { RecentMatch } from "@app/types.js";
import { Avatar } from "@app/components/Avatar.js";
import { fmtDelta } from "@app/format.js";
import { useLang } from "@app/i18n.js";

function when(iso: string, locale: string, today: string): string {
  const time = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });
  const at = new Date(iso);
  const sameDay = day.format(at) === day.format(new Date());
  return sameDay ? `${time.format(at)} ${today}` : `${time.format(at)} · ${day.format(at)}`;
}

export function Recent({
  matches,
  canDelete,
  onDelete,
}: {
  matches: RecentMatch[] | null;
  canDelete: boolean;
  onDelete: (id: number) => Promise<string | null>;
}) {
  const { t, locale } = useLang();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!matches) return <p className="empty">{t("app.loading")}</p>;
  if (matches.length === 0) return <p className="empty">{t("recent.empty")}</p>;

  return (
    <div className="recent">
      {error && <p className="error" role="alert">{error}</p>}
      <ul>
        {matches.map((match) => (
          <li key={match.id} className="match">
            <Avatar name={match.winner.name} url={match.winner.avatarUrl} size={30} />
            <div className="match-body">
              <div className="match-line">
                <b>{match.winner.name}</b> <span className="muted">{t("recent.beat")}</span> <b>{match.loser.name}</b>
              </div>
              <div className="match-meta">
                {when(match.createdAt, locale, t("recent.today"))} · {t("recent.by", { name: match.reportedBy.name })}
              </div>
            </div>
            {confirming === match.id ? (
              <span className="confirm">
                <button
                  className="danger"
                  onClick={async () => {
                    const err = await onDelete(match.id);
                    setConfirming(null);
                    setError(err);
                  }}
                >
                  {t("recent.delete")}
                </button>
                <button className="ghost" onClick={() => setConfirming(null)}>
                  {t("recent.cancel")}
                </button>
              </span>
            ) : (
              <span className="deltas num">
                <span className="up">{fmtDelta(match.winnerDelta)}</span>
                <span className="down">{fmtDelta(match.loserDelta)}</span>
                {canDelete && (
                  <button className="trash" aria-label={t("recent.deleteAria", { winner: match.winner.name, loser: match.loser.name })} onClick={() => setConfirming(match.id)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                    </svg>
                  </button>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
