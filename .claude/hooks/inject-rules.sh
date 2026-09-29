#!/usr/bin/env bash
# PreToolUse(Write|Edit): hand the agent the rules for the file it is about to touch.
# CLAUDE.md asks it to read them; this makes sure it actually has them. Injected once
# per area per session, so repeated edits cost nothing.
set -uo pipefail

input=$(cat)
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
[ -n "$path" ] || exit 0

scratch=$(printf '%s' "$input" | jq -r '.scratchpad_dir // empty')
[ -n "$scratch" ] || scratch="${TMPDIR:-/tmp}"
marks="$scratch/ranking-rules"
mkdir -p "$marks" 2>/dev/null || exit 0

rel=${path#"${CLAUDE_PROJECT_DIR:-}"/}

case "$rel" in
  packages/app/*|packages/web/src/*|packages/web/test/*)
    area=frontend
    text='FrontendAgents.md governs this file. The rules that get broken most: no import climbs with ../ (same folder uses ./x.js, everything else @app/); every relative specifier ends in .js; no file over 300 lines and no render return over 80, past that extract into elements/; no nested ternary in JSX; every user-facing string goes through t() with a key in BOTH packages/app/src/locales/vi.ts and en.ts; no scoring number, tier threshold or limit hardcoded in the UI, they come from board.rules. Read FrontendAgents.md if you have not this session.' ;;
  packages/server/*)
    area=server
    text='CLAUDE.md governs this file. domain/ is pure (no db, no HTTP); services/ take db as an argument; routes/ only authenticate, validate, call a service, emit an event. Every scoring number lives in packages/server/src/domain/rules.ts and reaches the client through the API, never hardcoded twice. Server error messages are English and every new error code needs an err.<CODE> entry in both locale files. A new business rule needs a test in packages/server/test/ against a real Postgres.' ;;
  deploy/*|deploy.sh|packages/web/Dockerfile|packages/web/nginx.conf|packages/server/Dockerfile)
    area=deploy
    text='This file affects the live deployment, which holds real user data. The postgres volume is the production database: never remove it, and dump to /var/backups/ranking before anything destructive. Keep backups outside the rsync path, which is how a backup was lost before.' ;;
  *) exit 0 ;;
esac

[ -e "$marks/$area" ] && exit 0
touch "$marks/$area"

# The comment policy applies everywhere, so it rides along with the first injection.
jq -n --arg text "$text Comments: none by default, only for a trick, an outside constraint, a trade-off, or a business reason the code cannot show." \
  '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$text}}'
