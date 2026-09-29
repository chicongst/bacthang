# Ranking: design

Date: 2026-09-17 · Status: architecture approved, the rest settled on the defaults (see the decision notes)

The Chrome extension shell described here was built, then removed from the repository on 2026-09-29.
The web app is the only shell now. Everything else below still holds, and the `Platform` seam the
extension needed is what keeps the UI testable.

## Goal

A leaderboard for one group of players, tied to no particular sport, with the board name set at build
time. Players sign in with Discord through a Chrome extension, record their own results, and see where
they and everyone else stand.

## Architecture

```
Browser ──────────────► Caddy ──┬── /api/*  ──► API (Fastify + Drizzle) ──► PostgreSQL
Chrome extension ─────►         └── the rest ──► web (nginx, static files)
        │                                │
        └── chrome.identity              └── page redirect
                    └──────► Discord OAuth ◄──── code exchange (client secret stays on the API)
```

- `server/`: TypeScript, Fastify 5, Drizzle ORM, node-postgres, Vitest.
- `app/`: the whole React UI, unaware of whether it runs in the web app or the extension.
- `web/`: the web shell. Sign-in by page redirect, session in `localStorage`, a responsive frame.
- `extension/`: the extension shell. `chrome.identity`, `chrome.storage`, a fixed 380x580 popup.
- `deploy/`: Docker Compose (caddy, web, api, postgres) and the Caddyfile.

Both shells plug into the shared UI through a `Platform` interface (read and clear the token, sign in,
current workspace). Adding a platform means writing one more `Platform`.

Caddy mounts the API under `/api`, so the web app and the API share a domain: no CORS, no extra DNS
record. The extension is configured with `VITE_API_BASE=https://<domain>/api`.

