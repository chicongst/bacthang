import type { Player } from "@app/types.js";
import { Avatar } from "@app/components/Avatar.js";
import { TierBadge } from "@app/components/TierBadge.js";
import { useLang } from "@app/i18n.js";

export function OpponentPicker({
  opponents,
  query,
  selectedId,
  onQueryChange,
  onPick,
}: {
  opponents: Player[];
  query: string;
  selectedId: number | null;
  onQueryChange: (query: string) => void;
  onPick: (opponentId: number) => void;
}) {
  const { t, tierName } = useLang();

  return (
    <>
      <div className="field-head">
        <label htmlFor="opp-search">{t("record.opponent")}</label>
      </div>
      <input
        id="opp-search"
        className="search"
        placeholder={t("record.search")}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        autoComplete="off"
      />
      <ul className="picker" role="radiogroup" aria-label={t("record.pickAria")}>
        {opponents.map((player) => (
          <li key={player.id}>
            <button
              type="button"
              role="radio"
              aria-checked={player.id === selectedId}
              className="pick"
              disabled={player.remainingWithMe === 0}
              onClick={() => onPick(player.id)}
            >
              <Avatar name={player.name} url={player.avatarUrl} size={26} />
              <span className="pick-name">{player.name}</span>
              <span className="pick-left">
                {player.remainingWithMe === 0
                  ? t("record.exhausted")
                  : t("record.remaining", { n: player.remainingWithMe })}
              </span>
              <TierBadge tier={player.tier.id} size={18} title={tierName(player.tier.id)} />
            </button>
          </li>
        ))}
        {opponents.length === 0 && <li className="empty small">{t("record.noone")}</li>}
      </ul>
    </>
  );
}
