import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { users } from "../db/schema.js";
import { DAILY_LIMIT_PER_PAIR } from "../domain/rules.js";
import { AppError } from "../errors.js";
import type { EventScope } from "../events.js";
import { getBoard } from "../services/board.js";
import { recordMatch } from "../services/matches.js";
import { myWorkspaces } from "../services/memberships.js";
import { BOARD_OPTION, OPPONENT_OPTION, type CommandName } from "./commands.js";
import { errorText, langOf, limitReached, padName, safeName, say, type Lang } from "./messages.js";

export const INTERACTION = { ping: 1, command: 2, autocomplete: 4 } as const;
const RESPONSE = { pong: 1, message: 4, choices: 8 } as const;
const EPHEMERAL = 1 << 6;

const BOARD_ROWS = 12;
const OPPONENTS_SHOWN = 8;
const CHOICE_LIMIT = 25;

export interface InteractionOption {
  name: string;
  value?: string | number;
  focused?: boolean;
}

export interface Interaction {
  type: number;
  locale?: string;
  data?: { name?: string; options?: InteractionOption[] };
  member?: { user?: { id?: string } };
  user?: { id?: string };
}

export interface InteractionResponse {
  type: number;
  data?: Record<string, unknown>;
}

export interface InteractionDeps {
  db: Db;
  now(): Date;
  emit(workspaceId: number, scope: EventScope): void;
  signInUrl: string;
}

interface Account {
  id: number;
  name: string;
}

interface Command {
  lang: Lang;
  account: Account;
  options: InteractionOption[];
}

type Board = { id: number; name: string };
type PickedBoard = { board: Board } | { reply: InteractionResponse };

// Display names reach these replies verbatim, and a public one would otherwise let a player
// called @everyone ping the channel on every match that names them.
const NO_MENTIONS = { parse: [] as string[] };

const message = (content: string, ephemeral: boolean): InteractionResponse => ({
  type: RESPONSE.message,
  data: { content, allowed_mentions: NO_MENTIONS, ...(ephemeral ? { flags: EPHEMERAL } : {}) },
});
const onlyYou = (content: string) => message(content, true);
const everyone = (content: string) => message(content, false);

const option = (options: InteractionOption[], name: string) => options.find((o) => o.name === name)?.value;

async function accountFor(db: Db, discordId: string): Promise<Account | null> {
  const [found] = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(eq(users.discordId, discordId));
  return found ?? null;
}

type Membership = Awaited<ReturnType<typeof myWorkspaces>>[number];

const activeOf = (mine: Membership[]): Board[] =>
  mine.filter((w) => w.status === "active").map((w) => ({ id: w.id, name: w.name }));

async function activeBoards(db: Db, userId: number): Promise<Board[]> {
  return activeOf(await myWorkspaces(db, userId));
}

async function pickBoard(deps: InteractionDeps, cmd: Command): Promise<PickedBoard> {
  const t = say(cmd.lang);
  const all = await myWorkspaces(deps.db, cmd.account.id);
  const mine = activeOf(all);
  const asked = option(cmd.options, BOARD_OPTION);

  if (typeof asked === "number") {
    const found = mine.find((w) => w.id === asked);
    return found ? { board: found } : { reply: onlyYou(t.unknownBoard) };
  }
  if (mine.length === 0) {
    return { reply: onlyYou(all.length > 0 ? t.waitingApproval : t.noBoards(deps.signInUrl)) };
  }
  if (mine.length > 1) return { reply: onlyYou(t.pickBoard(mine.map((w) => safeName(w.name)).join(", "))) };
  return { board: mine[0]! };
}

async function play(deps: InteractionDeps, cmd: Command, result: "win" | "loss"): Promise<InteractionResponse> {
  const t = say(cmd.lang);
  const picked = await pickBoard(deps, cmd);
  if ("reply" in picked) return picked.reply;

  const target = option(cmd.options, OPPONENT_OPTION);
  const opponent = typeof target === "string" ? await accountFor(deps.db, target) : null;
  if (!opponent) return onlyYou(t.unknownOpponent(typeof target === "string" ? `<@${target}>` : "?"));

  const now = deps.now();
  const input = { workspaceId: picked.board.id, reporterId: cmd.account.id, opponentId: opponent.id, result, now };
  let delta: number;
  try {
    const match = await recordMatch(deps.db, input);
    delta = result === "win" ? match.winnerDelta : match.loserDelta;
  } catch (err) {
    if (err instanceof AppError) {
      const limit = err.code === "DAILY_LIMIT_REACHED";
      return onlyYou(
        limit ? limitReached(cmd.lang, safeName(opponent.name), DAILY_LIMIT_PER_PAIR) : errorText(cmd.lang, err.code),
      );
    }
    throw err;
  }
  deps.emit(picked.board.id, "board");

  const board = await getBoard(deps.db, { workspaceId: picked.board.id, userId: cmd.account.id, now });
  const left = board.players.find((p) => p.id === opponent.id)?.remainingWithMe ?? 0;
  return everyone(
    [
      t.recorded(safeName(cmd.account.name), safeName(opponent.name), result === "win"),
      `${t.standing(board.me.points, delta, board.me.rank)} · ${t.remaining(left, safeName(opponent.name))}`,
    ].join("\n"),
  );
}

