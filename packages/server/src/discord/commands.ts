export const OPTION_TYPE = { integer: 4, user: 6 } as const;

export const BOARD_OPTION = "board";
export const OPPONENT_OPTION = "opponent";

export type CommandName = "win" | "loss" | "board" | "me";

interface OptionSpec {
  type: number;
  name: string;
  description: string;
  description_localizations: { vi: string };
  required?: boolean;
  autocomplete?: boolean;
}

interface CommandSpec {
  name: CommandName;
  description: string;
  description_localizations: { vi: string };
  options: OptionSpec[];
}

const opponent: OptionSpec = {
  type: OPTION_TYPE.user,
  name: OPPONENT_OPTION,
  description: "Who you played",
  description_localizations: { vi: "Người bạn vừa đánh" },
  required: true,
};

// Only offered so people on several boards can say which one; everyone else never sees it.
const board: OptionSpec = {
  type: OPTION_TYPE.integer,
  name: BOARD_OPTION,
  description: "Which board, if you are on more than one",
  description_localizations: { vi: "Bảng nào, nếu bạn ở nhiều bảng" },
  autocomplete: true,
};

export const COMMANDS: CommandSpec[] = [
  {
    name: "win",
    description: "Record a win",
    description_localizations: { vi: "Ghi một trận thắng" },
    options: [opponent, board],
  },
  {
    name: "loss",
    description: "Record a loss",
    description_localizations: { vi: "Ghi một trận thua" },
    options: [opponent, board],
  },
  {
    name: "board",
    description: "Show the standings",
    description_localizations: { vi: "Xem bảng xếp hạng" },
    options: [board],
  },
  {
    name: "me",
    description: "Your points, rank and how many matches you have left today",
    description_localizations: { vi: "Điểm, hạng và số trận còn lại hôm nay của bạn" },
    options: [board],
  },
];
