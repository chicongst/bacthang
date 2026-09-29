import { useEffect, useState } from "react";
import { ApiError } from "@app/api.js";
import { usePlatform } from "@app/context.js";
import { useLang } from "@app/i18n.js";
import type { Board, Member } from "@app/types.js";
import { LeaveWorkspace } from "./elements/LeaveWorkspace.js";
import { MemberRoster, type RosterRow } from "./elements/MemberRoster.js";
import { PendingRequests } from "./elements/PendingRequests.js";
import { WorkspaceSettings } from "./elements/WorkspaceSettings.js";

function rosterRows(board: Board, members: Member[] | null, isOwner: boolean): RosterRow[] {
  if (!isOwner) return board.players;
  return (members ?? [])
    .filter((member) => member.status === "active")
    .map((member) => ({
      id: member.userId,
      name: member.name,
      avatarUrl: member.avatarUrl,
      role: member.role,
      tier: member.tier,
      points: member.points,
    }));
}

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
  const { t } = useLang();
  const { id: workspaceId, name: workspaceName, tournamentName, isPublic } = board.workspace;
  const isOwner = board.me.role === "owner";
  const [members, setMembers] = useState<Member[] | null>(null);
  const [name, setName] = useState(workspaceName);
  const [tournament, setTournament] = useState(tournamentName ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmKickId, setConfirmKickId] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    api.members(token, workspaceId).then(setMembers, () => setMembers([]));
  }, [token, workspaceId, isOwner, api, refreshKey]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (isOwner) setMembers(await api.members(token, workspaceId));
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("group.failed"));
    }
    setBusy(false);
  }

  const pending = members?.filter((member) => member.status === "pending") ?? [];

  return (
    <div className="group">
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {isOwner && pending.length > 0 && (
        <PendingRequests
          pending={pending}
          busy={busy}
          onApprove={(userId) => run(() => api.approve(token, workspaceId, userId))}
          onReject={(userId) => run(() => api.removeMember(token, workspaceId, userId))}
        />
      )}

      <MemberRoster
        rows={rosterRows(board, members, isOwner)}
        canKick={isOwner}
        busy={busy}
        confirmId={confirmKickId}
        onAskKick={setConfirmKickId}
        onCancelKick={() => setConfirmKickId(null)}
        onKick={(userId) => {
          setConfirmKickId(null);
          run(() => api.removeMember(token, workspaceId, userId));
        }}
      />

      {isOwner ? (
        <WorkspaceSettings
          name={name}
          savedName={workspaceName}
          tournament={tournament}
          savedTournament={tournamentName ?? ""}
          isPublic={isPublic}
          busy={busy}
          onNameChange={setName}
          onRename={() => run(() => api.updateWorkspace(token, workspaceId, { name: name.trim() }))}
          onTournamentChange={setTournament}
          onTournamentSave={() =>
            run(() => api.updateWorkspace(token, workspaceId, { tournamentName: tournament.trim() }))
          }
          onModeChange={(next) => run(() => api.updateWorkspace(token, workspaceId, { isPublic: next }))}
        />
      ) : (
        <LeaveWorkspace
          workspaceName={workspaceName}
          busy={busy}
          confirming={leaving}
          onAsk={() => setLeaving(true)}
          onCancel={() => setLeaving(false)}
          onLeave={() =>
            run(async () => {
              await api.leave(token, workspaceId);
              onLeft();
            })
          }
        />
      )}
    </div>
  );
}
