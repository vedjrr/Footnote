# Footnote

Footnote is a browser-based analyst that writes a briefing from a data file and
shows the query behind every number. It is the second version of InsightPilot.
It is a portfolio project owned and authored by Ved (GitHub `vedjrr`). It must
cost nothing to build and run.

You are one of many agent sessions building it. Ved clears context between
tasks, so each session starts with no memory. The files in `docs/` are the
shared memory. Treat keeping them accurate as part of the job.

## Every session does one task

1. **Orient.** Read the current state and the last three log entries in
   `docs/progress.md`. Find your task in `docs/steps.md`: the first unticked
   task whose dependencies are ticked, unless Ved names one. That file is
   long, so read the board at the top and then only your task's section. Read
   what the task lists under "Read first" and nothing more for now.
2. **Check the ground.** Run `git status` and `git pull`. If there are
   uncommitted changes, work out from `progress.md` whether they belong to an
   unfinished task and continue it; if you cannot tell, stop and ask. Run
   `npm run check` (once it exists). If it fails, fixing it comes first, and
   goes in your handoff.
3. **Plan.** Write a plan of three to six lines before changing code. For
   tasks marked high effort, also name the riskiest part and how you will test
   it.
4. **Build in small steps.** After each step that leaves `npm run check`
   green: commit, then push.
5. **Verify.** Run the task's "Verify" commands and confirm each "Done when"
   line by observing it, not by assuming it. UI tasks follow
   `docs/ui-ux-rules.md` §13.
6. **Hand off.** Tick the task in `steps.md`, add your entry to `progress.md`,
   rewrite its current state block, commit as `docs: hand off TNN`, push.
7. **Stop.** Do not start the next task unless Ved asks.

`/next` runs this loop. `/handoff` writes a handoff when stopping early.
`/progress` reports where the project stands. `/audit` reviews finished work
with fresh eyes.

## Honest reporting

The next agent and Ved act on what you write, so it has to be true.

- "Done" means every "Done when" line was observed to be true in this session.
  Otherwise the outcome is "partial" and you say exactly what is left. Partial
  is a normal outcome.
- Report commands you ran with their real results. If you did not run
  something, say so.
- Never mark a stub, a mocked path or a skipped check as done.
- Never change a golden question, a tolerance, a threshold or a test
  expectation to get a pass. If one is wrong, fix it in its own commit and say
  why in `docs/decisions.md`.
- If you find a problem outside your task, do not fix it silently. Small and
  safe: fix it and mention it. Otherwise add it to the fix queue in `steps.md`.

## Rules for the product

The seven invariants in `docs/architecture.md` §2 hold after every task. In
short: it works with no API key; rows of a user's file never leave the
browser; a model never supplies a number; shown SQL is the SQL that ran; one
shared core; accuracy figures come only from eval result files; nothing costs
money.

`docs/requirements.md` §7 lists what is out of scope. Do not build those.

## Git

Ved is the only author of this repository.

- Commit with the git identity already configured. Never change it.
- No `Co-Authored-By`, no "Generated with", no session links, and no mention of
  an AI tool in any commit message, branch name or pull request. A commit hook
  removes such lines; do not rely on it.
- Work on `main`. Commit small: one logical change, usually three to eight
  commits in a task, each passing `npm run check`. Push after every commit.
- Messages follow Conventional Commits, imperative, 72 characters or fewer:
  `feat(query): compile ratio metrics from totals`. Add a body when the reason
  is not obvious.
- Every commit is real work. No empty commits, no splitting a change into
  noise, no reformatting to add to the count.
- Look at `git status` before staging. Stage named paths, not everything.
- Never force-push, amend or rebase pushed commits, or commit `.env` files,
  secrets, or files over 5 MB.

## When to stop and ask Ved

Ask, then wait, when:

- a credential, API key or account action is needed (GitHub, Vercel, Gemini).
  Never ask for a key to be pasted into the chat and never read `.env.local`
- anything would cost money or need a card
- two spec files conflict in a way that changes what gets built
- a task cannot be done without breaking an invariant or going out of scope
- the same verification step has failed three times

Everything else, decide yourself. Record any decision a later agent would
otherwise have to rediscover in `docs/decisions.md` (what, why, what else was
considered), then carry on.

## Use the tools that are installed

`docs/tooling.md` (written in T00) lists the skills and MCP servers available.
Use them. If one named here is not installed, carry on without it.

| Doing this | Use |
|---|---|
| Any interface work | `frontend-design` skill, with `docs/ui-ux-rules.md` taking precedence |
| Any chart | `dataviz` skill and its palette validator |
| SQL, the compiler, golden questions | `data:sql-queries`, `data:write-query` |
| Statistics in findings | `data:statistical-analysis` |
| Checking an analysis or an eval result | `data:validate-data` |
| Writing or refactoring code | `andrej-karpathy-skills:karpathy-guidelines` |
| Interface copy, README, about page, explainers | `humanizer` |
| A hard second opinion on a screen or module | `gauntlet-loop`, or `/audit` |
| Library APIs | a documentation MCP if one is connected, otherwise the official docs. Do not write DuckDB-WASM, Next.js, Tailwind, Zod or Gemini SDK code from memory; all changed recently |
| Looking at the running app | a browser MCP if one is connected, otherwise `npm run shots` and read the images |
| GitHub | the `gh` CLI if installed |

## Explainers

Tasks marked "Explainer: yes" also produce `docs/learn/TNN-short-name.md`, at
most 50 lines, in plain language, so Ved can explain the work in an interview:

1. What this part does, in two sentences.
2. Why it is built this way, and what the simpler alternative gets wrong.
3. One worked example with real numbers from the sample data.
4. Three questions an interviewer might ask, with honest answers.
5. Known limits.

## Where things are

| File | Holds |
|---|---|
| `docs/steps.md` | the tasks and the board of what is done |
| `docs/progress.md` | current state and the handoff log |
| `docs/decisions.md` | decisions made, open questions, ideas for later |
| `docs/requirements.md` | what to build and why; requirement IDs |
| `docs/architecture.md` | structure, invariants, contracts, scripts |
| `docs/analytics-spec.md` | every rule and formula; the sample data |
| `docs/evals.md` | how correctness is measured; integrity rules |
| `docs/ui-ux-rules.md` | the design language and how to check it |
| `docs/tooling.md` | versions, skills and MCP servers on this machine |
| `docs/learn/` | explainers |

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
