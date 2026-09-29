import type { Role, Tier } from "@app/types.js";
import { Avatar } from "@app/components/Avatar.js";
import { TierBadge } from "@app/components/TierBadge.js";
import { useLang } from "@app/i18n.js";

export interface RosterRow {
  id: number;
  name: string;
  avatarUrl: string | null;
  role: Role;
  tier: Tier;
  points: number;
}

export function MemberRoster({
  rows,
  canKick,
  busy,
  confirmId,
  onAskKick,
  onCancelKick,
  onKick,
}: {
  rows: RosterRow[];
  canKick: boolean;
  busy: boolean;
  confirmId: number | null;
  onAskKick: (userId: number) => void;
  onCancelKick: () => void;
  onKick: (userId: number) => void;
}) {
  const { t, tierName } = useLang();

  return (
    <section>
      <h3 className="sec">{t("group.members", { n: rows.length })}</h3>
      <ul className="member-list">
        {rows.map((member) => (
          <li key={member.id} className="member">
            <Avatar name={member.name} url={member.avatarUrl} size={28} />
            <span className="member-name">
              {member.name}
              {member.role === "owner" && <span className="owner-tag">{t("group.owner")}</span>}
            </span>
            <TierBadge tier={member.tier.id} size={18} title={tierName(member.tier.id)} />
            <span className="num member-points">{member.points}</span>
            {canKick && member.role !== "owner" && (
              <KickControl
                busy={busy}
                confirming={confirmId === member.id}
                onAsk={() => onAskKick(member.id)}
                onCancel={onCancelKick}
                onKick={() => onKick(member.id)}
              />
            )}
          </li>
        ))}
      </ul>
      {canKick && <p className="fine">{t("group.kickNote")}</p>}
    </section>
  );
}

function KickControl({
  busy,
  confirming,
  onAsk,
  onCancel,
  onKick,
}: {
  busy: boolean;
  confirming: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onKick: () => void;
}) {
  const { t } = useLang();

  if (!confirming) {
    return (
      <button className="mini" onClick={onAsk}>
        {t("group.kick")}
      </button>
    );
  }

  return (
    <span className="member-actions">
      <button className="mini danger" disabled={busy} onClick={onKick}>
        {t("group.kick")}
      </button>
      <button className="mini" onClick={onCancel}>
        {t("group.cancel")}
      </button>
    </span>
  );
}
