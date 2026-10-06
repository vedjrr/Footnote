---
name: progress
description: Report where the Footnote build stands without changing anything. Use when Ved asks for status.
disable-model-invocation: true
---

# Where the project stands

Read only. Change no files and run nothing that writes.

Gather:

- from `docs/steps.md`: tasks ticked and total, the current phase, the next
  task, open items in the fix queue
- from `docs/progress.md`: the current state block and the last three entries
- from `eval/results/summary.json` if it exists: the headline figures per mode
- `git log --oneline -8` and `git status -sb`
- from `docs/decisions.md`: open questions that are waiting on Ved

Report to Ved in this order, briefly:

1. One sentence: how far along, and whether anything is blocked.
2. What was finished most recently.
3. What is next, and whether it needs him or a higher effort setting.
4. Latest eval figures, if any.
5. Anything waiting on him.
