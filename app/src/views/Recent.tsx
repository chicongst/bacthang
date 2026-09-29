import { useState } from "react";
import type { RecentMatch } from "../types.js";
import { Avatar } from "../components/Avatar.js";
import { fmtDelta } from "../format.js";
import { useLang } from "../i18n.js";

function when(iso: string, locale: string, today: string): string {
  const time = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  const day = new Intl.DateTimeFormat(locale, { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" });
  const d = new Date(iso);
  const sameDay = day.format(d) === day.format(new Date());
  return sameDay ? `${time.format(d)} ${today}` : `${time.format(d)} · ${day.format(d)}`;
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
        {matches.map((m) => (
          <li key={m.id} className="match">
            <Avatar name={m.winner.name} url={m.winner.avatarUrl} size={30} />
            <div className="match-body">
              <div className="match-line">
                <b>{m.winner.name}</b> <span className="muted">{t("recent.beat")}</span> <b>{m.loser.name}</b>
              </div>
              <div className="match-meta">
                {when(m.createdAt, locale, t("recent.today"))} · {t("recent.by", { name: m.reportedBy.name })}
              </div>
            </div>
            {confirming === m.id ? (
              <span className="confirm">
                <button
                  className="danger"
                  onClick={async () => {
                    const err = await onDelete(m.id);
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
                <span className="up">{fmtDelta(m.winnerDelta)}</span>
                <span className="down">{fmtDelta(m.loserDelta)}</span>
                {canDelete && (
                  <button className="trash" aria-label={t("recent.deleteAria", { winner: m.winner.name, loser: m.loser.name })} onClick={() => setConfirming(m.id)}>
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
