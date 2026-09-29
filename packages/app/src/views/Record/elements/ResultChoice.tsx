import type { BoardMe, MatchResult, Player } from "@app/types.js";
import { fmtDelta } from "@app/format.js";
import { useLang } from "@app/i18n.js";

export function ResultChoice({
  me,
  opponent,
  result,
  busy,
  error,
  onPick,
  onSubmit,
}: {
  me: BoardMe;
  opponent: Player;
  result: MatchResult | null;
  busy: boolean;
  error: string | null;
  onPick: (result: MatchResult) => void;
  onSubmit: () => void;
}) {
  const { t } = useLang();

  function submitLabel(): string {
    if (busy) return t("record.saving");
    if (!result) return t("record.pickResult");
    return t("record.submit", {
      winner: result === "win" ? me.name : opponent.name,
      loser: result === "win" ? opponent.name : me.name,
    });
  }

  return (
    <>
      <div className="field-head">
        <span>{t("record.result")}</span>
        <span className="muted">{t("record.against", { name: opponent.name })}</span>
      </div>
      <div className="outcome" role="radiogroup" aria-label={t("record.resultAria")}>
        <button
          type="button"
          role="radio"
          aria-checked={result === "win"}
          className="out win"
          onClick={() => onPick("win")}
        >
          {t("record.win")} <b className="num">{fmtDelta(me.winPoints)}</b>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={result === "loss"}
          className="out loss"
          onClick={() => onPick("loss")}
        >
          {t("record.loss")} <b className="num">{fmtDelta(me.lossPoints)}</b>
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button className="submit" disabled={!result || busy} onClick={onSubmit}>
        {submitLabel()}
      </button>
    </>
  );
}
