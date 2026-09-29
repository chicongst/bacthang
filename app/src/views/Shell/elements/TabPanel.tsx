import type { Board, MatchResult, RecentMatch, Tab } from "@app/types.js";
import { Board as BoardView } from "@app/views/Board/index.js";
import { Group } from "@app/views/Group/index.js";
import { Recent } from "@app/views/Recent.js";
import { Record } from "@app/views/Record/index.js";
import { Rules } from "@app/views/Rules.js";

export function TabPanel({
  tab,
  token,
  board,
  recent,
  canDeleteMatches,
  membersVersion,
  onRecord,
  onDeleteMatch,
  onMembersChanged,
  onLeft,
}: {
  tab: Tab;
  token: string;
  board: Board;
  recent: RecentMatch[] | null;
  canDeleteMatches: boolean;
  membersVersion: number;
  onRecord: (opponentId: number, result: MatchResult) => Promise<string | null>;
  onDeleteMatch: (matchId: number) => Promise<string | null>;
  onMembersChanged: () => void;
  onLeft: () => void;
}) {
  if (tab === "record") {
    return <Record me={board.me} players={board.players} onSubmit={onRecord} />;
  }
  if (tab === "recent") {
    return <Recent matches={recent} canDelete={canDeleteMatches} onDelete={onDeleteMatch} />;
  }
  if (tab === "rules") {
    return <Rules rules={board.rules} me={board.me} />;
  }
  if (tab === "group") {
    return (
      <Group
        token={token}
        board={board}
        refreshKey={membersVersion}
        onChanged={onMembersChanged}
        onLeft={onLeft}
      />
    );
  }

  return <BoardView players={board.players} meId={board.me.id} />;
}
