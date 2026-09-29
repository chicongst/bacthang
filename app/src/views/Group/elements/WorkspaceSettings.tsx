import { ModeChoice } from "@app/components/ModeChoice.js";
import { TOURNAMENT_NAME_MAX, WORKSPACE_NAME_MAX, WORKSPACE_NAME_MIN } from "@app/constants.js";
import { useLang } from "@app/i18n.js";

export function WorkspaceSettings({
  name,
  savedName,
  tournament,
  savedTournament,
  isPublic,
  busy,
  onNameChange,
  onRename,
  onTournamentChange,
  onTournamentSave,
  onModeChange,
}: {
  name: string;
  savedName: string;
  tournament: string;
  savedTournament: string;
  isPublic: boolean;
  busy: boolean;
  onNameChange: (name: string) => void;
  onRename: () => void;
  onTournamentChange: (name: string) => void;
  onTournamentSave: () => void;
  onModeChange: (isPublic: boolean) => void;
}) {
  const { t } = useLang();
  const trimmed = name.trim();
  const canSave = !busy && trimmed !== savedName && trimmed.length >= WORKSPACE_NAME_MIN;
  const canSaveTournament = !busy && tournament.trim() !== savedTournament;

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
      <label className="field-label" htmlFor="ws-tournament">
        {t("group.tournament")}
      </label>
      <div className="rename">
        <input
          id="ws-tournament"
          className="search"
          value={tournament}
          maxLength={TOURNAMENT_NAME_MAX}
          placeholder={t("group.tournamentPlaceholder")}
          onChange={(event) => onTournamentChange(event.target.value)}
        />
        <button className="mini primary" disabled={!canSaveTournament} onClick={onTournamentSave}>
          {t("group.save")}
        </button>
      </div>
      <p className="fine">{t("group.tournamentHint")}</p>

      <ModeChoice isPublic={isPublic} disabled={busy} onPick={onModeChange} />
    </section>
  );
}
