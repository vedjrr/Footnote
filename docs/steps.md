# Footnote: steps

The build, split into tasks sized for one agent session each. One session does
one task, hands off in `progress.md`, and stops.

## How to use this file

- The board below is the single record of what is done. Tick a task only when
  every "Done when" line is true and the "Verify" commands pass.
- Take the first unticked task whose "Depends on" tasks are all ticked.
- This file is long. Read this section and the board, then jump to your own
  task's heading (`### TNN`) and read only that. Do not read the whole file.
- Read only what the task lists under "Read first", plus `CLAUDE.md` and the
  current state in `progress.md`. The other specs can wait until a task needs
  them.
- "Effort" is the reasoning level Ved should run the session at. Medium is the
  default. High tasks are the ones where a subtle mistake is expensive.
- "Explainer: yes" means the handoff includes a short `docs/learn/` note
  (format in `CLAUDE.md`).
- "Critic pass" means step 5 of `ui-ux-rules.md` §13 is required.
- "Needs Ved" means the task cannot finish without him. Do everything else
  first, then stop and ask.
- If a task turns out too large for one session, finish a coherent part, hand
  off as partial, and say exactly what is left.

## Board

Phase 0, foundations
- [x] T00 Preflight: repository, identity, hooks, tooling
- [x] T01 Scaffold and quality gates
- [x] T02 Design tokens, type and primitives
- [x] T03 Query engine port, adapters and parity
- [x] T04 Sample data: framework and retail
- [x] T05 Sample data: subscriptions and support
- [x] T06 App shell, routes and workspace switching

Phase 1, understand the data
- [x] T10 Use your own file
- [x] T11 Column profile
- [x] T12 Dictionary: types, inference and sample dictionaries
- [ ] T13 Data health checks
- [ ] T14 Metrics screen
- [ ] T15 Data health screen

Phase 2, query core
- [ ] T20 Query spec, periods and the SQL compiler
- [ ] T21 Result checks and the raw SQL guard
- [ ] T22 Chart components
- [ ] T23 Chart choice and number formatting
- [ ] T24 Answers, reference marks and the working paper

Phase 3, evals before AI
- [ ] T30 Golden questions
- [ ] T31 Eval runner and scoring
- [ ] T32 Accuracy page

Phase 4, briefing
- [ ] T40 Key changes
- [ ] T41 Where a change came from: additive metrics
- [ ] T42 Where a change came from: mix and rate
- [ ] T43 Unusual points, runs, concentration and caveats
- [ ] T44 Ranking, sentences, suggested questions and grounding
- [ ] T45 Briefing page
- [ ] T46 Findings eval

Phase 5, ask
- [ ] T50 Composer
- [ ] T51 Reading phrases without a model, and follow-ups
- [ ] T52 Ask view
- [ ] T53 AI assist gateway and consent
- [ ] T54 Planner
- [ ] T55 Baseline and recorded eval runs
- [ ] T56 Clarifications that stick, and prose polish
- [ ] T57 Hardening on dev, then the holdout run

Phase 6, report and persistence
- [ ] T60 Report
- [ ] T61 Export with real footnotes
- [ ] T62 Local workspaces that persist

Phase 7, quality and launch
- [ ] T70 Accessibility pass
- [ ] T71 Small screens and other browsers
- [ ] T72 Performance pass
- [ ] T73 Independent audit
- [ ] T74 About page, README, case study and analyst documents
- [ ] T75 Deploy and release

Fix queue (added by `/audit`; do these before the next phase starts)
- none yet

---

## Phase 0, foundations

### T00 Preflight: repository, identity, hooks, tooling

- Effort: medium
- Depends on: nothing
- Covers: NFR-01
- Read first: `CLAUDE.md`; then skim every file in `docs/` once
- Needs Ved: only if the remote or git identity is missing

Build
- Confirm this folder is a git repository with a GitHub remote
  (`git remote -v`). If not, stop and ask Ved to create the repository and add
  the remote.
- Read the identity with `git config --get user.name` and
  `git config --get user.email`. If either is empty, stop and ask. Do not set
  or guess them (setting them is blocked on purpose). Report both values in
  the handoff so Ved can confirm the email belongs to his GitHub account.
- Make the hooks runnable and active:
  `chmod +x .githooks/commit-msg .claude/hooks/session-context.sh` and
  `git config core.hooksPath .githooks`.
- Check `.claude/settings.json` parses as JSON and has attribution switched
  off.
- Make the first commit of the specification. To test the hook, write the
  commit message with a line `Co-Authored-By: Test <test@example.com>` at the
  end, then confirm with `git log -1 --format=%B` that the line is gone and
  with `git log -1 --format='%an <%ae>'` that the author is Ved.
- Write `docs/tooling.md`: operating system, Node, npm and git versions;
  every skill available in this session; every MCP server connected and what
  it is useful for here; whether `gh` is installed; anything from the table in
  `CLAUDE.md` that is missing.
- While skimming the docs, list anything contradictory or unclear under "Open
  questions" in `decisions.md`. Do not resolve them silently.
- Push.

Done when
- The first commit is on GitHub, authored by Ved alone, with no trailer lines.
- `git config core.hooksPath` prints `.githooks`.
- `docs/tooling.md` exists and is accurate.

Verify
- `git log --format='%an <%ae>%n%B' -3`
- `git status` is clean and `git status -sb` shows nothing to push.

### T01 Scaffold and quality gates

- Effort: medium
- Depends on: T00
- Covers: NFR-10
- Read first: architecture §3, §5, §12

