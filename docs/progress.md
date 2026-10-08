# Footnote: progress

The shared memory between agent sessions. Every session reads the current
state and the last three log entries before doing anything, and writes one
entry before stopping.

## Current state

Rewrite this block at every handoff. Keep it under 25 lines. It is shown to
each new session automatically, so it must be enough to start from.

<!-- STATE:START -->
- Last finished task: T12 Dictionary (done)
- Next task: T13 Data health checks
- In progress: nothing
- Build: Next.js 16.3 app. Shell in `src/app/(app)/`: `/` (retail
  briefing), `/w/<id>/<briefing|ask|metrics|health|report>` for samples
  (`retail`, `saas`, `support`) and files (`file-1`, ...), `/open`,
  `/accuracy`, `/about`; `/styleguide`, `/dev/engine` outside the shell.
  `npm run check` (181 tests), `npm run build` and `npm run test:e2e`
  (18) pass (build and e2e last run in T10).
- Engine: port `src/core/engine/types.ts`; `createNodeEngine()`,
  `createWasmEngine()`. `features/workspace/workspace-store.ts` holds the
  page's one engine, the samples and the user's files.
- Ingest: `src/core/ingest/`. Profile: `profileTable(engine, table)` in
  `core/profile/profile.ts` (D-030, amended in D-031).
- Dictionary: `core/model/` has Zod schemas (`types.ts`, incl. the
  `difference` kind and `starters`), YAML (`parseModelYaml` with line
  numbers, `modelToYaml`), inference (`inferModel(profile, facts)`,
  `inferDictionary(engine, profile)` runs the snapshot probe) and
  `compareRoles`. Hand-written `data/demo/<id>/dictionary.yaml` for each
  sample. Not yet loaded by the app or copied to `public/`.
- UI: tokens in `src/ui/tokens.css`; primitives in `src/ui/`.
- Evals: not run
- Blocked on Ved: nothing
- Watch out for: a raw hex outside `tokens.css` fails `npm run check`.
  A dev server left on port 3100 or 3200 is reused by shots or e2e.
  Engine-backed tests of core go in `tests/` and need adding to `include`
  in `vitest.config.mts`. Open questions Q-06 to Q-11 (Q-06, Q-07, Q-11
  are for T13).
- Updated: 2026-10-08, T12
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

### T06 App shell, routes and workspace switching
- Date: 2026-10-06
- Outcome: done
- What changed: `scripts/copy-demo.mjs` and `public/demo/` (ignored);
  `core/profile/glance.ts` (rows, first and last day), `core/narrative/
  format.ts` (integers, days; T23 extends it); `features/workspace/`
  (samples, sample store, `WorkspacePage`, glance paper, planned views);
  `features/shell/` (routes, top bar with switcher, nav, AI assist Off,
  theme, phone and tablet menu); `features/briefing/sample-facts.tsx`
  (facts with four marks, working paper with table and SQL);
  `ui/copy-button.tsx`; routes under `src/app/(app)/`.
- Verified: `npm run check`: 99 tests passed. `npm run test:e2e`: 14
  passed, including loads `/`, reads 59,881, switches to Slotwise, reads
  56,352. `npm run build`: all workspace routes static. `npm run shots --
  / /w/saas/briefing /w/support/briefing`: 18 images, all opened.
- UI check: 390, 834, 1440, light and dark. Fixed: long date-range mark
  would not wrap on phones (now one mark per day), column count in a
  caption was indented, menu items misaligned. States seen in scripted
  shots: loading (download held), error (404 on the file, Reload), empty
  (code path, no sample has 0 rows), ideal, selected mark on desktop, panel
  on tablet, sheet on phone, menu sheet, switcher, AI assist. Tab order:
  wordmark, switcher, five views, Accuracy, AI assist, theme, marks 1-4.
  Critic pass not required for T06; not run. Not a generic template: the
  ledger working paper and linked highlight carry it already.
- Decisions: D-026, D-027
- Differs from the spec: tablet (768-1023 px) shows the view links behind
  "Menu" (D-027). Facts are queried in the browser, not in the initial
  HTML; FR-01's static briefing is T45's job.
