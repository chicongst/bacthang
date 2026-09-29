import type { BoardMe } from "../types.js";
import { Avatar } from "../components/Avatar.js";
import { TierBadge } from "../components/TierBadge.js";
import { useLang } from "../i18n.js";

export function MeCard({ me, total }: { me: BoardMe; total: number }) {
  const { t, tierName } = useLang();
  return (
    <section className="me" aria-label={t("me.aria")}>
      <Avatar name={me.name} url={me.avatarUrl} size={44} tier={me.tier.id} />
      <div className="me-id">
        <div className="me-name">{me.name}</div>
        <div className="me-sub">
          <span className="me-rank">
            #{me.rank}
            <span className="muted">/{total}</span>
          </span>
          <span className="dot-sep" />
          <span className="today">{t("me.today", { n: me.matchesToday })}</span>
        </div>
      </div>
      <div className="me-score">
        <TierBadge tier={me.tier.id} size={38} title={tierName(me.tier.id)} />
        <div>
          <div className="num me-points">{me.points}</div>
          <div className="me-tier">{tierName(me.tier.id)}</div>
        </div>
      </div>
    </section>
  );
}
