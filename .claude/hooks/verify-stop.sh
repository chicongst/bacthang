#!/usr/bin/env bash
# Stop: do not let a turn end with a red typecheck or red tests.
# Only runs the checks for the areas that actually changed, so a docs edit costs nothing.
#
# Escape hatches: touch .claude/verify.off, or export RANKING_SKIP_VERIFY=1.
set -uo pipefail

input=$(cat)

# Claude is already reacting to this hook. Blocking again would loop.
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

root="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
[ -e "$root/.claude/verify.off" ] && exit 0
[ "${RANKING_SKIP_VERIFY:-0}" = "1" ] && exit 0
cd "$root" || exit 0

changed=$(git status --porcelain 2>/dev/null | awk '{print $NF}')
[ -n "$changed" ] || exit 0

touches() { printf '%s\n' "$changed" | grep -qE "$1"; }

failures=""
run() { # run <label> <dir> <script>
  local out
  if ! out=$(cd "$2" && npm run --silent "$3" 2>&1); then
    failures="${failures}
--- $1 failed ---
$(printf '%s' "$out" | tail -25)"
  fi
}

if touches '^packages/(app|web)/'; then
  run "web typecheck" packages/web typecheck
  run "web tests" packages/web test
fi

if touches '^packages/server/'; then
  run "server typecheck" packages/server typecheck
  # The integration tests need the Postgres container; skip rather than fail when it is down.
  if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^bacthang-testdb$'; then
    run "server tests" packages/server test
  else
    failures="${failures}
--- server tests not run ---
The test database is not up. Run 'npm run db:test' at the root and then 'npm test' before calling this done."
  fi
fi

[ -n "$failures" ] || exit 0

cat >&2 <<EOF
The turn cannot end yet: the checks for the code you changed are not green.
$failures

Fix the cause, not the check. Then finish.
EOF
exit 2