- Not done: nothing
- For the next agent: T10 adds "Use your own file" to `WorkspaceSwitcher`
  in `features/shell/top-bar.tsx`; local workspaces will need an id the
  `w/[workspace]/layout.tsx` 404 check accepts. On phones the switcher
  truncates "Harbour & Pine"; the full name is in its accessible name.
  Dev logs a React warning about the theme `<script>` in `layout.tsx`
  (from T02, harmless).
- Ved should know: nothing
- Commits: f7859cb..(this handoff)

### T05 Sample data: subscriptions and support
- Date: 2026-10-06
- Outcome: done
- What changed: `data/generators/saas/` (Slotwise: params, month-by-month
  account simulation, S1-S6 truth, snapshot test) and `support/` (Kettle
  Helpdesk: params, generator, T1-T5 truth, consistency test).
  `demo.ts` (`DemoSpec`, `generateDemo`, `demoTruth`) and `demo-suite.ts`
  (shared tests); retail moved onto them, data unchanged. Summary helpers
  moved to `truth.ts`. Retail R5 and R7 now `briefing: true` (D-024).
- Verified: `npm run data:generate && npm run check`: no line out of
  range, 83 tests passed. Generated twice: all three Parquet files and
  truth files byte-identical (sha1 saas 4e4c78fd..., support e8138962...).
  Sizes 0.75, 0.16, 0.62 MB. Probes: dropping one account-month made the
  snapshot test fail; Technical rate 0.12 printed T1 out of range. Both
  restored. CI success on the first four commits; fifth in progress at
  handoff.
- Realised: S1 Starter 3.36% to 6.71% (1.997x), other plans within 0.003
  pts; S2 MRR +23.9%, Enterprise expansion 0.96 of it; S3 Paid search
  38.6% of new, churn 1.88x; S4 APAC -0.46%, EMEA +28.5%, Americas +37.0%;
  S5 unique 100%, sum/Dec 10.88; S6 seats 0 0.60%, industry empty 2.36%.
  T1 8.01% to 21.99%, others within 0.15 pts; T2 -0.60; T3 1.40; T4
  3.59x; T5 1.5% early, 0.4% repeated ids, csat empty 59.4%.
- Decisions: D-024 (retail briefing flags), D-025
- Differs from the spec: nothing
- Not done: nothing
- For the next agent: ids are `retail`, `saas`, `support`; table names
  `orders`, `subscriptions`, `tickets`. `month` is a DATE (first of
  month). Ticket timestamps are UTC without a zone. Q-06 (S6 cannot reach
  the briefing) and Q-07 (empty csat) are still open for T13.
- Ved should know: T04 had marked only R1 for the retail briefing; the spec
  lists R1, R5 and R7. Fixed in its own commit (ea84219), see D-024.
- Commits: ea84219..(this handoff)

### T04 Sample data: framework and retail
- Date: 2026-10-06
- Outcome: done
- What changed: `data/generators/rng.ts` (sfc32, allocate, weighted
  picker, tests); `write.ts` (rows to Parquet via the Node adapter, content
  hash); `truth.ts` (truth shape, range failures, §6.2 mix and rate);
  `retail/` (params, generator, R1-R7 measures and ranges, tests);
  `scripts/generate-data.mts`; `npm run data:generate`; `tsx` dev
  dependency; `data/demo/retail/orders.parquet` and `truth.json`.
- Verified: `npm run data:generate && npm run check`: 59,881 rows,
  0.75 MB, no effect out of range, 69 tests passed. Ran the generator
  twice: same Parquet sha1 (388e2cfc...) and same content hash
  (2dbf7644...). Probes: changing R1 `keep` without regenerating failed 2
  tests (hash, truth); regenerating with it failed the range test and the
  script printed 4 out-of-range lines. Both restored. CI green on the
  three code commits.
- Realised: R1 Electronics -29.2%, Online West -76.3%, share of fall 1.06,
  total -7.95%; R2 margin -4.23 pts, mostly rate; R3 3.08x; R4 peaks 34.6%
  and 33.7%, growth 7.7%; R5 58.7%; R6 +0.685 pts, rate/mix 0.32; R7 dups
  1.20% (68% in the week), lower case 0.79%, empty 0.50%, 12 negative.
