import type { Member } from "@app/types.js";
import { Avatar } from "@app/components/Avatar.js";
import { useLang } from "@app/i18n.js";

export function PendingRequests({
  pending,
  busy,
  onApprove,
  onReject,
}: {
  pending: Member[];
  busy: boolean;
  onApprove: (userId: number) => void;
  onReject: (userId: number) => void;
}) {
  const { t } = useLang();

  return (
    <section>
      <h3 className="sec">{t("group.pending", { n: pending.length })}</h3>
      <ul className="member-list">
        {pending.map((member) => (
          <li key={member.userId} className="member">
            <Avatar name={member.name} url={member.avatarUrl} size={28} />
            <span className="member-name">{member.name}</span>
            <span className="member-actions">
              <button className="mini primary" disabled={busy} onClick={() => onApprove(member.userId)}>
                {t("group.approve")}
              </button>
              <button className="mini" disabled={busy} onClick={() => onReject(member.userId)}>
                {t("group.reject")}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
