# Code audit

Date: 2026-09-29 · Scope: all of `server/`, `app/`, `web/`, `deploy/`

The Chrome extension shell audited here was removed from the repository afterwards; its rows are kept
because the findings shaped the code that stayed.

## First pass

**Verdict: NEEDS WORK.** No blockers, but four majors had to go before opening the source.

**Blast radius**: if this code is wrong, a group loses its leaderboard and match history. No money, no
sensitive data beyond a Discord display name and avatar. The source is about to be public and the
server already runs on the internet, so resource-abuse holes were a real risk.

**Coverage**: read in full `server/src` (1150 lines) and `app/src` (about 1600 lines); skimmed `web/`,
`extension/`, `deploy/`; did not read CSS or sample data.

### Majors

**M1 · Performance · `services/workspaces.ts`**
`getBoard` ran one COUNT query per player to compute `remainingWithMe`. A group of 20 meant 20 queries
per board load, and realtime made it far worse: every recorded match makes every open client reload the
board, so 20 viewers cost roughly 500 queries for one match.
*Fix*: collapse into a single `GROUP BY` query.

**M2 · Security · `app.ts`**
No rate limiting anywhere. `/auth/discord` could be hammered to probe codes, and `POST /matches` or
`POST /workspaces` could be spammed to inflate the database.
*Fix*: `@fastify/rate-limit`, with a tighter budget on auth.

**M3 · Security · the SSE route**
No cap on concurrent event streams. One valid account opening a few thousand connections exhausts the
API process's file descriptors and memory.
*Fix*: cap concurrent streams per user.

**M4 · Folder structure · `release/`**
An unpacked build directory sat in the repository. There was also no root `.gitignore`, no `LICENSE`
and no CI.

### Minors

- Any 4xx error without an `AppError` was labelled `VALIDATION`, including 405 and 415.
- Unknown routes returned Fastify's default body instead of the `{error:{code,message}}` envelope.
- Workspace name limits were declared twice and disagreed (1 to 60 in the route, 2 to 40 in the service).
- No logs for owner or admin actions, so removals and deletions left no trail.
- Expired sessions were never cleaned up.
- `app/src/api.ts` called `board()` after `record()` only to fetch `workspace` and `rules`, wasting a round trip.
- `onServerChanged` was a module-level global: not injectable, hard to test.
- No cap on how many workspaces one person could create.
- The UI had no tests at all.
- Comments explained things the code already said, which is what the new convention forbids.

## Second pass, after the fixes

All changes are deployed and the production data came through untouched (8 users, 31 matches).

| # | Dimension | Before | After | What changed |
|---|---|---|---|---|
| 1 | Architecture | 6 | **9** | `app.ts` 356 to 130 lines, split into `http/routes/{auth,workspaces,members,matches,events}`; `workspaces.ts` 330 lines split into `workspaces`, `memberships`, `board`; `RankingApp` 354 to 193 lines with `useSession`, `useWorkspace` and `WorkspaceSwitcher` extracted |
| 2 | Clean Code | 6 | **9** | Removed comments that retold the code (1.5% of lines remain, only tricks and outside constraints); dropped a pointless wrapper; turned on `noUnusedLocals` in all three packages |
| 3 | SOLID | 7 | **8** | `onServerChanged` moved from a global into the `Platform` interface, so it is injectable and testable |
| 4 | Design Patterns | 7 | **8** | A single `RouteContext` is now the only dependency surface routes see |
| 5 | Performance | 4 | **9** | N+1 collapsed into one `GROUP BY`; one round trip dropped from recording a match |
| 6 | Security | 4 | **8** | Rate limits of 300/min global, 10/min auth, 40/min writes; 5 concurrent streams per user; 20 workspaces per owner; `trustProxy` so the limiter sees the real IP behind Caddy |
| 7 | Naming | 8 | **9** | `remainingTodayBetween` became `remainingTodayByOpponent`; `tierDto` became `tierSummary` and moved into the domain |
| 8 | Folder Structure | 5 | **9** | Build directory removed; added `.gitignore`, `LICENSE`, GitHub Actions CI, `CLAUDE.md` |
| 9 | Dependency Injection | 7 | **9** | No globals left; `db`, `now`, `bus`, `limits` and `discord` are all injected, and tests build an app with their own limits |
| 10 | Async/Await | 8 | **8** | Unchanged, it was already correct |
| 11 | Error Handling | 6 | **8** | 404 uses the shared envelope; 429 has its own `RATE_LIMITED` code instead of being mislabelled |
| 12 | Logging | 5 | **8** | Structured logs for every write: `auth.login`, `workspace.created/joined/left/updated`, `member.approved/removed`, `match.recorded/deleted` |
| 13 | Validation | 7 | **9** | Workspace name limits live once in `domain/rules.ts`, shared by the route schema and the service |
| 14 | Testability | 6 | **9** | 16 UI tests added, including one that reproduces the "stuck loading" bug that reached production |
| 15 | Maintainability | 6 | **9** | The largest file is now 367 lines and it is the translation dictionary; `CLAUDE.md` states the conventions |
| 16 | Scalability | 6 | **7** | Expired sessions are cleaned on sign-in; the event bus is still in-process, with the limit and the replacement documented |
| 17 | Database Design | 7 | **8** | Schema unchanged; the N+1 went away by grouping instead of adding an index |
| 18 | API Design | 6 | **8** | One error envelope everywhere; `POST /matches` returns the new board so the client makes no follow-up call |
| 19 | Domain Modeling | 7 | **8** | `tierSummary`, `WORKSPACE_NAME_*` and `MAX_WORKSPACES_PER_OWNER` moved into the domain layer |
| 20 | Overall | 6 | **8** | Median of 19 scored dimensions is 8, with no blockers and no majors left |

**Verdict: READY.**

### Evidence

- **103 tests**: 87 on the server against a real Postgres, covering concurrent writes, the midnight
  boundary, rate limiting and the stream cap; 16 on the UI covering i18n, the record flow and the shell.
- All three packages typecheck with `noUnusedLocals` and `noUnusedParameters`.
- Checked on production after each deploy: `/health`, the 404 envelope, rate-limit headers, data intact.

### Deliberately still open

| Item | Why it waits |
|---|---|
| Event bus across processes | Needs Postgres `LISTEN/NOTIFY` or Redis. One file, `events.ts`. Not needed at the scale of one group |
| Pagination for `/matches` and `/workspaces/search` | Hard limits of 30 and 20 today. No group is near either |
| API versioning (`/v1`) | Two clients, both ours, and `x-app-version` already warns a stale page |
| A dedicated index for the per-pair count | The two existing indexes serve it. Adding an index without measuring is guesswork |