- Decisions: D-023; Q-11 added (0.5% empty segment is under the H3 floor)
- Differs from the spec: nothing. Growth and customer parameters differ
  from the realised values; D-023 explains why.
- Not done: nothing
- For the next agent: T05 reuses `rng.ts`, `write.ts`, `truth.ts`; add a
  folder like `retail/` and call it from `scripts/generate-data.mts`.
  Allocate counts per slot rather than sampling, or effects drown in noise.
  Set ranges in truth before tuning. `truth.json` has no drill path for R1
  yet (Q-08, for T30).
- Ved should know: nothing
- Commits: debdacf..(this handoff)

### T03 Query engine port, adapters and parity
- Date: 2026-10-06
- Outcome: done
- What changed: `src/core/engine/types.ts` (port as in architecture §4, plus
  `FileSource` and `FileFormat`), `normalise.ts` with tests. Node adapter on
  `@duckdb/node-api` 1.5.6-r.1 (dev dependency). WASM adapter on
  `@duckdb/duckdb-wasm` 1.33.1-dev57.0 in a worker, Arrow decoded to
  `Cell`. `scripts/copy-duckdb.mjs` (postinstall, predev, prebuild).
  `tests/parity/` (fixture + 55 statements, Vitest suite),
  `tests/e2e/parity.spec.ts`, `tests/e2e/offline.spec.ts`, `/dev/engine`.
- Verified: `npm run check` passed (55 tests); `npm run test:e2e -- parity
  offline` 4 passed; `npm run test:e2e` 12 passed; parity repeated 5 times,
  5 passed; a changed value in `expected.json` made browser parity fail
  (restored); `npm run build` passed and `next start` gave 404 on
  `/dev/engine` and 200 `application/wasm` for `/duckdb/duckdb-eh.wasm`;
  `gh run list` CI success on the docs commit.
- Decisions: D-020 (answers Q-01: serve from this site, host the
  extensions), D-021 normalisation details, D-022 harness, one engine per
  page, ES2020 target, core tests may import vitest
- Differs from the spec: `FileSource` was not defined in the spec; it is a
  union of bytes (both adapters) and path (Node only). The browser build
  needs a download for Parquet and JSON; both are hosted and loaded at
  engine start. Engines differ: 1.5.4 (browser), 1.5.6 (Node).
- Not done: nothing
- For the next agent: create one WASM engine per page and start it early
  (for example on page load), or files cannot load offline. Node reads
  Parquet and JSON with no download. The fixture is built from `range()`
  in SQL, so no data file is needed. Timestamps come back to the
  millisecond. If parity breaks after an upgrade, read the soft-assert diff
  per statement in the Playwright report.
- Ved should know: first use of the engine downloads about 36 MB of WASM
  (the eh build) plus 4 MB of extensions. Vercel compression and caching for
  these files is untested until T75.
- Commits: 5400d2e..(this handoff)

### T02 Design tokens, type and primitives
- Date: 2026-10-06
- Outcome: done
- What changed: `src/ui/tokens.css` (colour light and dark, chart series,
  type scale as `type-*` utilities, 4 px spacing base, radii, the one
  shadow, motion with reduced-motion zeroing). Plex Serif, Sans and Mono via
  `next/font`, theme script before paint (`src/ui/theme.ts`). Primitives:
  Button, Field, Menu, Tag, Rule, Notice and Status, Icon, Panel, Sheet,
  Tooltip, ThemeToggle, Disclosure, table styles (`primitives.css`), Mark
  and Highlight. `/styleguide` with a live mark demo and a full selected
  working paper specimen. `radix-ui` 1.7.0 and `lucide-react` 1.52.0 added.
- Verified: `npm run check` passed (46 tests, incl. 40 contrast pairs, the
  dark-block match and the raw-hex scan; probes with a hex in `src/ui` and
  a low `--ink-3` each made it fail); `npm run build` passed, `/styleguide`
  static; `npx playwright test` 8 passed (mark by mouse, by keyboard, 24 px
  target, reduced motion gives 0s wipe, panel and sheet focus return, theme
  remembered); `gh run list` CI success on cdffda7.
