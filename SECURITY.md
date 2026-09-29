# Security

## Reporting a vulnerability

Open a [private security advisory](../../security/advisories/new) rather than a public issue.
Expect a first reply within a week. There is no bug bounty: this is a hobby project run by one
person, and the honest reward is credit in the advisory if you want it.

If you are running your own instance and believe it is being abused, the fastest lever is
`POST /auth/logout-all`, which revokes every session of the calling account.

## What this project protects

Each instance holds Discord display names, avatar URLs, Discord user IDs, and the match history
of the groups on it. No email addresses, no passwords, no payment data. The most valuable thing
an attacker could take is a session token, which grants that person's access for up to 30 days.

## Design decisions worth knowing

- **Sessions.** A 32-byte token from `randomBytes`, returned once and stored by the client. The
  database keeps only its SHA-256, so a leaked `sessions` table hands over nothing usable.
  Sessions expire after 30 days, expired rows are deleted on startup and on the owner's next
  sign-in, and `POST /auth/logout-all` revokes every session of an account.
- **Authorization is in the service layer, not the route layer.** `recordMatch` re-checks that
  both players are active members *inside* the locked transaction. A new route that forgets its
  middleware still cannot write into a workspace the caller is not in.
- **No CSRF tokens, on purpose.** Authentication is `Authorization: Bearer`, never a cookie, so
  a browser attaches nothing to a cross-site request. This is also why the token lives in
  `localStorage` (see Accepted risks).
- **The daily limit is enforced under a row lock.** Both membership rows are locked in ascending
  id order, then today's matches are counted, then the write happens. Tests fire eight
  simultaneous requests at one pair and assert that exactly three get through.
- **The slash commands carry no token.** `POST /discord/interactions` is authenticated by the Ed25519
  signature Discord puts on every request, checked against the application's public key, and the
  request is refused if its timestamp is more than five minutes old, so a captured request cannot be
  replayed into an extra match. The caller is then resolved from their Discord user ID to an account
  that has already signed in on the website; the endpoint cannot create an account, and it goes through
  the same service layer as the website, so membership and the daily limit are enforced identically.
  Every reply sets `allowed_mentions` to nothing, because a display name is whatever the player
  typed into Discord and `/win` answers in the channel: without it, someone calling themselves
  `@everyone` would ping the room on every match. Leave `DISCORD_PUBLIC_KEY` empty and the route
  is never registered.
- **Discord is the only outbound host.** The URL is a constant, with a 10-second timeout. There
  is no endpoint anywhere that fetches a URL supplied by a user, so there is no SSRF surface.
- **Rate limits** are 300 requests/minute per IP, 10/minute on sign-in, 40/minute on writes, and
  5 concurrent event streams per account.

## Accepted risks

| Risk | Why it is accepted | What would change it |
|---|---|---|
| The session token is in `localStorage`, so any XSS would leak it | The API is Bearer-authenticated, which removes CSRF entirely; moving to an `HttpOnly` cookie trades one class of bug for another. The client has no `innerHTML`, `dangerouslySetInnerHTML` or `eval` anywhere, and the CSP blocks inline and third-party script. | A rich-text feature, or anything that renders user HTML |
| Workspace search returns private workspaces | Private means "you must be approved to join", not "you must not know it exists". Only the name and the member count are visible. | A tenant that must stay hidden from other tenants |
| A moderate advisory in `esbuild`, reachable only through `drizzle-kit` | It is a dev dependency: it never ships in an image, and the advisory concerns esbuild's own dev server, which this project does not run. The latest `drizzle-kit` still depends on it, so there is nothing to upgrade to. | `drizzle-kit` dropping `@esbuild-kit`, or the advisory reaching a shipped path |
| `POST /workspaces/:id/matches` has no idempotency key | A lost response followed by a retry can record the same match twice. The daily limit caps the damage at three, and the client disables the button while a request is open. | Anything where a duplicate write costs money |

## Running your own instance safely

1. **Rotate the Discord client secret** if it was ever pasted anywhere, including a chat with an
   AI assistant. Anything that has left `deploy/.env` should be considered public.
2. Keep `deploy/.env` at mode 600. It is git-ignored, and `.claude/hooks/guard-bash.sh` blocks an
   agent from printing it into a transcript.
3. Leave `TRUST_PROXY=true` only while the API sits behind the bundled Caddy. If you expose the
   API directly, set it to `false`, otherwise anyone can forge the IP the rate limiter keys on.
4. `ADMIN_DISCORD_IDS` grants owner rights in **every** workspace. Leaving it empty is a valid
   choice; each workspace already has an owner.
5. Take the backups seriously. `deploy.sh` dumps the database to `/var/backups/ranking` before
   every deploy and keeps the last ten. That directory sits outside the rsync path on purpose,
   because an earlier `rsync --delete` destroyed a backup that lived inside it.

## Verification

Every claim above is covered by a test or a check in CI:

- 131 server tests against a real Postgres, including cross-workspace isolation, session
  revocation, concurrent writes against the daily limit, season resets, rate limiting, and the
  signature, replay window and authorization of the Discord endpoint, and that a display name
  cannot mention anyone or break out of a reply.
- `npm audit --omit=dev --audit-level=moderate` runs in CI for both packages.
- Dependabot watches npm, GitHub Actions and the base images.
- The committed `packages/server/openapi.json` is regenerated in CI and the build fails if it drifts, so
  the documented surface and the real surface cannot diverge.