Build
- Create the Next.js app (App Router, TypeScript, Tailwind, ESLint, `src/`
  directory). The folder is not empty, so scaffold into a temporary folder and
  move the result in, keeping `docs/`, `.claude/`, `.githooks/` and
  `CLAUDE.md`.
- TypeScript strict. Path alias `@/` to `src/`.
- ESLint with the import boundaries from architecture §5. Prettier.
- Vitest with coverage, `fast-check`, Playwright with Chromium.
- Scripts from architecture §12 that can exist now: `dev`, `check`,
  `test:e2e`, `build`, and `shots` (a Playwright script that takes routes and
  writes 390, 834 and 1440 px screenshots in light and dark to `.screens/`).
- `.gitignore` covering `node_modules`, `.next`, `.env*` except
  `.env.example`, `.screens`, coverage and Playwright output.
- `.env.example` with `GEMINI_API_KEY=` and `GEMINI_MODEL=` and no values.
- `src/config/product.ts` exporting the product name "Footnote".
- A GitHub Actions workflow that runs `npm ci`, `npm run check` and
  `npm run build` on every push.
- The home page shows only the product name for now.
- Add the installed versions to `docs/tooling.md`.

Done when
- `npm run check` and `npm run build` pass.
- `npm run shots -- /` writes six images.
- A file in `src/core` that imports `react` fails lint (prove it, then remove
  the file).
- The Actions run for the last push is green.

Verify
- `npm run check && npm run build`
- `npm run shots -- /` then `ls .screens`
- `gh run list --limit 1` if `gh` is installed; otherwise ask Ved to look.

### T02 Design tokens, type and primitives

- Effort: high
- Depends on: T01
- Covers: NFR-05
- Read first: all of `ui-ux-rules.md`
- Critic pass: yes

Build
- `src/ui/tokens.css` with every colour, type, spacing, radius and motion
  token, light and dark. Tailwind theme mapped to the tokens.
- IBM Plex Serif, Sans and Mono through `next/font`.
- Primitives in `src/ui`: text styles, Button (primary, secondary, quiet),
  Field, Menu, Tag, Rule, Notice, Icon, Panel and Sheet (accessible, focus
  managed), Tooltip, ThemeToggle, table styles, and the reference Mark with
  its Highlight.
- `/styleguide`: every token and every component in every state, both themes.
  This page is the visual reference for all later tasks.
- A unit test that computes WCAG contrast for the token pairs in
  `ui-ux-rules.md` §2 and fails below 4.5:1 for text.
- A test or lint rule that fails on a raw hex colour outside `tokens.css` and
  the chart palette file.

Done when
- `/styleguide` shows everything, in both themes, at all three widths.
- The mark and highlight interaction works with mouse, keyboard and with
  reduced motion.
- The checks in `ui-ux-rules.md` §13 are done and recorded, including the
  critic pass.

Verify
- `npm run check`
- `npm run shots -- /styleguide` and read all six images.

### T03 Query engine port, adapters and parity

- Effort: high
- Depends on: T01
- Covers: NFR-02, NFR-10
- Read first: architecture §2, §4
- Explainer: yes

Build
- `src/core/engine/types.ts` as specified.
- `adapters/duckdb-node` and `adapters/duckdb-wasm` (in a Web Worker, started
  lazily). Check the current DuckDB-WASM docs for how to bundle the worker and
  WASM files with this Next.js version before writing code.
- Normalisation at the adapter boundary exactly as in architecture §4.
- `tests/parity/`: at least 40 SQL statements over a small generated fixture
  table, covering aggregates, casts, `date_trunc`, `NULLIF` division, window
  functions, filters with parameters, empty results, big integers, decimals,
  dates, timestamps and nulls. A Vitest suite runs them on Node. A Playwright
  test runs them in the browser and compares normalised results.
- Decide open question Q-01 (serve the WASM files from this site or from
  jsDelivr) by trying self-hosting first. Record the decision.
- Check whether reading Parquet and JSON needs an extension download. Prove a
  CSV and a Parquet file load with the network switched off after page load.

Done when
- Parity passes on both adapters.
- Both engine versions are in `docs/tooling.md`.
- Q-01 is answered in `decisions.md`.
- The offline load test passes.

Verify
- `npm run check`
- `npm run test:e2e -- parity offline`

### T04 Sample data: framework and retail

- Effort: medium
- Depends on: T03
- Covers: FR-01
- Read first: analytics-spec §10 intro and §10.1

Build
- A seeded random number generator in `data/generators/` (no `Math.random`).
- The retail generator, writing Parquet through the Node adapter to
  `data/demo/retail/`, with every planted effect R1 to R7.
- `truth.json` for retail: each effect with its parameters, the values
  realised in the generated data (computed by query), and `briefing: true` or
  `false`.
- `npm run data:generate`.
- Tests that each realised effect is inside the range the spec gives (for
  example the Electronics fall in March 2025 is between 25% and 35%).

Done when
- Running the generator twice gives identical row content (compare a hash of
  an ordered export).
- The Parquet file is under 3 MB.
- The truth tests pass.

Verify
- `npm run data:generate && npm run check`

### T05 Sample data: subscriptions and support

- Effort: medium
- Depends on: T04
- Covers: FR-01
- Read first: analytics-spec §10.2, §10.3

Build
- The same for "Slotwise" (S1 to S6) and "Kettle Helpdesk" (T1 to T5), each
  with its `truth.json` and tests.
- The subscriptions table must be a true snapshot: one row per account per
  month while the account is active.

Done when
- Same three conditions as T04, for both datasets.

Verify
- `npm run data:generate && npm run check`

### T06 App shell, routes and workspace switching

