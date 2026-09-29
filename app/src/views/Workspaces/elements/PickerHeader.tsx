import { LangToggle } from "@app/components/LangToggle.js";
import { useLang } from "@app/i18n.js";

export function PickerHeader({
  title,
  canCancel,
  onCancel,
}: {
  title: string;
  canCancel: boolean;
  onCancel: () => void;
}) {
  const { t } = useLang();

  return (
    <header className="picker-top">
      <div>
        <p className="eyebrow">{t("ws.eyebrow")}</p>
        <h1>{title}</h1>
      </div>
      <span className="picker-actions">
        <LangToggle />
        {canCancel && (
          <button className="icon-btn" onClick={onCancel} aria-label={t("ws.backAria")}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </span>
    </header>
  );
}
