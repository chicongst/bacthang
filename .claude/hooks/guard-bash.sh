#!/usr/bin/env bash
# PreToolUse(Bash): block the few commands that lose data or leak secrets, warn on the rest.
# Exit 2 blocks the call. Exit 0 with additionalContext warns without blocking.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -n "$cmd" ] || exit 0

block() {
  echo "BLOCKED: $1" >&2
  echo "$2" >&2
  exit 2
}

warn() {
  jq -n --arg text "$1" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",additionalContext:$text}}'
  exit 0
}

# Deleting the production volumes destroys the live database.
case "$cmd" in
  *"compose down"*-v*|*"compose down"*--volumes*)
    block "docker compose down -v deletes the postgres volume, which is the live database." \
          "Use 'docker compose restart' or 'up -d'. To reset data on purpose, dump to /var/backups/ranking first and say so." ;;
esac

# Recursive deletes outside the working tree.
if printf '%s' "$cmd" | grep -qE '\brm[[:space:]]+(-[a-zA-Z]*[rR][a-zA-Z]*[[:space:]]+)+(/|~|\$HOME|/opt/ranking|/var)([[:space:]]|/|$)'; then
  block "recursive delete of a path outside the repository." \
        "Name the exact files instead, or ask the user to run it."
fi

# Rewriting published history.
if printf '%s' "$cmd" | grep -qE '\bgit[[:space:]]+push\b.*(--force|[[:space:]]-f\b)'; then
  block "force push rewrites history other people have pulled." \
        "Push normally, or ask the user to force push themselves."
fi

# Secrets into the transcript. .env.example is fine.
if printf '%s' "$cmd" | grep -qE '\b(cat|bat|less|more|head|tail|strings|xxd)\b[^|;&]*\.env\b' \
   && ! printf '%s' "$cmd" | grep -q '\.env\.example'; then
  block "printing a .env file puts live secrets into the transcript." \
        "Read .env.example instead, or check a single key with: grep -c '^KEY=' .env"
fi

# Destructive SQL against a database that holds real user data.
if printf '%s' "$cmd" | grep -qiE '\b(drop[[:space:]]+(database|table|schema)|truncate[[:space:]]+table|delete[[:space:]]+from)\b'; then
  if ! printf '%s' "$cmd" | grep -q 'ranking_test'; then
    block "destructive SQL against a non-test database." \
          "Dump to /var/backups/ranking first, confirm with the user, and say exactly what will be removed."
  fi
fi

# Publishing waits for a human. The owner reviews the change, then says to go, and only
# then does the command carry REVIEWED=1.
if ! printf '%s' "$cmd" | grep -q 'REVIEWED=1'; then
  case "$cmd" in
    *deploy.sh*|*"compose up"*)
      block "deploying before the owner has reviewed the change." \
            "Show them what changed and wait. Once they say go: REVIEWED=1 ./deploy.sh" ;;
  esac
  if printf '%s' "$cmd" | grep -qE '\bgit[[:space:]]+push\b'; then
    block "pushing before the owner has reviewed the change." \
          "Show them what changed and wait. Once they say go: REVIEWED=1 git push"
  fi
fi

# --- warnings below this line: the call proceeds ---

if printf '%s' "$cmd" | grep -qE '\bgit[[:space:]]+commit\b'; then
  warn "Commit only when the user asked. Committing locally is fine; publishing waits for their review."
fi

if printf '%s' "$cmd" | grep -qE '\bnpm[[:space:]]+(i|install|add)[[:space:]]+[^-]'; then
  warn "This repository deliberately has no state library, router, component library, CSS framework or data-fetching library (FrontendAgents.md section 1). Adding a dependency needs a reason the user agreed to."
fi

exit 0