- Effort: medium
- Depends on: T02, T03, T05
- Covers: FR-01, FR-03
- Read first: architecture §5, §8; ui-ux-rules §5, §6, §10

Build
- The layout: top bar with wordmark, workspace switcher (three samples),
  navigation, theme toggle; the reading column; the working paper column.
- Routes `/`, `/w/[workspace]/briefing`, `/ask`, `/metrics`, `/health`,
  `/report`, plus `/accuracy` and `/about`.
- An engine provider that loads DuckDB after first paint and registers the
  selected sample.
- Real content for now: each sample's briefing route shows facts read from the
  data by a query (row count, date range, column count), and the working paper
  column shows "data at a glance". No invented content, no lorem ipsum. Views
  that later tasks build say in one sentence what will be there.
- Responsive behaviour for all three width ranges.

Done when
- Switching sample updates the facts.
- An end-to-end test loads `/`, switches sample and reads the new row count.
- `ui-ux-rules.md` §13 checks are done and recorded.

Verify
- `npm run check && npm run test:e2e`
- `npm run shots -- / /w/saas/briefing /w/support/briefing`

---

## Phase 1, understand the data

### T10 Use your own file

- Effort: medium
- Depends on: T06
- Covers: FR-02, NFR-02, NFR-07, NFR-08
- Read first: requirements FR-02; architecture §4, §8; ui-ux-rules §6, §9, §10

Build
- A "Use your own file" entry in the workspace switcher and a screen with a
  drop area and a file chooser. CSV, TSV, Parquet, JSON.
- Read the file with the engine in the browser. Named progress.
- A message for each failure, written to `ui-ux-rules.md` §9: no header row,
  empty file, unsupported type, too large, inconsistent columns, unreadable
  encoding.
- Creates a local workspace, held in memory for now (T62 makes it persist).
- Measure load time and memory with generated 50, 100 and 300 MB CSV files
  (do not commit them). Confirm or change the limits in NFR-07 and record the
  measurements (open question Q-03).
- An end-to-end test that uploads a small CSV while recording every network
  request, and asserts none is made after the page assets have loaded.

Done when
- A CSV and a Parquet file each produce a workspace with the right row count.
- Each failure case shows its message.
- The no-network test passes.
- Q-03 is answered with numbers.

Verify
- `npm run check && npm run test:e2e -- upload`
- `npm run shots --` with the route of the new screen

### T11 Column profile

- Effort: medium
- Depends on: T03, T05
- Covers: FR-10
- Read first: analytics-spec §2.1, §2.2

Build
- `src/core/profile`: `profileTable(engine, table) -> Profile`, using a small
  number of statements regardless of column count.
- Type refinement as specified.
- Unit tests on fixtures and on the three samples (snapshot the profiles).

Done when
- Profiling the retail sample takes under 1 second on the Node adapter.
- Coverage of `src/core/profile` is 85% or more.

Verify
- `npm run check`

### T12 Dictionary: types, inference and sample dictionaries

- Effort: high
- Depends on: T11
- Covers: FR-12
- Read first: architecture §6.1; analytics-spec §2.3 to §2.8
- Explainer: yes

Build
- Zod schemas and types for the dictionary. YAML load and save.
- `inferModel(profile) -> SemanticModel` following the rules in order.
- A hand-written `dictionary.yaml` for each sample in `data/demo/<id>/`,
  including synonyms a business user would use and three starter questions per
  sample as query specs with a plain-language label (the spec type lands in
  T20; store them as data now and validate them there).
- A test comparing inferred with hand-written roles: 90% or more of columns
  agree on each sample. List every disagreement in the test output.
- Snapshot detection: the subscriptions sample gets `overTime: last` for MRR
  and seats.

Done when
- The comparison test passes on all three samples without special-casing any
  column name that only exists in the samples.
- Private-column rules are tested with a fixture containing names and emails.

Verify
- `npm run check`

### T13 Data health checks

- Effort: medium
- Depends on: T12
- Covers: FR-11
- Read first: analytics-spec §3

Build
- `src/core/health`: checks H1 to H11, each returning the statement, count,
  share, example rows and affected metrics.
- Tests that every planted data problem (R7, S6, T5) is found, and that empty
  `csat` in the support sample is reported as information, not as a problem.

Done when
- All planted problems are found; no check reports a false problem on the
  three samples beyond what `truth.json` lists (review each extra report and
  either accept it into the truth file with a reason, or fix the check).

Verify
- `npm run check`

### T14 Metrics screen

- Effort: medium
- Depends on: T12, T06
- Covers: FR-13, FR-14
- Read first: requirements FR-13, FR-14; ui-ux-rules §6, §9, §10

Build
- `/w/[workspace]/metrics`: metrics with name, definition in words, formula,
  format, direction and synonyms; dimensions; the time column.
- Edit in place: rename, change aggregation, set direction, add and remove
  synonyms, hide a column, add a ratio metric from two existing metrics.
- Export and import YAML. Invalid YAML shows which line is wrong.
- Edits are held in the workspace state and validated by the Zod schema.

Done when
- Adding "Average discount" as a ratio metric works and survives navigation
  within the session.
- Keyboard-only editing works.
- `ui-ux-rules.md` §13 checks are done and recorded.

Verify
- `npm run check && npm run test:e2e -- metrics`
- `npm run shots -- /w/retail/metrics`

### T15 Data health screen

- Effort: medium
- Depends on: T13, T06
- Covers: FR-10, FR-11
- Read first: ui-ux-rules §6, §10

Build
- `/w/[workspace]/health`: problems most serious first, each with its
  statement, count, example rows and affected metrics; then the column profile
  as a table.
