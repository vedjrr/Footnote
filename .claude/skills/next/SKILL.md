---
name: next
description: Do the next Footnote build task from docs/steps.md, verify it, hand off in docs/progress.md and stop. Use at the start of a fresh session.
disable-model-invocation: true
argument-hint: [task id, optional]
---

# Do one task

Task requested: $ARGUMENTS

If a task id was given above, do that task. Otherwise take the first unticked
task on the board in `docs/steps.md` whose "Depends on" tasks are all ticked.
If the fix queue on the board has open items, do the first of those instead.

Follow the loop in `CLAUDE.md` exactly:

1. Read the current state and the last three log entries in
   `docs/progress.md`. In `docs/steps.md`, read the board at the top and then
   only your task's section (search for its `### TNN` heading). Read what it
   lists under "Read first".
2. Run `git status` and `git pull`. If the tree is dirty, decide from
   `progress.md` whether the changes belong to an unfinished task and continue
   it; if you cannot tell, stop and ask Ved. Run `npm run check` if it exists
   and fix a failure before anything else.
3. If the task says "Needs Ved", do everything that does not need him first,
   then ask your question and wait.
4. State your plan in three to six lines. Then build in small steps. After
   each step that leaves `npm run check` green, commit and push.
5. Run every "Verify" command. Confirm every "Done when" line by observing
   it. For interface tasks, follow `docs/ui-ux-rules.md` §13 and look at the
   screenshots.
6. Write the explainer if the task says "Explainer: yes".
7. Hand off: tick the task on the board only if it is fully done, add your
   entry at the top of the log in `docs/progress.md` using the template,
   rewrite the current state block, commit as `docs: hand off TNN`, push.
8. Tell Ved in a few lines: the outcome, what to look at, anything he must do,
   and which task is next. Then stop. Do not start another task.

If you run short of room before finishing, stop building, hand off as partial
with a precise "Not done" list, and push. A clean partial handoff is better
than a rushed finish.
