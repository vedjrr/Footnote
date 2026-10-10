# Footnote: progress

The shared memory between agent sessions. Every session reads the current
state and the last three log entries before doing anything, and writes one
entry before stopping.

## Current state

Rewrite this block at every handoff. Keep it under 25 lines. It is shown to
each new session automatically, so it must be enough to start from.

<!-- STATE:START -->
- Last finished task: T24 Answers, reference marks and the working paper (done)
- Next task: T30 Golden questions
- In progress: nothing
- Build: Next.js 16.3 app. Shell in `src/app/(app)/`: `/` (retail
  briefing), `/w/<id>/<briefing|ask|metrics|health|report>` for samples
  and files (`file-1`, ...), `/open`, `/accuracy`, `/about`;
  `/styleguide`, `/dev/engine`, `/dev/answer` outside the shell.
  `npm run check` (433 tests) and `npm run test:e2e` (44) pass;
  `npm run build` last run in T10.
- Engine: port `src/core/engine/types.ts`; `createNodeEngine()`,
  `createWasmEngine()`. `features/workspace/workspace-store.ts` holds the
  page's one engine (`workspaceEngine()`), the samples, the user's files
  and each workspace's `time` facts.
- Ingest, profile, dictionary, health: `src/core/{ingest,profile,model,
  health}`; screens in `features/{metrics,health}`.
- Query: `compile`, `checkResult` C1 to C8, `guardSql`/`withTimeout`.
- Answers: `runAnswer` in `core/ask/answer.ts` (compile, run, check,
  chart plan, sentence, interpretation, scope; `rowsBehind`); templates
  in `core/narrative/answer-sentence.ts` (D-039). Ask view in
  `features/ask` runs the dictionary's starters only; no typing yet.
- Narrative: `core/narrative/format.ts` is the one formatter (lint
  enforced); `chooseChart` (D-038); `period-words.ts` for ranges.
- Charts: `src/ui/charts`; UI tokens in `src/ui/tokens.css`.
- Evals: not run
- Blocked on Ved: nothing
- Watch out for: a raw hex outside `tokens.css` fails `npm run check`.
  Next refuses a second `next dev` in the same folder: stop yours before
  `npm run test:e2e`. Engine-backed tests go in `tests/` and need adding
  to `include` in `vitest.config.mts`. Open questions Q-02, Q-05, Q-08
  to Q-10.
- Updated: 2026-10-10, T24
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

### T24 Answers, reference marks and the working paper
- Date: 2026-10-10
- Outcome: done
- What changed: `core/ask/answer.ts` (`runAnswer`, `interpret`,
  `scopeWords`, `rowsBehind`); `core/narrative/answer-sentence.ts`,
  `period-words.ts`; `features/ask` (Ask view, answer, chart from plan,
  working paper with all eight parts but "Add to report"); time facts in
  the workspace store; glance paper names the latest complete period;
  `Disclosure` takes `onOpen`; `/dev/answer` test page;
  `tests/ask/answer.test.ts`, `tests/e2e/answer.spec.ts`.
- Verified: `npm run check`: 433 passed. `npx vitest run tests/ask`: 7
  passed (all 9 starters: no check fails, every fact's text is its cell
  formatted, `displaySql` run alone returns the same rows; Nrth filter
  fails C3; rows behind a cell sum to the cell, both sides).
  `npm run test:e2e -- answer`: 7 passed (every mark of every starter
  highlights one linked cell, and that value is in the result of the
  SQL text copied from the working paper and run on Node DuckDB; Tab
  order and Enter; tablet panel Esc returns focus; phone sheet, no
  sideways scroll; failed check shows the problem). Full e2e: 44 passed in each of the last two runs; earlier runs
  failed (two in the styleguide keyboard test, a hydration race now
  fixed; one run with most tests failing at about 5 s while a
  leftover `next dev` was alive, gone after killing it).
  `npm run shots -- /w/retail/ask`: six images looked at.
- UI check: 390, 834, 1440, light and dark, start, three answers, mark
  selected, paper end, rows behind open; states: loading, running,
  file with no starters, file not open, failed check, no-number answer.
  Fixed: unit repeated in every cell (now in the header), uneven money
  decimals, caution icon on every mark (now first mark plus one line),
  27-row result losing its header (now an 8-row window), a partial week
  read as a fall. Critic pass (fresh agent): fixed the placeholder line
  in the glance paper and an unlabelled peak on the line. Kept: no Ask
  bar (T50); no "Add to report" (T60, no report yet); tags read-only
  without chevrons and nothing marked "assumed" (starters state every
  part; editing is T51/T52); level bars with change labels for a
  comparison (D-038 plan); wide paper tables scroll inside their box.
