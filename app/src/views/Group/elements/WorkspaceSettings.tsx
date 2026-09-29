import { ModeChoice } from "@app/components/ModeChoice.js";
import { WORKSPACE_NAME_MAX, WORKSPACE_NAME_MIN } from "@app/constants.js";
import { useLang } from "@app/i18n.js";

export function WorkspaceSettings({
  name,
  savedName,
  isPublic,
  busy,
  onNameChange,
  onRename,
  onModeChange,
}: {
  name: string;
  savedName: string;
  isPublic: boolean;
  busy: boolean;
  onNameChange: (name: string) => void;
  onRename: () => void;
  onModeChange: (isPublic: boolean) => void;
}) {
  const { t } = useLang();
  const trimmed = name.trim();
  const canSave = !busy && trimmed !== savedName && trimmed.length >= WORKSPACE_NAME_MIN;

  return (
    <section>
      <h3 className="sec">{t("group.settings")}</h3>
      <label className="field-label" htmlFor="ws-rename">
        {t("group.name")}
      </label>
      <div className="rename">
        <input
          id="ws-rename"
          className="search"
          value={name}
          maxLength={WORKSPACE_NAME_MAX}
          onChange={(event) => onNameChange(event.target.value)}
        />
        <button className="mini primary" disabled={!canSave} onClick={onRename}>
          {t("group.save")}
        </button>
      </div>
      <ModeChoice isPublic={isPublic} disabled={busy} onPick={onModeChange} />
    </section>
  );
}
