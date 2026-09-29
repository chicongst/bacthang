# Agent guardrails

Configuration for [Claude Code](https://code.claude.com/docs) and anything else that reads
`.claude/`. It exists so that an agent working fast still lands inside this repository's
conventions, and so the mistakes that cost us before cannot be repeated silently.

Three layers, weakest to strongest:

| Layer | Where | Can it be ignored? |
|---|---|---|
| Conventions | `CLAUDE.md`, `FrontendAgents.md` | Yes, they are text the model may skim |
| Guardrails | this folder | No, hooks run on every matching call |
| Gate | `.github/workflows/ci.yml` | No, and it survives someone deleting this folder |

Nothing here replaces CI. If a rule matters, it belongs in CI as well.

## What runs

**`hooks/guard-bash.sh`** on every Bash call. Blocks five things, because each one is either
unrecoverable or leaks secrets:

- `docker compose down -v`, which deletes the postgres volume holding live user data
- a recursive delete aimed outside the working tree (`/`, `~`, `/opt/ranking`, `/var`)
- `git push --force`
- printing a `.env` file into the transcript (`.env.example` is fine)
- `DROP`, `TRUNCATE` or `DELETE FROM` against anything that is not `ranking_test`

Everything else proceeds. Deploys, commits and `npm install` only attach a warning, because a
rule that misfires teaches people to work around it.

**`hooks/inject-rules.sh`** before a Write or Edit. Looks at the path and hands back the rules
for that area: `FrontendAgents.md` for `app/` and `web/`, `CLAUDE.md` for `server/`, the
production warnings for `deploy/`. Once per area per session, so repeated edits cost nothing.
`CLAUDE.md` asks the agent to read the conventions; this makes sure it has them.

**`hooks/verify-stop.sh`** when a turn ends. Runs only the checks for the areas that actually
changed: web typecheck and tests if `app/` or `web/` moved, server typecheck and tests if
`server/` did, nothing for a docs-only edit. A red check blocks the turn from ending and the
failure goes back to the agent. A clean tree costs nothing; a full run is about 11 seconds.

**`agents/code-reviewer.md`** is not automatic. Ask for it: *"use the code-reviewer subagent on
this diff"*. It reads the diff in a fresh context, so it is not defending code it just wrote.

## Turning it off

```bash
touch .claude/verify.off      # stop the end-of-turn checks
RANKING_SKIP_VERIFY=1 claude  # same, for one session
```

Personal overrides go in `.claude/settings.local.json`, which git ignores. Run `/hooks` inside
Claude Code to see what is registered, including hooks from your own `~/.claude`.

## Changing a rule

Hooks are shell scripts; test them by piping the JSON they expect:

```bash
export CLAUDE_PROJECT_DIR="$PWD"
jq -nc '{tool_input:{command:"docker compose down -v"}}' | .claude/hooks/guard-bash.sh; echo "exit=$?"
```

Exit 2 blocks and sends stderr back to the agent. Exit 0 with
`{"hookSpecificOutput":{"additionalContext":"..."}}` warns without blocking.

Keep them under a second, and prefer warning until a rule has earned the right to block. The
failure mode to avoid is a hook that matches a substring instead of an intent: one installed
globally on this machine blocks any command containing `npm run dev`, including the tmux form
its own error message recommends, and including a heredoc that merely writes that text into a
file.
