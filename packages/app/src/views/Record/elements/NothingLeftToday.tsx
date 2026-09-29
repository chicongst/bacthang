import { useLang } from "@app/i18n.js";

export function NothingLeftToday() {
  const { t } = useLang();

  return (
    <div className="record-done">
      <div className="num big-zero">0</div>
      <p>{t("record.allDone")}</p>
      <p className="muted">{t("record.doneSub")}</p>
    </div>
  );
}
