# Footnote: progress

The shared memory between agent sessions. Every session reads the current
state and the last three log entries before doing anything, and writes one
entry before stopping.

## Current state

Rewrite this block at every handoff. Keep it under 25 lines. It is shown to
each new session automatically, so it must be enough to start from.

<!-- STATE:START -->
- Last finished task: T00 Preflight (done)
- Next task: T01 Scaffold and quality gates
- In progress: nothing
- Build: no code yet; repo is the spec pack plus `docs/tooling.md`
- Evals: not run
- Blocked on Ved: nothing
- Watch out for: open questions Q-06 to Q-10 in `decisions.md`, raised in
  T00. `docs/architecture.md` was not skimmed in T00 (Q-09). The
  `frontend-design` skill is missing; `docs/tooling.md` names the substitute.
  `.gitignore` exists with `.DS_Store` and `.env*`; T01 extends it.
- Updated: 2026-10-06, T00
<!-- STATE:END -->

## How to write a log entry

- Newest entry first, directly under the "Log" heading.
- One entry per session. Never edit or delete an older entry; if it was wrong,
  say so in a new one.
- At most 30 lines. Facts, not a story. Someone with no context must be able
  to act on it.
- Outcome is one of: done, partial, blocked.
- Under "Verified", give the commands you ran and what they printed that
  matters (counts, pass or fail). Write "not run" where that is the truth.
- When this file passes 400 lines, move the oldest entries to
  `docs/progress-archive/phase-N.md` in the same commit and leave a one-line
  pointer here.

Template:

```
### TNN Task title
- Date: YYYY-MM-DD
- Outcome: done | partial | blocked
- What changed: the modules, screens or files added or altered, in a few lines
- Verified: command, result; command, result
- UI check: (UI tasks) widths and themes looked at, problems found and fixed,
  critic pass result
- Decisions: D-0NN ..., or none
- Differs from the spec: what and why, or nothing
- Not done: what remains, or nothing
- For the next agent: traps, things that look wrong but are intended, where to
  start
- Ved should know: anything that needs his attention, or nothing
- Commits: first..last short hashes
```

## Log

### T00 Preflight: repository, identity, hooks, tooling
- Date: 2026-10-06
- Outcome: done
- What changed: `git init -b main`, remote `origin` set to
  `https://github.com/vedjrr/Footnote.git`, hooks made executable,
  `core.hooksPath` set to `.githooks`. Added `.gitignore` (`.DS_Store`,
  `.env*`). First commit of the spec pack. Added `docs/tooling.md`. Added
  Q-06 to Q-10 to `decisions.md`.
- Verified: `git config --get user.name` printed `vedjrr`;
  `git config --get user.email` printed `ambreved3@gmail.com`;
  `.claude/settings.json` parses, `attribution` is `commit: false, pr: false`;
  first commit made with a `Co-Authored-By: Test` line, and
  `git log -1 --format=%B` showed it removed; `git log -1 --format='%an <%ae>'`
  printed `vedjrr <ambreved3@gmail.com>`; `gh api .../commits/62bc4e5` shows
  author login `vedjrr`; `git config core.hooksPath` printed `.githooks`.
- Decisions: none. Open questions Q-06 to Q-10 added.
- Differs from the spec: the folder was not a clone, so the repo was
  initialised here and the remote added (Ved approved). The first copy of the
  pack lacked the `.claude` files; Ved supplied the zip, the six files were
  extracted, the rest of the pack was compared and matched, and the zip was
  deleted.
- Not done: the skim of `docs/architecture.md`. The tool permission check
  refused to read it in this session (Q-09). Every other doc was skimmed.
- For the next agent: `npm run check` does not exist yet; T01 creates it.
  Read `architecture.md` in full in T01 and note any conflict.
- Ved should know: `gh` is logged in as `vedjr02`, not `vedjrr` (Q-10).
  Commits still link to `vedjrr` on GitHub.
- Commits: 62bc4e5..(this handoff)
