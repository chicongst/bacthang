import { useMemo, useState } from "react";
import { fold } from "@app/format.js";
import { useLang } from "@app/i18n.js";
import type { BoardMe, MatchResult, Player } from "@app/types.js";
import { NothingLeftToday } from "./elements/NothingLeftToday.js";
import { OpponentPicker } from "./elements/OpponentPicker.js";
import { ResultChoice } from "./elements/ResultChoice.js";

export function Record({
  me,
  players,
  onSubmit,
}: {
  me: BoardMe;
  players: Player[];
  onSubmit: (opponentId: number, result: MatchResult) => Promise<string | null>;
}) {
  const { t } = useLang();
  const [query, setQuery] = useState("");
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const everyone = useMemo(() => players.filter((player) => player.id !== me.id), [players, me.id]);
  const opponents = useMemo(() => {
    const needle = fold(query.trim());
    return everyone.filter((player) => !needle || fold(player.name).includes(needle));
  }, [everyone, query]);
  const opponent = players.find((player) => player.id === opponentId);

  async function submit() {
    if (!opponentId || !result) return;
    setBusy(true);
    setError(null);
    const failure = await onSubmit(opponentId, result);
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOpponentId(null);
    setResult(null);
    setQuery("");
  }

  // The limit is per pair, so there is nothing left to do only when every opponent is used up.
  if (everyone.length > 0 && everyone.every((player) => player.remainingWithMe === 0)) {
    return <NothingLeftToday />;
  }
  if (everyone.length === 0) {
    return <p className="empty">{t("record.noOpponents")}</p>;
  }

  return (
    <div className="record">
      <OpponentPicker
        opponents={opponents}
        query={query}
        selectedId={opponentId}
        onQueryChange={setQuery}
        onPick={(id) => {
          setOpponentId(id);
          setResult(null);
          setError(null);
        }}
      />

      {opponent ? (
        <ResultChoice
          me={me}
          opponent={opponent}
          result={result}
          busy={busy}
          error={error}
          onPick={setResult}
          onSubmit={submit}
        />
      ) : (
        <p className="rule-note">{t("record.choose")}</p>
      )}
    </div>
  );
}