async function standings(deps: InteractionDeps, cmd: Command): Promise<InteractionResponse> {
  const t = say(cmd.lang);
  const picked = await pickBoard(deps, cmd);
  if ("reply" in picked) return picked.reply;

  const board = await getBoard(deps.db, { workspaceId: picked.board.id, userId: cmd.account.id, now: deps.now() });
  const shown = board.players.slice(0, BOARD_ROWS);
  const rows = shown.map(
    (p) =>
      `${String(p.rank).padStart(2)}  ${padName(p.name)}${String(p.points).padStart(5)}   ${t.record(p.wins, p.losses)}`,
  );
  const hidden = board.players.length - shown.length;
  return onlyYou(
    [
      `**${safeName(board.workspace.name)}** · ${t.season(board.workspace.season.number)}`,
      "```",
      ...rows,
      "```",
      hidden > 0 ? t.andMore(hidden) : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function card(deps: InteractionDeps, cmd: Command): Promise<InteractionResponse> {
  const t = say(cmd.lang);
  const picked = await pickBoard(deps, cmd);
  if ("reply" in picked) return picked.reply;

  const board = await getBoard(deps.db, { workspaceId: picked.board.id, userId: cmd.account.id, now: deps.now() });
  const me = board.me;
  const others = board.players
    .filter((p) => p.id !== me.id)
    .slice(0, OPPONENTS_SHOWN)
    .map((p) => `${safeName(p.name)} ${p.remainingWithMe}`)
    .join(" · ");
  return onlyYou(
    [
      `**${safeName(board.workspace.name)}** · ${t.season(board.workspace.season.number)}`,
      [t.rank(me.rank), t.points(me.points), me.tier.name, t.record(me.wins, me.losses), t.playedToday(me.matchesToday)].join(
        " · ",
      ),
      others ? `${t.leftToday}: ${others}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function boardChoices(deps: InteractionDeps, account: Account, options: InteractionOption[]) {
  const typed = String(options.find((o) => o.focused)?.value ?? "").toLowerCase();
  const mine = await activeBoards(deps.db, account.id);
  const choices = mine
    .filter((w) => !typed || w.name.toLowerCase().includes(typed))
    .slice(0, CHOICE_LIMIT)
    .map((w) => ({ name: w.name, value: w.id }));
  return { type: RESPONSE.choices, data: { choices } };
}

async function run(deps: InteractionDeps, name: CommandName, cmd: Command): Promise<InteractionResponse> {
  switch (name) {
    case "win":
      return play(deps, cmd, "win");
    case "loss":
      return play(deps, cmd, "loss");
    case "board":
      return standings(deps, cmd);
    case "me":
      return card(deps, cmd);
  }
}

export async function handleInteraction(deps: InteractionDeps, body: Interaction): Promise<InteractionResponse> {
  if (body.type === INTERACTION.ping) return { type: RESPONSE.pong };

  const lang = langOf(body.locale);
  const t = say(lang);
  const discordId = body.member?.user?.id ?? body.user?.id;
  const name = body.data?.name as CommandName | undefined;
  if (!discordId || !name) return onlyYou(t.failed);

  const account = await accountFor(deps.db, discordId);
  if (!account) return onlyYou(t.signIn(deps.signInUrl));

  const options = body.data?.options ?? [];
  if (body.type === INTERACTION.autocomplete) return boardChoices(deps, account, options);
  if (body.type !== INTERACTION.command) return onlyYou(t.failed);

  try {
    return await run(deps, name, { lang, account, options });
  } catch (err) {
    if (err instanceof AppError) return onlyYou(errorText(lang, err.code));
    throw err;
  }
}
