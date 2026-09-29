# Project conventions

## Read this first

**Before writing or changing anything under `packages/app/` or `packages/web/`, read
[`FrontendAgents.md`](FrontendAgents.md).** It carries the front-end conventions:
structure, the `elements/` pattern, imports, the Platform seam, styling, i18n, the
data layer, size limits and the pre-commit checklist. This file governs the server
and everything both sides share.

`.claude/` enforces the parts of both files that must not be skipped: the rules for
an area are injected before you edit it, a handful of destructive commands are
blocked, and a turn cannot end while the typecheck or tests for what you changed are
red. See [`.claude/README.md`](.claude/README.md).

## Comments: none by default

Code should say what it does on its own. Good names, small functions and tight types are the
documentation. A comment that retells the code is noise: it repeats information, and the day the code
changes without it, the comment becomes a lie.

Write a comment only in these four cases:

1. **A trick, or a rule bent on purpose.** A reader would think it is a mistake and "fix" it.
   ```ts
   // Always lock in ascending user id order so two crossing transactions cannot deadlock.
   .orderBy(asc(memberships.userId)).for("update")
   ```
2. **A constraint from outside.** A limit of a library, a browser or a third-party service.
   ```ts
   // EventSource cannot set an Authorization header, so we read the stream with fetch.
   ```
3. **A trade-off.** Why the worse-looking option was chosen over the obvious one.
4. **A business reason that cannot be derived from the code.** A number or a rule someone decided.

Do not write `// get the player list` above `getPlayers()`. Do not write section banners
(`// ---- auth ----`): if a file needs sections, it wants to be two files.

Write JSDoc only for things exported out of a module whose behaviour the signature does not reveal.

## Language

- Identifiers, comments, docs, commit messages and test names: **English**.
- User-facing strings: every string goes through `packages/app/src/i18n.tsx`, which carries both English and
  Vietnamese. Never hardcode a string in a view.
- Server error messages are English. The client translates them by error code, so add a matching
  `err.<CODE>` entry to both dictionaries whenever you add an error code.
- The shell reports sign-in failures as a `LoginErrorCode` from `packages/app/src/platform.ts`, never a
  message string. It renders before `LangProvider` mounts, so it uses the standalone `translate()`
  from `packages/app/src/i18n.tsx`.
- The product name is Vietnamese in both languages. It lives once, in `packages/app/src/constants.ts`; the
  Vite config repeats the literal because a Vite config cannot import from the app.
- Sample data in `packages/app/src/mock.ts` keeps Vietnamese player names on purpose: it feeds the
  screenshots in `docs/screenshots/`.

## Architecture

- `packages/server/src/domain/` is pure: no database, no HTTP. Business rules live here.
- `packages/server/src/services/` takes `db` as an argument, never opens its own connection, knows nothing
  about HTTP.
- `packages/server/src/http/routes/` only does: authenticate, validate input, call a service, emit an event.
- `packages/app/src/` is the UI and knows nothing about the shell around it. Whatever a shell provides goes
  through the `Platform` interface.

## Rules that must hold

- **Nothing leaves this machine without the owner seeing it first.** Do not run `git push`
  and do not run `deploy.sh` until the owner has reviewed the change and said to go. Show
  what changed, wait, then ship. Committing locally is fine; publishing is not.

- Every number in the scoring rules comes from `packages/server/src/domain/rules.ts` and travels to the client
  through the API. Never hardcode it in two places.
- Points are never reset. Leaving a workspace only changes a status, it never deletes the membership row.
- Every write inside a workspace emits an event so other clients update.

## Testing

- New business rules need a test in `packages/server/test/`, running against a real Postgres (`npm run db:test`).
- Fixing a bug means writing the test that reproduces it **first**, then the fix.
- Never hide a red test with `it.skip` or a quieter reporter.

## Before committing

```bash
npm run typecheck && npm test
```

Both run in every workspace from the root. The server suite needs the test database up
(`npm run db:test`).
