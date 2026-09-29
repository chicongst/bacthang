import type { Player } from "@app/types.js";
import { Avatar } from "@app/components/Avatar.js";
import { TierBadge } from "@app/components/TierBadge.js";
import { useLang } from "@app/i18n.js";
import { PlayerTip } from "@app/components/PlayerTip.js";

function Podium({ top, meId }: { top: Player[]; meId: number }) {
  const { t, tierName } = useLang();
  const order = [top[1], top[0], top[2]].filter((entry): entry is Player => !!entry);
  return (
    <ol className="podium">
      {order.map((player) => (
        <li key={player.id} className={`step step-${player.rank} ${player.id === meId ? "is-me" : ""}`}>
          <PlayerTip player={player} isMe={player.id === meId}>
            <Avatar name={player.name} url={player.avatarUrl} size={player.rank === 1 ? 52 : 42} tier={player.tier.id} />
          </PlayerTip>
          <div className="step-name" title={player.name}>{player.name}</div>
          <div className="step-points">
            <TierBadge tier={player.tier.id} size={16} title={tierName(player.tier.id)} />
            <span className="num">{player.points}</span>
          </div>
          <div className="plinth num" aria-label={t("board.rank", { n: player.rank })}>{player.rank}</div>
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
        {rest.map((player) => (
          <li key={player.id} className={`row ${player.id === meId ? "is-me" : ""}`}>
            <span className="row-rank num">{player.rank}</span>
            <PlayerTip player={player} isMe={player.id === meId}>
              <Avatar name={player.name} url={player.avatarUrl} size={30} />
            </PlayerTip>
            <span className="row-id">
              <span className="row-name">{player.name}</span>
              <span className="row-wl">{t("board.record", { w: player.wins, l: player.losses })}</span>
            </span>
            <TierBadge tier={player.tier.id} size={24} title={tierName(player.tier.id)} />
            <span className="row-points num">{player.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
