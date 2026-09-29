# Contributing

Patches are welcome. The conventions below are what reviews check, and most of them are
enforced by tooling rather than by argument.

## Before you write code

Read [`CLAUDE.md`](CLAUDE.md) for the repository-wide rules, and
[`FrontendAgents.md`](FrontendAgents.md) as well if you are touching `app/` or `web/`. They are
short. The rule that surprises people most: **do not write comments that retell the code**. A
comment earns its place only for a trick, a constraint from outside, a trade-off, or a business
reason the code cannot show.

If you work with an AI assistant, [`.claude/`](.claude/README.md) already hands it those rules
before it edits, blocks the handful of commands that lose data, and refuses to let it finish
while the checks are red.

## Getting set up

```bash
cd server && npm install && npm run db:test   # Postgres for tests, in Docker, on port 54329
cd ../web && npm install
```

There is no database needed for the UI. `npm run dev` in `web/` plus `?mock` gives you the whole
interface on sample data, with no server and no Discord app.

## The checks

```bash
cd server && npm run typecheck && npm run test:coverage && npm run openapi
cd ../web  && npm run typecheck && npm test && npm run e2e
```

All of it runs in CI, so a pull request that skips it just fails later. Four things fail the
build and are worth knowing in advance:

- **Coverage thresholds** on `server/src`: 90% lines, 88% statements, 85% functions, 78% branches.
- **`openapi.json` drift.** The spec is generated from the route schemas and committed. Change a
  route, run `npm run openapi`, commit the result.
- **`npm audit --omit=dev`** at moderate and above, for both packages.
- **Playwright**, which runs the real UI in Chromium at desktop and phone width.

## What a good change looks like

- **A bug fix starts with the test that reproduces it**, then the fix. The test that catches a
  stale-board race in `web/test/app.test.tsx` exists because that bug reached production.
- **A new business rule lives in `server/src/domain/`** and reaches the client through the API.
  Never hardcode a scoring number in the UI: it arrives in `board.rules`.
- **A new user-facing string** needs a key in **both** `app/src/locales/vi.ts` and `en.ts`. The
  English file is typed `Record<Key, string>`, so a missing key is a type error, not a surprise
  at runtime.
- **A new error code** needs a matching `err.<CODE>` entry in both locale files.
- **Keep the diff about one thing.** No drive-by renames or reformatting alongside a fix.

## Commits

Write commit messages in English, in the imperative, with a body that explains why when the
subject cannot. Branch off `main`. Anything that changes behaviour needs a test; anything that
changes the API needs the regenerated spec.

## Reporting things

- A bug or an idea: open an issue with the template.
- A vulnerability: see [`SECURITY.md`](SECURITY.md) and use a private advisory, not an issue.
