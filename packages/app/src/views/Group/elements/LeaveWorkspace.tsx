import { useLang } from "@app/i18n.js";

export function LeaveWorkspace({
  workspaceName,
  busy,
  confirming,
  onAsk,
  onCancel,
  onLeave,
}: {
  workspaceName: string;
  busy: boolean;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onLeave: () => void;
}) {
  const { t } = useLang();

  return (
    <section>
      <h3 className="sec">{t("group.leave")}</h3>
      {confirming ? (
        <div className="leave-confirm">
          <p>{t("group.leaveConfirm", { name: workspaceName })}</p>
          <span className="member-actions">
            <button className="mini danger" disabled={busy} onClick={onLeave}>
              {t("group.leaveDo")}
            </button>
            <button className="mini" onClick={onCancel}>
              {t("group.cancel")}
            </button>
          </span>
        </div>
      ) : (
        <button className="ghost" onClick={onAsk}>
          {t("group.leaveButton")}
        </button>
      )}
    </section>
  );
}
