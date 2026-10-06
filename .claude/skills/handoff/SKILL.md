---
name: handoff
description: Write the Footnote handoff entry for the current session and push, including when stopping partway through a task.
disable-model-invocation: true
argument-hint: [note for the next agent, optional]
---

# Hand off now

Note from Ved: $ARGUMENTS

Stop building and leave the project in a state the next session can pick up.

1. Run `npm run check`. If it fails and the fix is quick, fix it. If not,
   leave the failing work uncommitted only if committing it would break
   `main`; otherwise commit what is green.
2. Work out the honest outcome for the task you were on: done (every "Done
   when" line observed true), partial, or blocked.
3. Tick the task on the board in `docs/steps.md` only if it is done.
4. Add an entry at the top of the log in `docs/progress.md` using the
   template there. For a partial task, "Not done" must list what remains
   precisely enough that someone with no context can continue, and "For the
   next agent" must say where to start.
5. Rewrite the current state block in `docs/progress.md`, including "In
   progress" if the task is partial.
6. Record any decision made this session in `docs/decisions.md`.
7. Commit as `docs: hand off TNN` and push. Confirm with `git status -sb` that
   nothing is left to push.
8. Tell Ved the outcome in a few lines.
