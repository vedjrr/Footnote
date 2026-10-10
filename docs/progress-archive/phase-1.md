# Footnote: progress archive, phase 1

Log entries for T10 to T15, moved from `docs/progress.md` when it passed
400 lines. Newest first, unchanged.

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