- The working paper column's "data at a glance" now summarises health.

Done when
- The three samples show their planted problems in plain sentences.
- A clean dataset shows a sentence saying nothing was found, not a blank page.
- `ui-ux-rules.md` §13 checks are done and recorded.

Verify
- `npm run check`
- `npm run shots -- /w/retail/health /w/support/health`

---

## Phase 2, query core

### T20 Query spec, periods and the SQL compiler

- Effort: high
- Depends on: T12
- Covers: FR-30, FR-33, FR-34
- Read first: architecture §6.2, §6.3; analytics-spec §4
- Explainer: yes

Build
- Zod schema for `QuerySpec`. Validate the starter questions from T12.
- `src/core/findings/periods.ts`: data now, default grain, complete periods,
  current and previous period, same period last year, and
  `resolveRange(range, time)`.
- `compile(spec, model)` as specified, including ratio metrics from totals,
  `overTime: last`, `compare`, `calc`, sort and limit.
- `displaySql`.
- Tests:
  - one or more unit tests per feature, run against the samples on Node
  - property test: any generated valid spec compiles and runs without error,
    and the SQL mentions no identifier outside the dictionary
  - `displaySql` returns the same rows as `sql` with `params`
  - Slotwise MRR for 2024 equals December 2024 MRR, not the sum of months
  - return rate by category equals returned rows over rows, not an average of
    row values, in a case where the two differ

Done when
- All tests pass and coverage of `src/core/query` is 90% or more.
- Compiling is deterministic: the same spec gives byte-identical SQL.

Verify
- `npm run check`

### T21 Result checks and the raw SQL guard

- Effort: medium
- Depends on: T20, T13
- Covers: FR-42, NFR-09
- Read first: architecture §6.4, §6.5; analytics-spec §8

Build
- Checks C1 to C8, each returning pass, caution or fail with its sentence.
- The raw SQL guard. Prefer using DuckDB's own parser (for example
  `json_serialize_sql`) if it is available in both adapters; otherwise a
  conservative check. Record which in `decisions.md`.
- A test file of at least 30 hostile statements that the guard must reject:
  several statements, `COPY`, `ATTACH`, `INSTALL`, `PRAGMA`, file and network
  table functions, comment tricks, a write hidden in a CTE.
- Ten legitimate analytic statements it must accept.

Done when
- Every hostile statement is rejected and every legitimate one runs.
- C3 returns the three closest existing values for a misspelt filter value.

Verify
- `npm run check`

### T22 Chart components

- Effort: high
- Depends on: T02
- Covers: NFR-05
- Read first: ui-ux-rules §7, §8, §11; load the `dataviz` skill
- Critic pass: yes

Build
- In `src/ui/charts`, on `d3-scale` and `d3-shape`: Line, Column, RankedBars,
  Waterfall, SmallMultiples, Sparkline, and a table view that every chart can
  switch to.
- Emphasis mode (one series or bar in series blue, the rest in context grey).
- Hover and keyboard focus as specified. Legends. Direct labels that never
  clip. Accessible names.
- Charts must render on the server with no DOM measurement (fixed `viewBox`,
  estimated text widths), because sample briefings are static HTML. Measuring
  in the browser may refine label placement afterwards.
- The chart palette in one file. Run the `dataviz` validator in both modes
  against the surfaces in `ui-ux-rules.md` §7 and paste the output into the
  handoff.
- Every chart on `/styleguide` with realistic fixture data: a normal case, an
  empty case, one series, four series, long labels, negative values.

Done when
- No chart on `/styleguide` clips, overlaps or overflows at 390 px.
- Tab reaches each chart and arrow keys move between points.
- `ui-ux-rules.md` §13 checks are done and recorded, including the critic
  pass.

Verify
- `npm run check`
- `npm run shots -- /styleguide`

### T23 Chart choice and number formatting

- Effort: medium
- Depends on: T20, T22
- Covers: FR-41
- Read first: analytics-spec §9.2; ui-ux-rules §7

Build
- `src/core/narrative/format.ts`: the one formatter for numbers, percents,
  points, durations and dates.
- `chooseChart(spec, result) -> ChartPlan`:

  | Shape of the answer | Form |
  |---|---|
  | one value, or one value with a comparison | figures, no chart |
  | a series over time, up to 4 series | line |
  | a series over time, more than 4 series | top 3 and "Other", or small multiples |
  | one dimension, no time | ranked bars, largest first; keep natural order for ordered categories |
  | one dimension with a comparison | bars with the change labelled |
  | two dimensions, no time | small multiples; a table when either has more than 8 values |
  | a change analysis | waterfall |
  | anything over 40 marks | table |

- Unit tests for each row and for every formatting rule.

Done when
- The formatter is the only place numbers are turned into text (a lint rule or
  test fails on `toFixed` and `toLocaleString` elsewhere).

Verify
- `npm run check`

### T24 Answers, reference marks and the working paper

- Effort: high
- Depends on: T21, T23, T06
- Covers: FR-40, FR-41, FR-42
- Read first: requirements FR-40 to FR-42; ui-ux-rules §1, §5, §6, §8, §11
- Critic pass: yes

Build
- `run(spec) -> Answer`: compile, run, check, choose chart, build the answer
  sentence from a template, with every number linked to its result cell.
- The Answer component: question, interpretation row (read-only for now),
  sentence with marks, chart, table toggle.
- The working paper: all eight parts in order, with the linked highlight
  between the selected number and its cell.
- Desktop column, tablet slide-over and phone sheet, with focus management.
- The Ask view lists each sample's starter questions; selecting one runs it.
  Nothing needs typing yet.