- UI check: `npm run shots -- /styleguide`, all six read (cropped to tiles)
  before and after fixes. No page overflow; wide tables scroll in their box
  with the first column fixed. Tabbed the page at 1440: order follows
  reading order, focus ring on every stop. Critic pass (fresh subagent,
  screenshots and rules only) gave five items: fixed the missing selected
  working paper, the generic full-width table and loose SQL block, status
  shown by colour alone (now a visible word), the swatch-grid colour section
  (now a table with live contrast), and unlabelled field states. Also took
  its tooltip and bordered-claim notes. Kept: no static drawing of panel
  and sheet (they open from buttons and are covered by e2e); no motion
  replay button (selecting a mark shows it); no extra scroll cue on phone
  tables beyond the fixed first column.
- Decisions: D-016 Radix and Lucide, D-017 no scrim on panels, D-018 where
  colours live and how it is checked, D-019 three-way theme control
- Differs from the spec: dark `--ink` on paper computes to 15.0, the §2
  table says 15.1 (rounding; the test allows it). Status lines show the
  word Passed, Caution or Problem before the sentence, to meet §11.
- Not done: nothing
- For the next agent: `Mark` needs a `Notes` provider with the working
  paper's id; `Highlight` with the same note number lights up with it.
  Panel and Sheet are controlled (`open`, `onOpenChange`) and return focus
  themselves. `scripts/shots.mjs` now kills its own dev server (fixed here).
- Ved should know: Playwright's Chromium had to be downloaded again
  (about 94 MB, free).
- Commits: 08f17f4..(this handoff)

### T01 Scaffold and quality gates
- Date: 2026-10-06
- Outcome: done
- What changed: Next.js app (App Router, TS strict, Tailwind 4, `src/`,
  `@/` alias) scaffolded in scratchpad and moved in. `eslint.config.mjs`
  with the §5 import boundaries (D-015) and Prettier. Vitest + coverage +
  fast-check (`vitest.config.mts`, one test in `src/config/`). Playwright
  config and smoke test `tests/e2e/home.spec.ts`. `scripts/shots.mjs`.
  `.gitignore`, `.env.example`, `src/config/product.ts`,
  `.github/workflows/ci.yml`. Versions in `docs/tooling.md`.
- Verified: `npm run check` passed (2 tests); `npm run build` passed (static
  `/`); `npm run test:e2e` 1 passed; `npm run shots -- /` wrote six files,
  `ls .screens` listed home-{390,834,1440}-{light,dark}.png; a probe
  `src/core/react-probe.ts` importing `react` failed eslint with
  no-restricted-imports (exit 1), then deleted; earlier probes also showed
  core blocks `node:fs` and relative `../config`, ui blocks `@/app`,
  adapters block value imports from core outside `engine/`, while `zod`,
  in-core relative and type-only imports pass; `gh run list` showed CI run
  37484660596 success, and the run for the last push is checked below.
- UI check: home at 390 px dark looked at; plain text, as expected before T02
- Decisions: D-013 Node 24 in CI, D-014 agent block in CLAUDE.md, D-015
  how boundaries are linted. Q-09 partly answered.
- Differs from the spec: `vitest.config.mts` not `.ts` (Vite warns on ESM in
  a CommonJS package). `devIndicators: false` in `next.config.ts` keeps the
  dev badge out of screenshots. `lint` also runs `prettier --check`.
  Scaffold README dropped (T74 writes it).
- Not done: nothing
- For the next agent: `npm run typecheck` runs `next typegen` first because
  `LayoutProps` comes from generated types. `shots` reuses a server on
  :3000 or starts `next dev` on :3100; `test:e2e` uses :3200. Prettier
  ignores `*.md` and `docs/`.
- Ved should know: `npm audit` reports 5 high in `braces`, lint-time only
  (see tooling.md). `CLAUDE.md` gained a Next.js block (D-014).
- Commits: 73fe5c5..(this handoff)

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
