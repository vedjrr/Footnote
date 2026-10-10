# Footnote: progress

The shared memory between agent sessions. Every session reads the current
state and the last three log entries before doing anything, and writes one
entry before stopping.

## Current state

Rewrite this block at every handoff. Keep it under 25 lines. It is shown to
each new session automatically, so it must be enough to start from.

<!-- STATE:START -->
- Last finished task: T23 Chart choice and number formatting (done)
- Next task: T24 Answers, reference marks and the working paper
- In progress: nothing
- Build: Next.js 16.3 app. Shell in `src/app/(app)/`: `/` (retail
  briefing), `/w/<id>/<briefing|ask|metrics|health|report>` for samples
  (`retail`, `saas`, `support`) and files (`file-1`, ...), `/open`,
  `/accuracy`, `/about`; `/styleguide`, `/dev/engine` outside the shell.
  `npm run check` (417 tests) and `npm run test:e2e` (37) pass;
  `npm run build` last run in T10.
- Engine: port `src/core/engine/types.ts`; `createNodeEngine()`,
  `createWasmEngine()`. `features/workspace/workspace-store.ts` holds the
  page's one engine, the samples and the user's files.
- Ingest, profile, dictionary, health: `src/core/{ingest,profile,model,
  health}` (D-030 to D-034); screens in `features/{metrics,health}`.
- Query: `querySpecSchema`, `compile(spec, model, { time: facts })`
  (D-035), periods in `core/findings/periods.ts`, `checkResult` C1 to C8,
  `guardSql`/`withTimeout` (D-036). Nothing in the app calls them yet.
- Narrative: `core/narrative/format.ts` is the one formatter (lint refuses
  `toFixed`, `toLocale*`, `Intl` formatters elsewhere in `src`);
  `chooseChart(spec, { columns, rows })` in `core/narrative/chart.ts`
  returns a `ChartPlan` naming result columns and order (D-038).
- Charts: `src/ui/charts` (`index.ts`), on `/styleguide#charts` (D-037);
  `charts/format.ts` maps `ValueFormat` onto the one formatter.
- UI: tokens in `src/ui/tokens.css`; chart colour roles in
  `src/ui/charts/palette.ts`; primitives in `src/ui/`.
- Evals: not run
- Blocked on Ved: nothing
- Watch out for: a raw hex outside `tokens.css` fails `npm run check`.
  A dev server left on port 3000, 3100 or 3200 is reused by shots or e2e.
  Engine-backed tests go in `tests/` and need adding to `include` in
  `vitest.config.mts`. The "profiling retail under a second" test failed
  once in three full runs under load (passes alone). Open questions Q-02,
  Q-05, Q-08 to Q-10.
- Updated: 2026-10-10, T23
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

### T15 Data health screen
- Date: 2026-10-08
- Outcome: done
- What changed: `/w/[workspace]/health` renders
  `features/health/health-view.tsx` (problems by severity with a mark on
  each count, a working paper with rule, result, example rows and SQL,
  then the column profile table with its own paper); the store gains
  `useHealth` (D-034); the glance shows "Data health" with a link and
  reads the time column from the dictionary; `tests/e2e/health.spec.ts`.
