import { ModeChoice } from "@app/components/ModeChoice.js";
import { WORKSPACE_NAME_MAX, WORKSPACE_NAME_MIN } from "@app/constants.js";
import { useLang } from "@app/i18n.js";

export function CreateWorkspaceForm({
  name,
  isPublic,
  busy,
  error,
  onNameChange,
  onModeChange,
  onCreate,
  onBack,
}: {
  name: string;
  isPublic: boolean;
  busy: boolean;
  error: string | null;
  onNameChange: (name: string) => void;
  onModeChange: (isPublic: boolean) => void;
  onCreate: () => void;
  onBack: () => void;
}) {
  const { t } = useLang();

  return (
    <div className="create">
      <label className="field-label" htmlFor="ws-name">
        {t("ws.name")}
      </label>
      <input
        id="ws-name"
        className="search"
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder={t("ws.namePlaceholder")}
        maxLength={WORKSPACE_NAME_MAX}
        autoFocus
      />
      <ModeChoice isPublic={isPublic} onPick={onModeChange} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="submit" disabled={name.trim().length < WORKSPACE_NAME_MIN || busy} onClick={onCreate}>
        {busy ? t("ws.creating") : t("ws.create")}
      </button>
      <button className="ghost" onClick={onBack}>
        {t("ws.back")}
      </button>
    </div>
  );
}
