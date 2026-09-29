import { Avatar } from "@app/components/Avatar.js";
import { PlayerTip } from "@app/components/PlayerTip.js";
import { TierBadge } from "@app/components/TierBadge.js";
import { useLang } from "@app/i18n.js";
import type { Player, Season } from "@app/types.js";
import { Podium } from "./elements/Podium.js";
import { SeasonSwitcher } from "./elements/SeasonSwitcher.js";

export function Board({
  players,
  meId,
  seasons,
  currentSeason,
  viewingSeason,
  onPickSeason,
}: {
  players: Player[];
  meId: number;
  seasons: Season[] | null;
  currentSeason: number;
  /** null while the season being played is on screen. */
  viewingSeason: number | null;
  onPickSeason: (seasonId: number | null) => void;
}) {
  const { t, tierName } = useLang();
  const viewed = seasons?.find((season) => season.id === viewingSeason);
  const switcher = seasons && (
    <>
      <SeasonSwitcher seasons={seasons} current={currentSeason} viewing={viewingSeason} onPick={onPickSeason} />
      {viewed && <p className="rule-note">{t("season.archiveNote", { n: viewed.number })}</p>}
    </>
  );
  if (players.length === 0) {
    return (
      <div className="board">
        {switcher}
        <p className="empty">{t("board.empty")}</p>
      </div>
    );
  }
  const podium = players.length >= 3 ? players.slice(0, 3) : [];
  const rest = players.length >= 3 ? players.slice(3) : players;

  return (
    <div className="board">
      {switcher}
      {podium.length > 0 && <Podium top={podium} meId={meId} tips={viewingSeason === null} />}
      <ul className="rows">
        {rest.map((player) => (
          <li key={player.id} className={`row ${player.id === meId ? "is-me" : ""}`}>
            <span className="row-rank num">{player.rank}</span>
            {viewingSeason === null ? (
              <PlayerTip player={player} isMe={player.id === meId}>
                <Avatar name={player.name} url={player.avatarUrl} size={30} />
              </PlayerTip>
            ) : (
              <Avatar name={player.name} url={player.avatarUrl} size={30} />
            )}
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