- Verified: `npm run check`: 212 tests passed (the T14 entry said 218;
  that was wrong, it was 212 then too). `npx playwright test health`: 6
  passed (retail H1 first with 719 rows (1.2%), H4, H3; mark opens rows
  and SQL; support csat under "Good to know" with the averaged-only
  sentence; saas H12; a clean 91-day CSV shows the nothing-found
  sentence; the glance on the saas briefing reads "1 serious, 1 minor
  problems"). `npx playwright test`: first full run 27 failed in 3.2 min
  on a cold dev server, second run 29 passed in 15 s; each file also
  passes alone.
- UI check: `npm run shots -- /w/retail/health /w/support/health` at 390,
  834, 1440, light and dark. Fixed: the mark landed on "0" in "seats is
  0" (now on the row count), mark description grammar. Phone tables
  scroll inside their container. Loading ("Checking the ...") and error
  states exist; the clean state was triggered in e2e. Critic pass not
  required.
- Decisions: D-034
- Differs from the spec: nothing
- Not done: nothing
- For the next agent: if the full e2e run fails on a cold start, run it
  again before debugging; it may be the dev server compiling routes
  under parallel workers. Statements use column names (lower case at the
  start of a sentence); swapping in labels is a later polish.
- Ved should know: the first full e2e run after this change failed and
  the second passed; I committed before the rerun. Watch for flakiness.
- Commits: 675e168..(this handoff)

### T14 Metrics screen
- Date: 2026-10-08
- Outcome: done
- What changed: `/w/[workspace]/metrics` now renders
  `features/metrics/metrics-view.tsx` (definitions, add a ratio, columns
  to split by, hidden columns, time) and `yaml-actions.tsx` (download,
  load with line errors); `core/model/describe.ts`, `core/model/edit.ts`
  with tests; `ui/select.tsx` added to the styleguide; the store loads
  `dictionary.yaml` for samples and infers one for files;
  `copy-demo.mjs` copies `.yaml`; retail metric renamed "Discount rate".
- Verified: `npm run check`: 218 tests passed. `npx playwright test
  metrics`: 5 passed (definitions listed; "Average discount" added by
  keyboard, still there after Briefing and back; edit by keyboard with
  Escape returning focus; hide and show; broken YAML names line 9 and
  changes nothing, a valid file replaces the dictionary).
  `npx playwright test`: 23 passed.
- UI check: `npm run shots -- /w/retail/metrics` at 390, 834, 1440, light
  and dark, plus scripted edit-with-error and YAML-error states at 390
  dark and 1440 light. Fixed: duplicate "Metrics" heading (section is now
  "Metric definitions"), YAML message repeating the line position, the
  form's Remove button drifting to the far edge. Tab order reaches every
  control (e2e `tabTo`). Loading and error states reuse the briefing's
  pattern; empty states have sentences. Critic pass not required.
  `frontend-design` skill not loaded; ui-ux-rules followed directly.
- Decisions: D-033
- Differs from the spec: "hide a column" applies to columns to split by;
  metrics are removed instead (D-033).
- Not done: nothing
- For the next agent: edits are in memory only. Nothing reads
  `data.model` yet except this screen; T20 onward should take the
  dictionary from the store, never from the YAML file. The working paper
  on this screen is the glance; there are no numbers on the screen
  besides it.
- Ved should know: nothing
- Commits: 68a277d..(this handoff)

### T13 Data health checks
- Date: 2026-10-08
- Outcome: done
- What changed: `src/core/health/` (`health.ts` checks H1 to H12,
  `thresholds.ts`); `core/model/usage.ts` (`metricsUsing`);
  `formatShare`, `formatMonth` in `core/narrative/format.ts`;
  `valueExpr` exported from the profile; `tests/health/health.test.ts`;
  generators write a `health` list into each `truth.json` (Parquet
  unchanged, content hashes identical).
- Verified: `npm run check`: 199 tests passed. `npx vitest run
  tests/health`: 16 passed. Reports per sample equal truth.json exactly:
  retail H1 serious 1.2%, H4 region 0.8%, H3 segment 0.5%, H6 quantity
  12 rows (+ accepted H6 revenue, cost); saas H12 serious 0.6%, H3
  industry 2.4%; support H9 serious 1.5%, H2 0.4%, H3 csat information
  59.4% (+ accepted H3 resolved_at, H3 resolution_hours information, H5
  resolution_hours). Shares match `realised` in truth to 3 decimals.
  Health runs in 28 to 51 ms per sample (Node). `data:generate` re-run:
  same hashes.
- UI check: not a UI task
- Decisions: D-032 (answers Q-06, Q-07, Q-11)
- Differs from the spec: H12 added; H3 floor and information rule; H5
  log scale (analytics-spec §3 updated).
- Not done: nothing
- For the next agent: the extras accepted into truth.json are reviewed,
  not ignored: change a check and the exact-match test will tell you.
  H10 holds a copy of the §4 complete-period rule; T20 should move it to
  `core/findings` and reuse it. Statements use column names, not labels;
  T15 can swap in dimension labels via `problem.dimensions`.
  Callers pass `latestPlausible` (today in the app) or the future-date
  part of H9 is skipped.
- Ved should know: nothing
- Commits: aa465fe..(this handoff)

### T12 Dictionary: types, inference and sample dictionaries
- Date: 2026-10-08
- Outcome: done
- What changed: `src/core/model/` (`types.ts` Zod schemas with reference
  checks, `yaml.ts`, `words.ts`, `infer.ts`, `roles.ts`, unit tests);
  `data/demo/<id>/dictionary.yaml` for retail, saas and support with
  synonyms and three starter specs each; `tests/model/model.test.ts`;
  `zod` 4.6.5 and `yaml` 2.9.1 installed. Profile fixes: inner spaces no
  longer stripped before the number parse; a table with one text column
  no longer fails the top-values statement (DuckDB parser error).
- Verified: `npm run check`: 181 tests passed. `npx vitest run
  tests/model`: 17 passed; role agreement retail 14/14, saas 10/10,
  support 12/12, no disagreements; saas MRR, seats and row count infer
  `overTime: last`; retail and support stay `sum`. Private fixture
  (names, emails, phones, entity, free text) passes.
- UI check: not a UI task
- Decisions: D-031
- Differs from the spec: added the `difference` metric kind and
  `starters` to architecture §6.1; small rule wording changes in
  analytics-spec §2.3 and §2.5 (D-031).
- Not done: nothing
- For the next agent: I wrote the hand-written dictionaries after seeing
  the inferred roles, so 100% agreement is not independent evidence; the
  fixture tests in `src/core/model/infer.test.ts` pin the harder rules.
  Dimension ids in the hand-written files differ from column names for
  entities (`customer`, `order`, `account`). Starter specs are plain data
  until T20 validates them. `copy-demo.mjs` copies only `.parquet`; T14
  needs the YAML in `public/` or imported.
- Ved should know: nothing
- Commits: bfb016d..(this handoff)

### T11 Column profile
- Date: 2026-10-08
- Outcome: done
- What changed: `src/core/profile/profile.ts` (`profileTable`, statement
  builders, type refinement); `profile.test.ts` (quoting, number parse);
  `tests/profile/profile.test.ts` with fixtures built in SQL, snapshots of
  the three samples and a timing test; `tests/profile` added to vitest.
- Verified: `npm run check`: 138 tests passed. `npx vitest run
  tests/profile`: 14 passed, retail profile 112 ms on a fresh Node engine
  (was 1,052 ms before date probes moved behind a shape check). Coverage
  of `src/core/profile`: 98.7% statements, 99.2% lines, 82.9% branches.
- UI check: not a UI task
- Decisions: D-030
- Differs from the spec: §2.1 says one statement per family; the profile
  uses up to five (counts and probes, date formats if any column needs
  them, numbers, dates, text and booleans), fixed whatever the column
  count.
- Not done: nothing
- For the next agent: refined text columns keep `storageType: 'text'`;
  compile SQL on them with `numberFromText` or the date format in
  `refinement.format`. `gapDays` is in days even for monthly data (Slotwise
  `month` shows 677). Samples: no column is refined; retail
  `customer_segment` has 299 empty, Slotwise `industry` 1,331, Kettle
  `csat` 23,769. Snapshot numbers are rounded to 9 significant figures.
- Ved should know: nothing
- Commits: afd8044..(this handoff)

### T10 Use your own file
- Date: 2026-10-08
- Outcome: done
- What changed: `core/ingest/` (`file.ts` checks and messages, `ingest.ts`
  loads through the engine); CSV `delimiter` on `FileSource`, sent with
  `skip = 0`; `glanceSql` takes no time column and quotes any column name;
  `sample-store.ts` renamed `workspace-store.ts` and holds files too;
  `file-id.ts`, `file-not-open.tsx`; `briefing/sample-facts.tsx` renamed
  `data-facts.tsx`; switcher lists "Your files" and "Use your own file";
  `/open` screen (`features/open-file/`); `ui/drop-area.tsx` + styleguide.
- Verified: `npm run check`: 121 tests passed. `npm run test:e2e --
  upload`: 4 passed (CSV 3 rows with zero requests from choosing the file
  to "is open", Parquet 1,234 rows, seven failure messages, not-open
  state). `npm run test:e2e`: 18 passed. Probe: a `fetch` added to
  `openFile` made the no-network test fail (restored). Coverage
  `core/ingest` 98.9% lines. Q-03 measured (D-028): 100 MB CSV opens in
  0.8 s, 294 MB in 1.8 s, +1.0 GB peak.
- UI check: `npm run shots -- /open /w/file-3/briefing` and scripted
  states (failure, loading, opened with caution, file briefing,
  switcher) at 390, 834, 1440, light and dark. Fixed: switcher called a
  missing file "(sample)", empty working paper on the not-open page, the
  size warning showed a row count with no working paper. Tab order on
  `/open`: wordmark, switcher, views, Accuracy, AI assist, theme, Choose
  a file; focus ring visible on the chooser. Critic pass not required.
- Decisions: D-028 (answers Q-03), D-029
- Differs from the spec: after reading, `/open` shows the result and a
  "Read the briefing" link instead of moving on by itself (D-029).
- Not done: nothing
- For the next agent: `useWorkspace(id)` gives `{ workspace, state }` for
  samples and files; `state.status` can be `missing` for a file id the
  page does not hold. Workspace `timeColumn` may be null. Large test
  files were generated in a scratch folder and not committed.
- Ved should know: measured on your M4 only; T72 should repeat on a slower
  machine if one is to hand.
- Commits: 42405d9..(this handoff)

Entries for T00 to T06 are in `docs/progress-archive/phase-0.md`.
