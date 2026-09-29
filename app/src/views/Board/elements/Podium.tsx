import { Avatar } from "@app/components/Avatar.js";
import { PlayerTip } from "@app/components/PlayerTip.js";
import { TierBadge } from "@app/components/TierBadge.js";
import { useLang } from "@app/i18n.js";
import type { Player } from "@app/types.js";
import { RankCrest } from "./RankCrest.js";

const isPlace = (rank: number): rank is 1 | 2 | 3 => rank === 1 || rank === 2 || rank === 3;

export function Podium({ top, meId }: { top: Player[]; meId: number }) {
  const { t, tierName } = useLang();
  // Second place on the left, winner in the middle, third on the right.
  const order = [top[1], top[0], top[2]].filter((entry): entry is Player => !!entry);

  return (
    <ol className="podium">
      {order.map((player) => {
        const size = player.rank === 1 ? 52 : 42;
        return (
          <li key={player.id} className={`step step-${player.rank} ${player.id === meId ? "is-me" : ""}`}>
            <span className="crest-wrap">
              {isPlace(player.rank) && <RankCrest place={player.rank} width={size * 2.5} seed={player.id} />}
              <PlayerTip player={player} isMe={player.id === meId}>
                <Avatar name={player.name} url={player.avatarUrl} size={size} tier={player.tier.id} />
              </PlayerTip>
            </span>
            <div className="step-name" title={player.name}>
              {player.name}
            </div>
            <div className="step-points">
              <TierBadge tier={player.tier.id} size={16} title={tierName(player.tier.id)} />
              <span className="num">{player.points}</span>
            </div>
            <div className="plinth num" aria-label={t("board.rank", { n: player.rank })}>
              {player.rank}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