Done when
- Selecting a mark with mouse or keyboard highlights the number and the
  matching cell, and the SQL shown returns the same result when pasted into
  DuckDB (test this for the starter questions).
- A failed check replaces the sentence with the problem.
- `ui-ux-rules.md` §13 checks are done and recorded, including the critic
  pass.

Verify
- `npm run check && npm run test:e2e -- answer`
- `npm run shots -- /w/retail/ask`

---

## Phase 3, evals before AI

### T30 Golden questions

- Effort: high
- Depends on: T20
- Covers: FR-44
- Read first: all of `evals.md`
- Explainer: yes

Build
- 80 goldens in the file format of `evals.md` §3.1, with the category counts
  in §3, the snapshot and ratio quotas, and a 50 and 30 split that keeps every
  category in both.
- Reference SQL written by hand against the raw tables.
- A test that every reference SQL runs, counts per category and split are
  right, and no two questions are near-duplicates.
- An independent review: start a fresh subagent with only the goldens and the
  table schemas. Ask it to check 25 randomly chosen goldens for a mismatch
  between the wording and the SQL. Fix real mismatches; record disagreements.

Done when
- The test passes and the review is recorded in the handoff.

Verify
- `npm run check`

### T31 Eval runner and scoring

- Effort: medium
- Depends on: T30, T21
- Covers: FR-44, NFR-11
- Read first: evals §2, §4, §6, §7, §8

Build
- `eval/runner`: an `Answerer` interface, the scoring rules, outcome labels,
  headline figures, result files and `summary.json`.
- The keyless answerer, which for now can only decline (the resolver arrives
  in T51). The point of this task is a correct, tested scorer.
- Unit tests for scoring: extra columns, row order, tolerance, text
  normalisation, each outcome label.
- `eval/thresholds.json` and the CI job for keyless evals.

Done when
- `npm run eval -- --mode keyless --set dev` writes results with 0 wrong
  answers and coverage 0, and the scorer tests pass.

Verify
- `npm run check && npm run eval -- --mode keyless --set dev`

### T32 Accuracy page

- Effort: medium
- Depends on: T31, T06
- Covers: FR-44, NFR-11
- Read first: evals §9; ui-ux-rules §3, §6, §9

Build
- `/accuracy`, generated at build time from `eval/results/summary.json`.
- A truthful first sentence for whatever the current state is, including
  "AI assist has not been tested yet".
- Tables by category and mode, the list of non-correct questions, the method,
  the limits, the run date and commit.
- A test that fails if the page contains a figure not present in the summary
  file.

Done when
- The page reflects the current results file with no hand-typed numbers.
- `ui-ux-rules.md` §13 checks are done and recorded.

Verify
- `npm run check && npm run build`
- `npm run shots -- /accuracy`

---

## Phase 4, briefing

### T40 Key changes

- Effort: medium
- Depends on: T20
- Covers: FR-20
- Read first: analytics-spec §1, §4, §5.1

Build
- The shared `Finding` type: kind, metric, period, facts (each fact knows the
  query and cell it came from), score, and the spec needed to reproduce it.
- `keyChanges(model, engine)` with the normal-range label.
- Tests: retail March 2025 revenue is flagged as larger than usual or
  unusually large; a normal December is not flagged as unusual; fewer than 8
  periods gives "not assessed".

Done when
- Tests pass on all three samples and the constants live in one file.

Verify
- `npm run check`

### T41 Where a change came from: additive metrics

- Effort: high
- Depends on: T40
- Covers: FR-21, FR-37
- Read first: analytics-spec §6.1
- Explainer: yes

Build
- `explainChange(metric, from, to, filters)` for sum and count metrics, with
  eligibility, scoring, drill-down to three levels, the opposite mover and the
  broad-based case.
- Property test: segment changes sum to the total change for any generated
  table.
- Tests against `truth.json`: R1 returns Electronics, Online, West in any
  dimension order; a period with proportional change returns broad-based.

Done when
- Tests pass, and the explainer shows the R1 arithmetic worked by hand.

Verify
- `npm run check`

### T42 Where a change came from: mix and rate

- Effort: high
- Depends on: T41
- Covers: FR-22
- Read first: analytics-spec §6.2, §6.3
- Explainer: yes

Build
- Mix and rate decomposition for ratio metrics, including averages stored as
  ratios, with the new-segment and vanished-segment rules.
- The fallback for median, min, max and distinct counts.
- Property test: the two sums equal the change in the ratio within 1e-9.
- Tests against `truth.json`: R2 and S1 and T1 read as mostly rate with the
  planted segment; R6 reads as mostly mix towards Electronics.

Done when
- Tests pass, and the explainer has one worked example of each kind.

Verify
- `npm run check`

### T43 Unusual points, runs, concentration and caveats

- Effort: medium
- Depends on: T40, T13
- Covers: FR-23, FR-24
- Read first: analytics-spec §5.2 to §5.4, §7
- Explainer: yes

Build
- The three finders and the caveat selector.
- Tests: T4 (18 July 2024) is flagged; no Monday is flagged (T3); R5 is
  reported with the realised share; R7 duplicates become a caveat.

Done when
- Tests pass on all three samples.

Verify
- `npm run check`

### T44 Ranking, sentences, suggested questions and grounding

- Effort: medium
- Depends on: T41, T42, T43, T23
- Covers: FR-20, FR-25, FR-43
- Read first: analytics-spec §7, §9

Build
- Scoring and composition into a `Briefing` value: headline, others, caveats.
- Sentence templates for every finding type, following the wording rules.
- Up to three suggested questions per finding, each a query spec or change
  plan with a plain-language label built from the dictionary.
