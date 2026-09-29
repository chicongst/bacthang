import { useEffect, useState } from "react";
import type { Board, Member } from "../types.js";
import { ApiError } from "../api.js";
import { usePlatform } from "../context.js";
import { Avatar } from "../components/Avatar.js";
import { TierBadge } from "../components/TierBadge.js";
import { useLang } from "../i18n.js";

export function Group({
  token,
  board,
  refreshKey,
  onChanged,
  onLeft,
}: {
  token: string;
  board: Board;
  refreshKey: number;
  onChanged: () => void;
  onLeft: () => void;
}) {
  const { api } = usePlatform();
  const { t, tierName } = useLang();
  const isOwner = board.me.role === "owner";
  const [members, setMembers] = useState<Member[] | null>(null);
  const [name, setName] = useState(board.workspace.name);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    api.members(token, board.workspace.id).then(setMembers, () => setMembers([]));
  }, [token, board.workspace.id, isOwner, api, refreshKey]);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (isOwner) setMembers(await api.members(token, board.workspace.id));
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("group.failed"));
    }
    setBusy(false);
  }

  const pending = members?.filter((m) => m.status === "pending") ?? [];
  const active = members?.filter((m) => m.status === "active") ?? [];

  return (
    <div className="group">
      {error && <p className="error" role="alert">{error}</p>}

      {isOwner && pending.length > 0 && (
        <section>
          <h3 className="sec">{t("group.pending", { n: pending.length })}</h3>
          <ul className="member-list">
            {pending.map((m) => (
              <li key={m.userId} className="member">
                <Avatar name={m.name} url={m.avatarUrl} size={28} />
                <span className="member-name">{m.name}</span>
                <span className="member-actions">
                  <button className="mini primary" disabled={busy} onClick={() => run(() => api.approve(token, board.workspace.id, m.userId))}>
                    {t("group.approve")}
                  </button>
                  <button className="mini" disabled={busy} onClick={() => run(() => api.removeMember(token, board.workspace.id, m.userId))}>
                    {t("group.reject")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="sec">{t("group.members", { n: isOwner ? active.length : board.players.length })}</h3>
        <ul className="member-list">
          {(isOwner
            ? active.map((m) => ({ id: m.userId, name: m.name, avatarUrl: m.avatarUrl, role: m.role, tier: m.tier, points: m.points }))
            : board.players
          ).map((m) => (
            <li key={m.id} className="member">
              <Avatar name={m.name} url={m.avatarUrl} size={28} />
              <span className="member-name">
                {m.name}
                {m.role === "owner" && <span className="owner-tag">{t("group.owner")}</span>}
              </span>
              <TierBadge tier={m.tier.id} size={18} title={tierName(m.tier.id)} />
              <span className="num member-points">{m.points}</span>
              {isOwner && m.role !== "owner" && (
                confirmId === m.id ? (
                  <span className="member-actions">
                    <button className="mini danger" disabled={busy} onClick={() => { setConfirmId(null); run(() => api.removeMember(token, board.workspace.id, m.id)); }}>
                      {t("group.kick")}
                    </button>
                    <button className="mini" onClick={() => setConfirmId(null)}>{t("group.cancel")}</button>
                  </span>
                ) : (
                  <button className="mini" onClick={() => setConfirmId(m.id)}>{t("group.kick")}</button>
                )
              )}
            </li>
          ))}
        </ul>
        {isOwner && <p className="fine">{t("group.kickNote")}</p>}
      </section>

      {isOwner ? (
        <section>
          <h3 className="sec">{t("group.settings")}</h3>
          <label className="field-label" htmlFor="ws-rename">{t("group.name")}</label>
          <div className="rename">
            <input id="ws-rename" className="search" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <button
              className="mini primary"
              disabled={busy || name.trim() === board.workspace.name || name.trim().length < 2}
              onClick={() => run(() => api.updateWorkspace(token, board.workspace.id, { name: name.trim() }))}
            >
              {t("group.save")}
            </button>
          </div>
          <div className="modes" role="radiogroup" aria-label={t("ws.modeAria")}>
            <button
              type="button"
              role="radio"
              aria-checked={board.workspace.isPublic}
              className="mode"
              disabled={busy}
              onClick={() => run(() => api.updateWorkspace(token, board.workspace.id, { isPublic: true }))}
            >
              <b>{t("ws.public")}</b>
              <span>{t("ws.publicHint")}</span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!board.workspace.isPublic}
              className="mode"
              disabled={busy}
              onClick={() => run(() => api.updateWorkspace(token, board.workspace.id, { isPublic: false }))}
            >
              <b>{t("ws.private")}</b>
              <span>{t("ws.privateHint")}</span>
            </button>
          </div>
        </section>
      ) : (
        <section>
          <h3 className="sec">{t("group.leave")}</h3>
          {leaving ? (
            <div className="leave-confirm">
              <p>{t("group.leaveConfirm", { name: board.workspace.name })}</p>
              <span className="member-actions">
                <button className="mini danger" disabled={busy} onClick={() => run(async () => { await api.leave(token, board.workspace.id); onLeft(); })}>
                  {t("group.leaveDo")}
                </button>
                <button className="mini" onClick={() => setLeaving(false)}>{t("group.cancel")}</button>
              </span>
            </div>
          ) : (
            <button className="ghost" onClick={() => setLeaving(true)}>{t("group.leaveButton")}</button>
          )}
        </section>
      )}
    </div>
  );
}
