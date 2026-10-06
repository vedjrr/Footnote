#!/usr/bin/env bash
# Runs at the start of every session (including after /clear) and prints the
# current project state, so a fresh agent knows where things stand before it
# reads anything. Output goes into the session's context. Must never fail.

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
progress="$root/docs/progress.md"
steps="$root/docs/steps.md"

[ -f "$progress" ] || exit 0

echo "Footnote: project state from docs/progress.md"
echo
awk '/<!-- STATE:START -->/{on=1; next} /<!-- STATE:END -->/{on=0} on' "$progress"

if [ -f "$steps" ]; then
  done_count=$(grep -c '^- \[x\] T[0-9]' "$steps" 2>/dev/null || true)
  todo_count=$(grep -c '^- \[ \] T[0-9]' "$steps" 2>/dev/null || true)
  echo
  echo "Tasks done: ${done_count:-0}. Tasks left: ${todo_count:-0}."
  queue=$(grep -c '^- \[ \] F[0-9]' "$steps" 2>/dev/null || true)
  if [ "${queue:-0}" != "0" ]; then
    echo "Fix queue has ${queue} open item(s). Do those first."
  fi
fi

echo
echo "One task per session. Run /next to start, or follow CLAUDE.md."
exit 0