- The grounding check, with property tests: a sentence with one altered digit
  is rejected; the template sentence always passes; causal words are rejected.

Done when
- `composeBriefing` returns at most seven findings for each sample and its
  JSON is stable between runs.
- No template contains a causal word (test).

Verify
- `npm run check`

### T45 Briefing page

- Effort: high
- Depends on: T44, T24
- Covers: FR-01, FR-20, FR-21, FR-24, FR-25, NFR-04
- Read first: architecture §9; ui-ux-rules, all sections
- Critic pass: yes

Build
- `scripts/precompute.ts` and `npm run precompute`, wired into `build`.
- Sample briefings rendered statically from the precomputed JSON, so the
  headline, chart and marks are in the first HTML response.
- The engine loads in the background; marks work as soon as their working
  paper data (precomputed) is present, and "Rows behind it" waits for the
  engine with a named progress line.
- For a user's own file the briefing is computed in the browser and appears
  progressively.
- The notice row for first-time visitors.
- All five states from `ui-ux-rules.md` §10.
- An end-to-end test that recomputes the retail briefing in the browser and
  compares it with the precomputed file.

Done when
- With JavaScript disabled, `/` still shows the headline finding and chart.
- The three sample briefings read like something an analyst would send. Read
  each one in full and fix any sentence that is awkward, vague or wrong.
- `ui-ux-rules.md` §13 checks are done and recorded, including the critic
  pass.

Verify
- `npm run check && npm run build && npm run test:e2e -- briefing`
- `npm run shots -- / /w/saas/briefing /w/support/briefing`

### T46 Findings eval

- Effort: medium
- Depends on: T45, T31
- Covers: FR-44
- Read first: evals §5

Build
- The findings eval in the runner: recall, no false alarms, caveats,
  decomposition. Results in `summary.json` and on the accuracy page.
- Thresholds added for it.

Done when
- Results are published. If recall is under 90%, fix the generator
  parameters or the method in general terms (never by special-casing a
  sample) and say what changed.

Verify
- `npm run check && npm run eval -- --mode keyless --set dev`

---

## Phase 5, ask

### T50 Composer

- Effort: high
- Depends on: T24
- Covers: FR-30
- Read first: requirements FR-30; ui-ux-rules §6, §11

Build
- The Ask bar with autocomplete over metrics, dimensions, values of category
  dimensions and periods, producing a query spec.
- Full keyboard operation, correct ARIA combobox behaviour, `/` to focus.
- The same bar at the bottom of the briefing.

Done when
- "Revenue, by region, last 3 months" can be built with the keyboard alone and
  runs.
- A screen reader announces each option with its kind (check the accessible
  names in a test).
- `ui-ux-rules.md` §13 checks are done and recorded.

Verify
- `npm run check && npm run test:e2e -- composer`
- `npm run shots -- /w/retail/ask`

### T51 Reading phrases without a model, and follow-ups

- Effort: medium
- Depends on: T50, T41, T31
- Covers: FR-31, FR-34, FR-36, FR-37
- Read first: analytics-spec §11, §12; evals §4
- Explainer: yes

Build
- `resolve(text, model, values)` with the strict accept rule.
- Follow-up edits.
- Decline with the missing term and the nearest available things.
- Change-question patterns producing change plans.
- Plug the resolver into the keyless answerer and run the dev set.
- Unit tests for every row of both tables, for typos, plurals and synonyms,
  and for phrases that must not be accepted.

Done when
- Keyless dev results are recorded. The wrong-answer rate is the figure to
  watch: fix any wrong answer by tightening the rules in general terms.
- Thresholds raised to the achieved keyless figures.

Verify
- `npm run check && npm run eval -- --mode keyless --set dev`

### T52 Ask view

- Effort: medium
- Depends on: T51
- Covers: FR-25, FR-33, FR-34, FR-36
- Read first: ui-ux-rules §6, §9, §10
- Critic pass: yes

Build
- The thread of questions and answers as a document.
- The interpretation row, now editable: changing a part reruns the answer.
  Assumed parts are marked.
- Follow-ups typed after an answer modify it.
- Suggested follow-ups under each answer.
- A partly understood phrase opens the composer with the understood parts
  filled in and a sentence saying what was not understood.
- Decline and clarify presentations.

Done when
- "revenue by region last quarter", then "only online", then "vs last year"
  works end to end with AI assist off.
- `ui-ux-rules.md` §13 checks are done and recorded, including the critic
  pass.

Verify
- `npm run check && npm run test:e2e -- ask`
- `npm run shots -- /w/retail/ask`

### T53 AI assist gateway and consent

- Effort: high
- Depends on: T52
- Covers: FR-32, FR-45, NFR-08, NFR-09
- Read first: requirements FR-45; architecture §2, §7, §10
- Needs Ved: a decision on the Gemini key

Before starting, ask Ved one question: does he want to add a free Gemini key
now? If yes, he creates it in Google AI Studio on a project with no billing
account and puts it in `.env.local` himself. Never ask him to paste a key into
the chat, and never read `.env.local`. If no, build everything against mocks,
mark live checks as not run, and carry on. The product is complete without a
key.

Build
- `POST /api/plan` and `POST /api/polish` with Zod validation, size caps,
  origin check, the in-memory rate limit and the error mapping.
- The digest builder in core, applying the private-column and value-cap rules.
- `adapters/llm-gemini` (server) and `adapters/llm-http` (browser).
- Choose the model from the current free tier and record it (Q-02).
- The AI assist control, the consent panel with the exact disclosure, the
  default states (on for samples, off for own files), the unavailable state,
  and the user's own key in Settings.
