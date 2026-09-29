import { useMemo, useState } from "react";
import type { BoardMe, Player } from "../types.js";
import { Avatar } from "../components/Avatar.js";
import { TierBadge } from "../components/TierBadge.js";
import { fmtDelta } from "../format.js";
import { useLang } from "../i18n.js";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export function Record({
  me,
  players,
  onSubmit,
}: {
  me: BoardMe;
  players: Player[];
  onSubmit: (opponentId: number, result: "win" | "loss") => Promise<string | null>;
}) {
  const { t, tierName } = useLang();
  const [query, setQuery] = useState("");
  const [opponentId, setOpponentId] = useState<number | null>(null);
  const [result, setResult] = useState<"win" | "loss" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const everyone = useMemo(() => players.filter((p) => p.id !== me.id), [players, me.id]);
  const opponents = useMemo(() => {
    const q = fold(query.trim());
    return everyone.filter((p) => !q || fold(p.name).includes(q));
  }, [everyone, query]);
  const opponent = players.find((p) => p.id === opponentId);

  // Giới hạn theo cặp: chỉ hết việc khi đã đủ lượt với tất cả mọi người.
  if (everyone.length > 0 && everyone.every((p) => p.remainingWithMe === 0)) {
    return (
      <div className="record-done">
        <div className="num big-zero">0</div>
        <p>{t("record.allDone")}</p>
        <p className="muted">{t("record.doneSub")}</p>
      </div>
    );
  }
  if (everyone.length === 0) {
    return <p className="empty">{t("record.noOpponents")}</p>;
  }

  async function submit() {
    if (!opponentId || !result) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(opponentId, result);
    setBusy(false);
    if (err) setError(err);
    else {
      setOpponentId(null);
      setResult(null);
      setQuery("");
    }
  }

  return (
    <div className="record">
      <div className="field-head">
        <label htmlFor="opp-search">{t("record.opponent")}</label>
      </div>
      <input
        id="opp-search"
        className="search"
        placeholder={t("record.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      <ul className="picker" role="radiogroup" aria-label={t("record.pickAria")}>
        {opponents.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              role="radio"
              aria-checked={p.id === opponentId}
              className="pick"
              disabled={p.remainingWithMe === 0}
              onClick={() => { setOpponentId(p.id); setResult(null); setError(null); }}
            >
              <Avatar name={p.name} url={p.avatarUrl} size={26} />
              <span className="pick-name">{p.name}</span>
              <span className="pick-left">
                {p.remainingWithMe === 0 ? t("record.exhausted") : t("record.remaining", { n: p.remainingWithMe })}
              </span>
              <TierBadge tier={p.tier.id} size={18} title={tierName(p.tier.id)} />
            </button>
          </li>
        ))}
        {opponents.length === 0 && <li className="empty small">{t("record.noone")}</li>}
      </ul>

      {/* Phần kết quả chỉ hiện sau khi đã chọn đối thủ — không có đối thủ thì nút thắng/thua vô nghĩa. */}
      {opponent ? (
        <>
          <div className="field-head">
            <span>{t("record.result")}</span>
            <span className="muted">{t("record.against", { name: opponent.name })}</span>
          </div>
          <div className="outcome" role="radiogroup" aria-label={t("record.resultAria")}>
            <button type="button" role="radio" aria-checked={result === "win"} className="out win" onClick={() => setResult("win")}>
              {t("record.win")} <b className="num">{fmtDelta(me.winPoints)}</b>
            </button>
            <button type="button" role="radio" aria-checked={result === "loss"} className="out loss" onClick={() => setResult("loss")}>
              {t("record.loss")} <b className="num">{fmtDelta(me.lossPoints)}</b>
            </button>
          </div>

          {error && <p className="error" role="alert">{error}</p>}

          <button className="submit" disabled={!result || busy} onClick={submit}>
            {busy
              ? t("record.saving")
              : result
                ? t("record.submit", {
                    winner: result === "win" ? me.name : opponent.name,
                    loser: result === "win" ? opponent.name : me.name,
                  })
                : t("record.pickResult")}
          </button>
        </>
      ) : (
        <p className="rule-note">{t("record.choose")}</p>
      )}
    </div>
  );
}