- Decisions: D-039
- Differs from the spec: "Add to report" and suggested follow-ups are
  not in the answer or the paper yet (T60, T51). Small multiples of
  several metrics share the first metric's format (no starter hits it).
- Not done: nothing
- For the next agent: `runAnswer` takes any spec as `unknown` and
  validates it; T31's answerer can call it. Facts name `{row, column}`
  of `answer.result`. Notes run through the page; an answer with no
  numbers takes one note. Fixed in passing: the styleguide keyboard e2e
  pressed keys before hydration (now waits for network idle).
- Ved should know: a 3-row CSV with a date column shows "Dated by No
  date column" in the glance (inference did not pick the column); not
  looked into.
- Commits: 3fdbaf4..(this handoff)

### T23 Chart choice and number formatting
- Date: 2026-10-10
- Outcome: done
- What changed: `core/narrative/format.ts` grew full, compact and tick
  values, signed changes, percent changes, points, durations, weeks,
  quarters and period labels; `core/narrative/chart.ts` (`chooseChart`,
  `ChartPlan`, `naturalOrder`); `ui/charts/format.ts`, health checks,
  result checks, health view and styleguide swatches now call the one
  formatter; lint rule `oneFormatter` in `eslint.config.mjs`;
  `tests/narrative/chart.test.ts` (retail, real compiled columns).
- Verified: `npm run check`: 417 passed (twice; a third run had the
  profile timing test fail at over 1 s under load, passing alone). Unit
  tests: formatter 25, chart choice 31 (every table row, the 40-mark
  edge at 40 and 41, natural order); retail engine test 8. Lint probe
  file with `toFixed`, `new Intl.NumberFormat`, `toLocaleString`: three
  errors, then deleted. `grep` for those in `src` outside the formatter
  and tests: none. `npx playwright test charts`: 8 passed.
- UI check: not a UI task; chart text unchanged (e2e above).
- Decisions: D-038
- Differs from the spec: more than four series over time are small
  multiples (up to eight) or a table, never "top 3 and Other": Other
  would be a TypeScript sum, not a cell of the SQL that ran (D-038; an
  Other bucket in the compiler is under "Later").
- Not done: nothing
- For the next agent: T24 maps a `ChartPlan` to props. Split values in a
  plan are `cellKey(cell)` (null is ""). `labelChange` means use the
  `__change_pct` column, or `__change` in points (`formatPoints`) for
  percent metrics. Bar `order` is the drawing order; pass `ordered` to
  `RankedBars`. Use `formatCompact` in sentences, `formatValue` in the
  working paper and tables.
- Ved should know: nothing
- Commits: 0349549..(this handoff)

### T22 Chart components
- Date: 2026-10-09
- Outcome: done
- What changed: `src/ui/charts/` (frame with legend, table view, empty
  case and keyboard plot; line, columns, ranked bars, waterfall, small
  multiples, sparkline; `hbars.tsx` shared row layout; pure `layout.ts`,
  `text.ts`, `format.ts`, `palette.ts` with `charts.test.ts`); styleguide
  Charts section with retail fixtures; `tests/e2e/charts.spec.ts`;
  `d3-scale`, `d3-shape`, `d3-array` and types added.
- Verified: `npm run check`: 357 passed. `npx playwright test`: 37
  passed (charts: no text outside its chart or over other text and no
  sideways scroll at 390, 834, 1440; Tab reaches all 17 charts; arrow
  keys, Home, Esc read the points; hover lists every series; 16 charts
  switch to a table; empty sentences). `npm run shots -- /styleguide`:
  six images written and looked at. Palette validator (dataviz skill),
  light on #FFFFFF: lightness, chroma, CVD (worst 9.1 protan), normal
  floor (22.9) PASS; contrast WARN #1baf7a 2.82, #eda100 2.17 (relief:
  direct labels and table view). Dark on #101823: all five PASS (worst
  CVD 8.4). Emphasis pair blue with context grey "fails" the chroma floor
  in both modes by design: grey must read as grey.
- UI check: 390, 834, 1440, light and dark, each chart case shot and read.
  Fixed: "Electronics" broken mid-word under a column (now rows), marked
  point label over the line (now placed clear), unsigned rises, labels on
  every month column, 1 px overflow of the last cap label. Critic pass
  (fresh agent, screenshots and rules only): fixed bare end values
  (names and leaders added), unsigned change labels, unit repeated on
  every bar, dense gridlines, thin total marks. Kept: tooltips may float
  over neighbouring panels (they are overlays, every value is also in the
  table); the cut focus ring and tooltip it saw were the screenshot crop,
  not the page; single-series charts with no named point stay series
  blue per the dataviz skill, emphasis is opt-in. Its point that charts
  do not yet carry the reference mark and yellow highlight is T24's job.
