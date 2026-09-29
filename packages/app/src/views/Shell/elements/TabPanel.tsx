import type { Board, MatchResult, Player, RecentMatch, Season, SeasonTable, Tab } from "@app/types.js";
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
  seasons,
  archive,
  onPickSeason,
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
  seasons: Season[] | null;
  archive: SeasonTable | null;
  onPickSeason: (seasonId: number | null) => void;
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

  // An archived row has no matches left to play, so the fields the live board needs are
  // filled in rather than threaded through as optional everywhere.
  const archived: Player[] | null =
    archive?.players.map((row) => ({ ...row, role: "member" as const, lastMatchAt: null, remainingWithMe: 0 })) ?? null;

  return (
    <BoardView
      players={archived ?? board.players}
      meId={board.me.id}
      seasons={seasons}
      currentSeason={board.workspace.season.number}
      viewingSeason={archive?.season.id ?? null}
      onPickSeason={onPickSeason}
    />
  );
}