- Tests with the model mocked: valid payloads pass; oversize, wrong origin and
  malformed payloads are rejected; a private column never appears in a digest;
  429 from upstream produces the fallback and one notice.
- If a key is present, one live smoke call, reported in the handoff.

Done when
- With no key, the control reads "Unavailable" and Ask still works.
- No test makes a live call.
- Request bodies are not logged anywhere (search the code and say so).

Verify
- `npm run check && npm run test:e2e -- assist`
- `npm run shots -- /w/retail/ask`

### T54 Planner

- Effort: high
- Depends on: T53
- Covers: FR-32, FR-36, FR-37
- Read first: architecture §7; evals §6, §8
- Explainer: yes

Build
- Prompt builders in `src/core/ask` (pure): instructions, the digest, the
  delimited data block, the previous spec, and generic few-shot examples that
  use none of the sample datasets' names or questions.
- Server-side planning with structured output, validation against the digest,
  one repair call, then decline.
- The browser flow: resolver first, planner second, composer as the fallback.
- Filter values for columns not sent to the model are matched in the browser.
- The raw SQL path through the guard, labelled in the working paper.
- Tests with mocked replies: valid plans of each kind, unknown ids, malformed
  JSON, an instruction hidden in a dimension value, an attempt to return
  write SQL.
- The prompt hygiene test from `evals.md` §6.

Done when
- All mocked cases behave as specified.
- A question the resolver can answer makes no model call (test).

Verify
- `npm run check`

### T55 Baseline and recorded eval runs

- Effort: medium
- Depends on: T54
- Covers: FR-44
- Read first: evals §2, §6, §7
- Needs Ved: a key for live runs

If Ved decided in T53 not to use a key, finish this task without live runs:
build and unit-test everything against mocked replies, commit no recordings,
and make the accuracy page say plainly that AI assist has not been evaluated.
That counts as done.

Build
- The baseline answerer.
- Recording and replay of model calls; pacing; resume; clean stop on quota.
- Live runs of `ai` and `baseline` on the dev set. Commit the recordings.
- Results on the accuracy page with the comparison.
- CI runs both in replay.

Done when
- Dev results for all three modes are published as they came out.
- A replay run reproduces the same figures with no key.

Verify
- `npm run eval -- --mode ai --set dev` and `--mode baseline --set dev`
  (replay)
- `npm run check && npm run build`

### T56 Clarifications that stick, and prose polish

- Effort: medium
- Depends on: T54
- Covers: FR-35, FR-43
- Read first: requirements FR-35, FR-43; analytics-spec §9.3

Build
- The clarify flow: options as buttons; the choice is stored as a synonym for
  the workspace and the question reruns. The same term does not ask again.
- Optional prose polish through `/api/polish`, applied only to sentences that
  pass the grounding check. A setting turns it off.
- The grounding rejection rate recorded in eval results.

Done when
- "How are sales doing?" asks once on the retail sample and never again in
  that workspace.
- A mocked polish reply with a changed number is rejected and the template is
  shown.

Verify
- `npm run check && npm run test:e2e -- clarify`

### T57 Hardening on dev, then the holdout run

- Effort: high
- Depends on: T55, T56
- Covers: FR-44, NFR-11
- Read first: evals §3.2, §7, §8
- Explainer: yes
- Needs Ved: a key for live runs

If there is no key, do the same work for keyless mode only: harden the
resolver on dev, then run the keyless holdout once and publish it.

Build
- Go through every non-correct dev question in `ai` mode. Group the failures
  by cause. Fix causes in general terms: dictionary inference, resolver rules,
  prompt wording, plan validation, compiler gaps. Never special-case a
  question.
- Rerun dev after each group of fixes and note the figures.
- When dev has stopped improving, run holdout once for all modes and publish.
- Raise thresholds to the achieved figures.
- The explainer covers: the failure groups, what fixed each, what is still
  wrong, and the final figures against the targets in requirements §8.

Done when
- Holdout results are on the accuracy page with the date and commit.
- If a target was missed, the page and the case study notes say so plainly.

Verify
- `npm run eval -- --mode ai --set holdout` (replay) reproduces the published
  figures
- `npm run check && npm run build`

---

## Phase 6, report and persistence

### T60 Report

- Effort: medium
- Depends on: T45, T52
- Covers: FR-50
- Read first: requirements FR-50; ui-ux-rules §6, §10

Build
- "Add to report" on findings and answers. The report view with title, author
  and date fields, reorder by buttons, remove.
- An empty report says how to add something.

Done when
- Items keep their marks and working papers inside the report.
- Reordering works by keyboard.
- `ui-ux-rules.md` §13 checks are done and recorded.

Verify
- `npm run check && npm run test:e2e -- report`
- `npm run shots -- /w/retail/report`

### T61 Export with real footnotes

- Effort: medium
- Depends on: T60
- Covers: FR-51
- Read first: requirements FR-51; ui-ux-rules §3, §7

Build
- `src/core/report`: one self-contained HTML file (inline styles, charts as
  inline SVG, no external requests) and Markdown.
- Reference marks become numbered endnotes with the definition, scope and SQL.
- Print styles: page margins, no navigation, charts not split across pages.
- Tests: the HTML makes no network request when opened; mark numbers match
  endnote numbers; the Markdown renders the same content.

Done when
- The exported HTML opened from disk looks like the report and prints to a
  clean PDF (render it with Playwright and look at the pages).

Verify
- `npm run check && npm run test:e2e -- export`