- Decisions: D-037
- Differs from the spec: the sparkline has no "Show as table" switch; it
  sits beside a figure whose working paper holds the values (D-037).
- Not done: nothing
- For the next agent: T23 should replace the body of
  `charts/format.ts` with calls to `core/narrative/format.ts` (it uses
  `Intl.NumberFormat`, which T23's lint rule will flag). Charts take a
  one-sentence `summary` as their accessible name: pass the finding's
  sentence. `emphasis` props take a series or category name.
- Ved should know: nothing
- Commits: 53b9ccc..(this handoff)

### T21 Result checks and the raw SQL guard
- Date: 2026-10-08
- Outcome: done
- What changed: `core/query/checks.ts` (`checkResult`, C1 to C8);
  `core/query/guard.ts` (`guardSql`, `withTimeout`); `Compiled.base` added
  to the compiler's output; `tests/query/checks.test.ts`,
  `tests/query/guard.test.ts`.
- Verified: `npm run check`: 328 tests passed. `npx vitest run
  tests/query`: 93 passed. Guard: 44 hostile statements refused (several
  statements, COPY, ATTACH, INSTALL, LOAD, PRAGMA, SET, file and network
  table functions, catalog tables, comment tricks, writes hidden in CTEs);
  11 legitimate statements pass, are wrapped and run on retail with 1 to
  1,000 rows. Checks: each outcome produced (C1 pass, top-2-of-8 caution,
  fail on a doctored result; C2 caution on one day of Headphones; C3
  "Nrth" fails with "North", "north", "South"; C4 caution on the
  incomplete last week; C5 fail; C6 caution and fail; C7 caution in the
  week of 10 June 2024; C8 note on 2024 MRR). Coverage of
  `src/core/query`: 97.7% statements, 91.8% branches.
- UI check: not a UI task
- Decisions: D-036 (answers Q-04)
- Differs from the spec: C6's under-30 caution only on count
  denominators; C8 has outcome `note` (D-036).
- Not done: nothing
- For the next agent: `withTimeout` stops waiting, but the engine keeps
  running the query; if T24 or T57 needs real cancellation, the WASM
  adapter would need `cancelSent`. Column names that are denied keywords
  (`set`, `load`, `show`) make raw SQL refuse unless quoted.
- Ved should know: nothing
- Commits: 50f0902..(this handoff)

### T20 Query spec, periods and the SQL compiler
- Date: 2026-10-08
- Outcome: done
- What changed: `core/query/spec.ts` (Zod QuerySpec), `core/query/compile.ts`
  (`compile`, `displaySql`, `CompileError`), `core/findings/periods.ts`;
  unit tests beside them; `tests/query/compile.test.ts` on the samples;
  inference now uses the periods module's `defaultGrain`;
  `docs/learn/T20-compiler.md`.
- Verified: `npm run check`: 253 tests passed. `npx vitest run
  tests/query`: 18 passed, including: features against hand-written SQL
  (totals, split/filter/sort/limit, not_in and contains, monthly series of
  27, avg as sum over count, previous month with R1's -6% to -9%, same
  quarter last year, last 3 complete months, share, rank, running total);
  Slotwise 2024 MRR equals December (4,801,625; months summed give
  52,040,250); MRR by quarter is each quarter's last month; return rate by
  category equals returned over rows and the monthly-average shortcut
  differs; S1 Starter churn ratio above 1.7; all nine starters valid and
  non-empty; property test 120 generated specs run with only dictionary
  identifiers; displaySql returns identical rows for every spec run.
  Coverage: `src/core/query` 98.3% statements, 95.2% branches;
  `src/core/findings` 97.4%. Determinism: byte-identical output tested.
- UI check: not a UI task
- Decisions: D-035
- Differs from the spec: `compile` takes a third `context` argument
  (architecture §6.3 updated).
- Not done: nothing
- For the next agent: callers need the time facts: run
  `timeFactsSql(table, model.time.column)` once per workspace and pass
  `readTimeFacts(result)`. H10 in `core/health` still has its own copy of
  the complete-period rule; moving it onto `isComplete` is a small clean-up
  for T21 or later. Result checks (T21) should read `Compiled.columns`
  kinds.
- Ved should know: nothing
- Commits: 0b3589a..(this handoff)

Entries for T10 to T15 are in `docs/progress-archive/phase-1.md`.
Entries for T00 to T06 are in `docs/progress-archive/phase-0.md`.
