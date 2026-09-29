import type { Player } from "../types.js";
import { Avatar } from "../components/Avatar.js";
import { TierBadge } from "../components/TierBadge.js";
import { useLang } from "../i18n.js";
import { PlayerTip } from "../components/PlayerTip.js";

function Podium({ top, meId }: { top: Player[]; meId: number }) {
  const { t, tierName } = useLang();
  const order = [top[1], top[0], top[2]].filter((p): p is Player => !!p);
  return (
    <ol className="podium">
      {order.map((p) => (
        <li key={p.id} className={`step step-${p.rank} ${p.id === meId ? "is-me" : ""}`}>
          <PlayerTip player={p} isMe={p.id === meId}>
            <Avatar name={p.name} url={p.avatarUrl} size={p.rank === 1 ? 52 : 42} tier={p.tier.id} />
          </PlayerTip>
          <div className="step-name" title={p.name}>{p.name}</div>
          <div className="step-points">
            <TierBadge tier={p.tier.id} size={16} title={tierName(p.tier.id)} />
            <span className="num">{p.points}</span>
          </div>
          <div className="plinth num" aria-label={t("board.rank", { n: p.rank })}>{p.rank}</div>
        </li>
      ))}
    </ol>
  );
}

export function Board({ players, meId }: { players: Player[]; meId: number }) {
  const { t, tierName } = useLang();
  if (players.length === 0) return <p className="empty">{t("board.empty")}</p>;
  const podium = players.length >= 3 ? players.slice(0, 3) : [];
  const rest = players.length >= 3 ? players.slice(3) : players;

  return (
    <div className="board">
      {podium.length > 0 && <Podium top={podium} meId={meId} />}
      <ul className="rows">
        {rest.map((p) => (
          <li key={p.id} className={`row ${p.id === meId ? "is-me" : ""}`}>
            <span className="row-rank num">{p.rank}</span>
            <PlayerTip player={p} isMe={p.id === meId}>
              <Avatar name={p.name} url={p.avatarUrl} size={30} />
            </PlayerTip>
            <span className="row-id">
              <span className="row-name">{p.name}</span>
              <span className="row-wl">{t("board.record", { w: p.wins, l: p.losses })}</span>
            </span>
            <TierBadge tier={p.tier.id} size={24} title={tierName(p.tier.id)} />
            <span className="row-points num">{p.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
