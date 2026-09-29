import type { BoardMe, Rules as RuleSet } from "../types.js";
import { fmtDelta } from "../format.js";
import { useLang } from "../i18n.js";
import { TierBadge } from "../components/TierBadge.js";

/** Mọi con số lấy từ máy chủ, không viết cứng ở đây. */
export function Rules({ rules, me }: { rules: RuleSet; me: BoardMe }) {
  const { t, tierName } = useLang();

  return (
    <div className="rules">
      <section>
        <h3 className="sec">{t("rules.points.title")}</h3>
        <div className="deltas-grid">
          <div className="delta-card win">
            <span>{t("rules.points.win")}</span>
            <b className="num">{fmtDelta(rules.winPoints)}</b>
          </div>
          <div className="delta-card loss">
            <span>{t("rules.points.loss")}</span>
            <b className="num">{fmtDelta(rules.lossPoints)}</b>
          </div>
        </div>
      </section>

      <section>
        <h3 className="sec">{t("rules.daily.title", { n: rules.dailyLimitPerPair })}</h3>
        <p className="rule-line">{t("rules.daily.body", { n: rules.dailyLimitPerPair })}</p>
      </section>

      <section>
        <h3 className="sec">{t("rules.tiers.title")}</h3>
        <p className="rule-line">{t("rules.tiers.body")}</p>
        <ul className="ladder">
          {[...rules.tiers].reverse().map((tier) => (
            <li key={tier.id} className={tier.id === me.tier.id ? "on" : ""}>
              <TierBadge tier={tier.id} size={26} title={tierName(tier.id)} />
              <span className="ladder-name">{tierName(tier.id)}</span>
              {tier.id === me.tier.id && <span className="ladder-you">{t("rules.tiers.you")}</span>}
              <span className="ladder-points num">
                {tier.minPoints === null
                  ? t("rules.tiers.under", { n: rules.startPoints })
                  : t("rules.tiers.from", { n: tier.minPoints })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="sec">{t("rules.report.title")}</h3>
        <p className="rule-line">{t("rules.report.body")}</p>
      </section>


    </div>
  );
}
