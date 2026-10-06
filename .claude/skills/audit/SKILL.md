---
name: audit
description: Review a finished Footnote task or phase with fresh eyes, re-run its checks, and queue fixes. Use in a new session, never in the session that did the work.
disable-model-invocation: true
argument-hint: [task id or phase number, default is the last finished task]
---

# Audit finished work

Target: $ARGUMENTS

You did not build this and you are looking for what is wrong with it. Do not
trust the handoff entry; check it.

1. Identify the target: the task id or phase given above, or the last finished
   task in `docs/progress.md`. Read its section in `docs/steps.md`, its
   handoff entry, and the commits it lists (`git show --stat`, then the diffs
   that matter).
2. Re-run every "Verify" command yourself. Check every "Done when" line by
   observing it.
3. Check the work against the rules it falls under:
   - any task: the invariants in `docs/architecture.md` §2, the scope limits in
     `docs/requirements.md` §7, the import boundaries, test quality (do the
     tests assert real behaviour or just that code runs?)
   - analysis code: `docs/analytics-spec.md`, formula by formula
   - eval work: the integrity rules in `docs/evals.md` §8, and the git history
     of goldens and thresholds
   - interface work: run `npm run shots` for the affected routes, read every
     image, and go through `docs/ui-ux-rules.md` §12 and §13
4. Look for the usual shortcuts: stubs marked done, hard-coded sample values,
   special cases for sample data or golden questions, numbers typed into pages,
   skipped tests, swallowed errors.
5. Write findings, most serious first. For each: what is wrong, where, how you
   know, and how serious (blocks release, should fix, minor).
6. Fix anything under about ten lines now, in its own commit. Add everything
   else to the fix queue on the board in `docs/steps.md` as
   `- [ ] F01 short description (from audit of TNN)`.
7. If the task was ticked but is not actually done, untick it and say so.
8. Add an entry to the log in `docs/progress.md` titled `Audit of TNN`, update
   the current state block, commit as `docs: audit TNN`, push.
9. Tell Ved the three most important findings.
