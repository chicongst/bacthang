import { useLang } from "@app/i18n.js";

export function ModeChoice({
  isPublic,
  disabled = false,
  onPick,
}: {
  isPublic: boolean;
  disabled?: boolean;
  onPick: (isPublic: boolean) => void;
}) {
  const { t } = useLang();

  return (
    <div className="modes" role="radiogroup" aria-label={t("ws.modeAria")}>
      <button
        type="button"
        role="radio"
        aria-checked={isPublic}
        className="mode"
        disabled={disabled}
        onClick={() => onPick(true)}
      >
        <b>{t("ws.public")}</b>
        <span>{t("ws.publicHint")}</span>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={!isPublic}
        className="mode"
        disabled={disabled}
        onClick={() => onPick(false)}
      >
        <b>{t("ws.private")}</b>
        <span>{t("ws.privateHint")}</span>
      </button>
    </div>
  );
}