### T62 Local workspaces that persist

- Effort: medium
- Depends on: T10, T60
- Covers: FR-03, FR-04
- Read first: architecture §8

Build
- `adapters/storage` over IndexedDB: file bytes, dictionary edits, learned
  synonyms, thread, report.
- Recent workspaces in the switcher. Delete a workspace, with a confirmation
  that says the data will be removed from this device.
- Storage-full and private-browsing cases handled with a clear message.

Done when
- Reloading the page restores a local workspace and its report.
- Deleting removes every key for that workspace (test).

Verify
- `npm run check && npm run test:e2e -- persist`

---

## Phase 7, quality and launch

### T70 Accessibility pass

- Effort: medium
- Depends on: T62
- Covers: NFR-05
- Read first: ui-ux-rules §11

Build
- Automated checks with axe through Playwright on every route, both themes.
- A scripted keyboard walk through the main journey: open, select a mark,
  read the working paper, ask a question, edit a part, add to report, export.
- Check accessible names of marks, charts and controls, forced colours and
  reduced motion. Fix what is found.

Done when
- No axe violations at serious or critical level.
- The keyboard journey passes as a test.
- Lighthouse accessibility is 95 or more on `/` and `/w/retail/ask`.

Verify
- `npm run test:e2e -- a11y`

### T71 Small screens and other browsers

- Effort: medium
- Depends on: T70
- Covers: NFR-06
- Read first: ui-ux-rules §5, §13

Build
- Go through every screen at 390 and 834 px in both themes and fix what is
  cramped, clipped or awkward to touch.
- Run the end-to-end smoke tests on WebKit and Firefox and fix differences.

Done when
- Screenshots of every route at every width have been read and recorded.
- Smoke tests pass on all three browser engines.

Verify
- `npm run shots -- / /w/retail/ask /w/retail/metrics /w/retail/health /w/retail/report /accuracy /about`
- `npm run test:e2e -- smoke --project=webkit --project=firefox`

### T72 Performance pass

- Effort: medium
- Depends on: T71
- Covers: NFR-04
- Read first: requirements NFR-04; architecture §9

Build
- Measure with Lighthouse and a bundle report. Record the starting figures.
- Fix the largest costs first: engine loading, font loading, chart code on
  first paint, unused code.
- Record the final figures in the handoff and in `docs/tooling.md`.

Done when
- The targets in NFR-04 are met, or the handoff says which was missed and why.

Verify
- `npm run build` and the Lighthouse command recorded in `docs/tooling.md`

### T73 Independent audit

- Effort: high
- Depends on: T72
- Covers: NFR-02, NFR-03, NFR-09, NFR-11
- Read first: architecture §2; evals §8; requirements §6

Approach this as a reviewer who did not build the product and wants to find
what is wrong with it.

Build
- For each invariant in architecture §2, gather evidence that it holds:
  - AI assist off: capture all network traffic during upload, briefing and
    ask; nothing derived from the file leaves.
  - AI assist on: capture the request bodies; confirm they match the contract
    and contain no private column and no rows.
  - No number on screen without a working paper: crawl the sample pages.
  - Shown SQL equals run SQL: test on 20 answers.
  - No secrets in the client bundle or the repository history.
  - Every figure on the site, README and case study traces to a file.
  - Eval integrity rules: read the git history of `eval/goldens` and
    `eval/thresholds.json` for unexplained edits.
- Write `docs/audit.md`: each check, the evidence, pass or fail.
- Add failures to the fix queue. Fix small ones now.

Done when
- `docs/audit.md` is complete and every failure is either fixed or queued.

Verify
- `npm run check && npm run test:e2e`

### T74 About page, README, case study and analyst documents

- Effort: medium
- Depends on: T73
- Covers: NFR-11
- Read first: requirements §2, §8; evals §9; ui-ux-rules §9

Build
- `/about`: how Footnote works in six short paragraphs, what leaves the
  device and when, the limits, a link to the accuracy page and the code.
- `README.md`: what it is, a screenshot, the live link (added in T75), how to
  run it, how to run the evals, the measured results, the limits.
- `docs/case-study.md`: the problem with v1, the approach, the figures before
  and after, the three decisions that mattered most, what did not work, what
  would come next. Figures from the results files only.
- `docs/ba/`:
  - `traceability.md`: each requirement, the tasks that cover it, and the
    tests or evals that prove it
  - `process-flow.md`: a Mermaid diagram of question to answer, and one of
    file to briefing
  - `kpi-dictionary.md`: the three sample dictionaries as a business glossary
  - `personas-and-stories.md`: from requirements §3 and §5
- Run the `humanizer` skill over all prose.

Done when
- Every requirement appears in the traceability table with one or more tests.
- Nothing in these documents claims something the product does not do.

Verify
- `npm run check && npm run build`
- `npm run shots -- /about`

### T75 Deploy and release

- Effort: medium
- Depends on: T74
- Covers: NFR-01
- Needs Ved: importing the repository into Vercel and setting variables

Build
- Give Ved the exact steps: import the GitHub repository in Vercel on the
  Hobby plan, framework preset Next.js, optional `GEMINI_API_KEY` and
  `GEMINI_MODEL` environment variables. Wait for him to confirm the URL.
- Run the smoke tests against the live URL.
- Run all evals in replay one last time and confirm the published figures.
- Put the live link in the README. Tag `v1.0.0`.
- Set the current state in `progress.md` to shipped, with what is in "Later".

Done when
- The live site passes the smoke tests with and without AI assist.
- The tag is pushed.

Verify
- `npm run test:e2e -- smoke` with the base URL set to production