No backups at this stage (the project owner's decision).

Principle: the extension only displays and requests. Every rule (points, the daily limit, tiers) runs on
the API, inside a Postgres transaction.

## Workspaces

Each group is a **workspace**. Whoever creates it is the **owner**. Points, tiers, the leaderboard, match
history and the 3-per-day limit are all counted per workspace: playing at club A does not use up slots at
club B.

One Discord account can belong to several workspaces and switch between them from the header.

| Mode | How you get in |
|---|---|
| Public | Finding it in search is enough |
| Private | It still shows in search, but joining sends a request the owner has to approve |

The owner can flip this at any time from the Group tab.

An owner's powers inside their own workspace: approve or reject requests, remove members, delete
matches, rename the workspace, switch it between public and private. An owner can neither leave nor be
removed from their own workspace.

**Removed, then back again**: someone who was removed always has to be approved again, even in a public
workspace. Otherwise removing them accomplishes nothing, since they rejoin instantly. Someone who *left*
on their own is not affected.

**Points are never reset.** Leaving does not delete the membership row, it only changes a status
(`removed`, with `removed_by` to tell leaving apart from being removed). Coming back restores the old
points, the win/loss record and the slots already used today. The first version deleted the membership
row on leaving, so anyone who lost only had to leave and rejoin to wipe the deduction.

`ADMIN_DISCORD_IDS` is now the server admin list: owner powers in every workspace, meant for whoever
operates the instance.

Workspace search ignores Vietnamese diacritics: typing "quan" finds "CLB Quận 1". The folded name is
stored in a `name_folded` column, so Postgres does not need the `unaccent` extension.

## Scoring rules

| Rule | Value |
|---|---|
| Starting points | 1000 |
| Win | +20 |
| Loss | -20 |
| Limit | 3 matches per pair per day |
| What "a day" means | 00:00 to 23:59 Vietnam time (Asia/Ho_Chi_Minh, UTC+7) |
| Floor | None. Points can go below 0, though in practice they never do |

The limit counts **per pair**, not per person. A and B can play each other at most 3 times a day; A
against C is a separate budget with nothing to do with it.

The first version counted per person (5 a day) and had a hole: once A and B had used up each other's
slots, B could no longer record a match against C at all, even though those two had not played once.
Counting per pair removes that.

Win and loss are equal (+20 and -20), so the group's total points never change: climbing means taking
points off somebody else, and playing a lot while winning as often as you lose leaves you where you were.

### Tiers

Every 100 points is one tier:

| Tier | Points |
|---|---|
| Bronze | below 1000 |
| Silver | 1000 to 1099 |
| Gold | 1100 to 1199 |
| Platinum | 1200 to 1299 |
| Diamond | 1300 to 1399 |
| Master | 1400 and up |

The lowest and highest tiers are open-ended. At the top tier points keep climbing and are always shown
next to the tier name.

Badges are hand-drawn SVG (a shield in the tier colour), not assets taken from another game.

## Recording a result

- Self-reported, with no confirmation from the opponent (the project owner's decision).
- Whoever records it has to be one of the two players. No playing yourself.
- The opponent must have signed in at least once.
- Every match stores the points it added and subtracted, so deleting it reverses exactly the right
  amount even if the rules change later.
- Admins (the Discord IDs in `ADMIN_DISCORD_IDS`) can delete a match. Deletion is soft, the points come
  back, and the match stops counting toward the daily limit.
- The Recent tab shows every match as it is recorded, so a bogus one is easy to spot.

Guarding against concurrent writes: the transaction locks both membership rows (`SELECT ... FOR UPDATE`,
in id order to avoid a deadlock), counts today's matches, and only then writes. Two parallel requests
cannot get past the limit.

## Sign-in

1. The popup sends a message to the service worker (the popup closes as soon as the Discord window takes
   focus, so OAuth cannot run inside it).
2. The service worker calls `launchWebAuthFlow` against the Discord authorize endpoint, scope `identify`,
   with a `state`.
3. It receives a `code` and sends `POST /auth/discord { code, redirectUri }`.
4. The API exchanges the code using the client secret, calls `/users/@me`, upserts the user and creates
   a session.
5. Sessions: a random 32-byte token, of which the database stores only the SHA-256, expiring after 30
   days. The extension keeps the token in `chrome.storage.local` and sends `Authorization: Bearer`.

## Realtime updates

Each workspace has one SSE channel: `GET /workspaces/:id/events`. After every change (recording or
deleting a match, joining, approving, removing, changing settings) the API emits
`{ scope: "board" | "members" }` to everyone with that workspace open. Clients **take no data from the
event**, they call `/board` again, because rank and the "me" section differ per person and shipping them
inside the event would be wrong for somebody.

A few technical choices:

- **SSE, not WebSocket**: data only flows one way, from the server. A WebSocket would be surplus.
- **fetch + ReadableStream, not EventSource**: EventSource cannot set an `Authorization` header, so using
  it would mean putting the token in the URL, where tokens end up in server logs.
- Authentication happens before the stream opens, so a permission failure is still a normal 401 or 403.
- A 25-second heartbeat keeps the connection alive through proxies; Caddy sets `flush_interval -1` so it
  does not buffer.
- The client reconnects on its own, backing off from 1s to 15s.

The channel lives in the API process's memory, so it is **only correct while a single API instance runs**.
Running several means replacing it with Postgres `LISTEN/NOTIFY` or Redis pub/sub, which touches exactly
one file, `events.ts`.

## API

| Method | Path | Who |
|---|---|---|
| POST | `/auth/discord` · `/auth/logout` | anyone |
| GET | `/me` | my account plus my workspaces |
| GET | `/workspaces/search?q=` | search workspaces (diacritics folded) |
| POST | `/workspaces` | create one; the creator becomes owner |
| POST | `/workspaces/:id/join` | returns `active` or `pending` |
| POST | `/workspaces/:id/leave` | members (an owner cannot leave) |
| GET | `/workspaces/:id/board` | the board, my own row, the scoring rules and the slots left against each player, in one call |
| GET · POST | `/workspaces/:id/matches` | members |
| DELETE | `/workspaces/:id/matches/:matchId` | owner |
| GET | `/workspaces/:id/members` | owner (including pending requests) |
| POST | `/workspaces/:id/members/:userId/approve` | owner |
| DELETE | `/workspaces/:id/members/:userId` | owner (reject or remove) |
| GET | `/workspaces/:id/events` | members; the SSE channel |
| PATCH | `/workspaces/:id` | owner (rename, public/private) |

Errors return `{ error: { code, message } }`. The message is English and the client translates it by
code. The codes: `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `SELF_MATCH`,
`OPPONENT_NOT_FOUND`, `DAILY_LIMIT_REACHED`, `DISCORD_AUTH_FAILED`, `WORKSPACE_NOT_FOUND`, `NOT_MEMBER`,
`PENDING_APPROVAL`, `OWNER_CANNOT_LEAVE`, `TOO_MANY_STREAMS`, `RATE_LIMITED`, `INTERNAL`.

Ordering: points descending, and on a tie whoever reached that total first ranks higher.

## Extension

A 380x580 popup. With no workspace yet it opens straight on the find-or-create screen. After that come
the tabs, with the workspace switcher in the header:

- **Board**: the "me" card (rank, tier, points, matches today), the top 3 highlighted, then the list.
  Hovering an avatar opens a card with win rate, record, last match and slots left against me.
- **Record**: pick an opponent (searchable), then the win and loss buttons. The points on the buttons come
  from the API, never hardcoded in the UI.
- **Recent**: the latest matches, with a delete button for the owner.
- **Group**: for the owner, approve requests (with a count badge on the tab), remove members, rename,
  switch public/private. For a regular member, see the roster and leave.

## Language

Vietnamese and English, chosen with a flag button (hand-drawn SVG, because flag emoji do not render on
Windows). Precedence: `?lang=` in the URL, then the saved choice, then the browser language. Tier names
are translated from `tier.id` rather than taken from the server's text; API errors are translated by
code, and a code with no translation shows the server's own message.

## Testing

- Unit: tier calculation, the Vietnam day boundary, diacritic folding.
- Integration (a real Postgres in Docker): recording a match, the limit of 3 seen from both sides, the
  midnight boundary, 5 parallel requests, deletion restoring points, the sign-in flow against a fake
  Discord.
- Workspaces: create, search, join public and private, approve, remove, removal requiring approval on
  return while leaving does not, owner permissions, and points, slots and history staying separate
  between workspaces.
- The per-pair limit: running out against one person still allows recording against another, swapping who
  reports still counts as the same pair, and 8 parallel requests for one pair let exactly 3 through.
- Events: delivered only to the right workspace, one failing listener not blocking the others, and a test
  that opens a real HTTP stream then records a match to confirm the event arrives.
