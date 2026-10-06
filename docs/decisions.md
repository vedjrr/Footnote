# Footnote: decisions

Decisions that a later agent would otherwise have to rediscover, the questions
still open, and ideas parked for later. Add to it; do not rewrite history. To
reverse a decision, add a new one that says it replaces the old one.

Format for a new decision:

```
### D-0NN Short title
- Date: YYYY-MM-DD, task TNN
- Decision: what was chosen
- Why: the reason, in one or two sentences
- Considered: the alternatives and why not
```

## Decisions

### D-001 The product is called Footnote
- Date: 2026-10-05, planning
- Decision: Footnote. The name appears in code only in `src/config/product.ts`.
- Why: the product's idea is that every number carries a reference to its
  evidence, and the name gives the interface its central device.
- Considered: Tieout (audit term for reconciling figures; less widely known),
  Workpaper. No trademark or domain check was done. Ved may rename it.

### D-002 Browser-first, no backend, DuckDB-WASM
- Date: 2026-10-05, planning
- Decision: all analysis runs in the browser. The only server code is two
  route handlers that forward typed requests to Gemini.
- Why: v1's free hosting slept for 30 to 60 seconds, stored uploads on a
  server and needed two deploys. Running locally removes all three and makes
  the privacy claim true by construction.
- Considered: keeping FastAPI and Postgres (familiar, but keeps the problems);
  a serverless database (another account, and uploads still leave the device).

### D-003 Complete without an API key
- Date: 2026-10-05, planning
- Decision: every feature except free-text interpretation and prose polish
  works with no key. Gemini's free tier is an optional addition.
- Why: the project must cost nothing and must not break when a free quota
  changes.
- Considered: a model running in the browser (large download, weak on phones,
  poor at this task today); requiring each visitor's own key (friction).

### D-004 The model chooses from a dictionary; it does not write SQL
- Date: 2026-10-05, planning
- Decision: the model returns a plan made of metric and dimension ids, which a
  deterministic compiler turns into SQL. Raw SQL is a guarded, labelled escape
  hatch.
- Why: metric definitions stay consistent, invented columns become impossible,
  and injected text cannot run anything outside the dictionary.
- Considered: direct text-to-SQL as in v1 (kept as the eval baseline).

### D-005 Evals are built before the AI layer
- Date: 2026-10-05, planning
- Decision: golden questions, a scorer and the accuracy page exist before any
  model call is written. Dev and holdout sets are separate. A naive baseline is
  measured alongside.
- Why: the AI layer is then built against a scoreboard, and the published
  figure is credible.

### D-006 Own chart components on d3 scales and shapes
- Date: 2026-10-05, planning
- Decision: about seven SVG chart components written for this product.
- Why: a small chart vocabulary, full control of type and marks, and no
  library look.
- Considered: Recharts and Tremor (used in v1; hard to make not look like
  themselves); Observable Plot (good defaults, less control of interaction).

### D-007 One table per workspace in 1.0
- Date: 2026-10-05, planning
- Decision: no joins across files.
- Why: join paths multiply the ways an answer can be wrong, and the first
  release needs a trustworthy core.

### D-008 Trunk-based on main, small commits, single author
- Date: 2026-10-05, planning
- Decision: commit and push after every verified step. Ved is the only author.
  Attribution is disabled in `.claude/settings.json` and stripped by
  `.githooks/commit-msg`.

### D-009 IBM Plex Serif, Sans and Mono
- Date: 2026-10-05, planning
- Decision: one superfamily, self-hosted through `next/font`.
- Why: serif for what Footnote says and sans for what you operate gives the
  split a meaning; Plex has good tabular figures; no run-time font request.

### D-010 Synthetic sample data with planted effects
- Date: 2026-10-05, planning
- Decision: three generated datasets whose notable effects are known in
  advance and recorded in `truth.json`.
- Why: with known ground truth the analysis can be tested, not just admired.
  No licensing or privacy questions.

### D-011 Say where, never why
- Date: 2026-10-05, planning
- Decision: change analysis locates a change and never names a cause. Causal
  words are banned from templates and rejected by the grounding check.
- Why: the data cannot show cause, and an analyst who claims one loses trust.

### D-012 AI assist is off by default for a user's own file
- Date: 2026-10-05, planning
- Decision: on for the synthetic samples, off for own files until switched on
  after reading what is sent.
- Why: the free Gemini tier may use submitted content to improve Google's
  products.

### D-013 Node 24 in CI, Node types 24
- Date: 2026-10-06, task T01
- Decision: CI runs Node 24. `@types/node` is pinned to `^24` and
  `package.json` declares `engines.node >=24`. Ved's machine runs Node 26.
- Why: Vitest 5 needs `@types/node` 22 or later, and create-next-app put in
  20. Node 24 is the active LTS line, so CI tests the oldest version a
  contributor or Vercel is likely to run.
- Considered: `--legacy-peer-deps` (hides a real conflict); Node 26 in CI
  (not LTS, and nothing here needs it).

### D-014 The Next.js agent-rules block stays in CLAUDE.md
- Date: 2026-10-06, task T01
- Decision: commit the block that `next dev` appends to `CLAUDE.md`
  (between the `nextjs-agent-rules` markers) and leave it there.
- Why: Next 16 writes it whenever `next dev` runs under an agent
  (`node_modules/next/dist/server/lib/app-info-log.js`,
  `ensureAgentRulesForDev`) and writes it again if removed, so deleting it
  leaves a dirty tree after every dev run. Its advice (read the bundled
  Next docs in `node_modules/next/dist/docs/`) matches `CLAUDE.md`'s rule
  not to write Next code from memory.
- Considered: moving it to an `AGENTS.md` (stops the rewrite, but agents
  here read `CLAUDE.md`, so the advice would be lost); there is no config
  switch to turn the generator off.

### D-015 Import boundaries are enforced by three ESLint rules
- Date: 2026-10-06, task T01
- Decision: `no-restricted-imports` with a regex limits `src/core` to core,
  `zod`, `d3-array` and `yaml` (this also blocks `node:` built-ins);
  `import/no-restricted-paths` catches relative paths that leave a folder
  (core, ui, adapters); `@typescript-eslint/no-restricted-imports` with
  `allowTypeImports` lets adapters take only types from core, plus values
  from `core/engine` (the ports).
- Why: one rule alone misses either package imports or relative paths.
  All are in `eslint.config.mjs`.
- Considered: `eslint-plugin-boundaries` (another dependency for the same
  result). Not enforced: core using DOM globals without importing them;
  T03 can drop `dom` from a core-only tsconfig if that matters.

### D-016 Primitives are Radix through the `radix-ui` package, icons Lucide
- Date: 2026-10-06, task T02
- Decision: Menu, Tooltip, Panel and Sheet wrap Radix primitives imported
  from the unified `radix-ui` package (1.7.0); icons come from
  `lucide-react` (1.52.0) through `src/ui/icon.tsx`, which exposes only the
  eleven icons named in ui-ux-rules §4 at a 1.5 px stroke.
- Why: architecture §3 names Radix; the unified package is what Radix now
  recommends and avoids version skew between primitives. A closed icon list
  stops decorative icons creeping in.
- Considered: the per-primitive `@radix-ui/react-*` packages (same code,
  more entries in package.json).

### D-017 Panels and sheets have no dimming scrim
- Date: 2026-10-06, task T02
- Decision: the Panel and Sheet overlays are transparent. They still catch
  outside clicks. The panel and sheet carry the one float shadow and a
  hairline instead.
- Why: ui-ux-rules §2 rules out translucency, and a scrim is a translucent
  layer. The page stays readable behind the working paper.
- Considered: an opaque scrim (hides the claim the evidence belongs to),
  a translucent ink scrim (breaks §2).

### D-018 Where colours live, and how that is checked
- Date: 2026-10-06, task T02
- Decision: all colours, the chart series included, are CSS variables in
  `src/ui/tokens.css`. Tailwind's default palette, type scale, radii and
  shadows are cleared, so only token utilities exist. `--highlight-ink` is
  a token of its own (ink in light, `#FFF3BF` in dark, from the §2 table).
  `src/ui/tokens.test.ts` fails on a raw hex anywhere in `src/` except
  `tokens.css` and a future `src/ui/charts/palette.(ts|css)`, checks 20 text
  pairs per theme at 4.5:1, and checks the two dark blocks are identical.
  Spacing uses Tailwind's `--spacing: 4px`, so the scale is steps 1, 2, 3,
  4, 6, 8, 12, 16 and 24; other steps are not blocked by a rule.
- Why: one source for colour, and a test is cheaper than a custom lint rule.
- Considered: a Stylelint rule (another tool), an ESLint rule on class
  strings (misses CSS files).

### D-019 The theme control offers three choices
- Date: 2026-10-06, task T02
- Decision: the theme toggle is a small menu with "Same as system", "Light"
  and "Dark". The choice is stored in `localStorage` (`footnote-theme`) and
  applied by an inline script before first paint. "Same as system" removes
  the stored value.
- Why: §2 asks for a toggle that overrides the system and is remembered; a
  two-state toggle gives no way back to following the system.
- Considered: a single button that flips light and dark.

### D-020 DuckDB-WASM and its extensions are served from this site (answers Q-01)
- Date: 2026-10-06, task T03
- Decision: `scripts/copy-duckdb.mjs` copies the eh and mvp bundles (wasm
  and worker) from `node_modules` into `public/duckdb/`, and downloads the
  `parquet` and `json` extensions for engine `v1.5.4` (`wasm_eh`,
  `wasm_mvp`) into `public/duckdb/extensions/<version>/<platform>/`. It runs
  on `postinstall` (a failed download warns) and before `dev` and `build`
  (`--strict`: a missing file fails). Nothing under `public/duckdb/` is
  committed. The adapter sets `custom_extension_repository` to this site and
  runs `LOAD parquet` and `LOAD json` when the engine starts.
- Why: the browser build has no Parquet or JSON reader built in. Left alone
  it fetches them from extensions.duckdb.org on first use, so a Parquet file
  failed with the network cut (seen in the offline test). Loading them at
  start from this site means no third-party request and offline loading
  works. Vercel's 100 MB Hobby limit is on CLI uploads; these files are
  built in the Vercel build, the largest is 41 MB (`duckdb-mvp.wasm`).
- Cost: about 4 MB more at engine start (the two extensions, eh). The
  engine starts lazily, on first use.
- Considered: jsDelivr for the bundles (a third-party request on every
  visit, would need a note on the About page); committing the extension
  files (8 MB of binaries per engine version in history); converting
  Parquet to CSV on ingest (still needs a Parquet reader).
- When the `@duckdb/duckdb-wasm` package changes, update `ENGINE_VERSION`
  in the script to what `engineVersion()` reports, or the offline test
  fails.

### D-021 Normalisation details at the engine boundary
- Date: 2026-10-06, task T03
- Decision: timestamps are kept to the millisecond (`YYYY-MM-DDTHH:MM:SS`,
  plus `.sss` only when not zero), because Arrow in the browser hands back
  milliseconds. NaN and both infinities become `null`. Query result columns
  report `nullable: true`; `describe()` reports DuckDB's own nullability. In
  the browser, an Arrow `DECIMAL(38,0)` is read as an integer, because that
  is how DuckDB exports `HUGEINT` (so `SUM` of a `BIGINT` matches Node).
- Why: these were the places the two adapters could disagree; the parity
  suite pins each one.
- Limit: a user column declared `DECIMAL(38,0)` shows as integer in the
  browser and decimal in Node. Unlikely in CSV or Parquet input.

### D-022 Engine harness page, one engine per page, ES2020 target
- Date: 2026-10-06, task T03
- Decision: `/dev/engine` is a test page for Playwright (404 in production
  builds). It keeps one engine for the life of the page. `tsconfig.json`
  targets ES2020 so `bigint` literals typecheck. Test files in `src/core`
  may import `vitest` and `fast-check`; core code still may not.
- Why: React runs effects twice in development. With an engine created
  and closed per effect, the first query stalled in 4 of 7 runs; with one
  engine per page it passed 5 of 5. The exact cause inside DuckDB-WASM was
  not traced. The real app should also hold one engine per page (T06/T10).

### D-023 Sample data generators: how they run and how effects are planted
- Date: 2026-10-06, task T04
- Decision: generators live in `data/generators/` and run with `tsx`
  (dev dependency) from `scripts/generate-data.mts`. `.mts` is needed
  because the package is CommonJS, and the script uses top-level await. The
  RNG is sfc32 seeded through splitmix32 (`rng.ts`). Line counts are not
  sampled. They are split by largest remainder per month across category ×
  sub-category × region × channel, and returns are split exactly per month
  and sub-category. Randomness stays in customer, date, price, quantity,
  discount and which rows get returned. Rows go to Parquet through the Node
  adapter: JSON lines, then a typed `CREATE TABLE`, then `COPY ... (FORMAT
  parquet, COMPRESSION zstd)`. The content hash is sha256 over each row as
  text, sorted. The output is byte-identical between runs.
- Why: with free sampling, Electronics Feb-to-March noise was about 5%,
  as large as the gaps between the spec's ranges. With per-slot counts,
  only price and quantity noise remain.
- Alternatives: per-line random choice of category (too noisy); a fixed
  seed per effect (does not fix noise).
- Truth ranges: wherever the spec says "about X", the range in
  `data/generators/<set>/truth.ts` was written down before any tuning and
  has not been changed since. Effects are measured on the raw data, problems
  included. R2 and R6 use the §6.2 mix and rate split ("mostly rate" or
  "mostly mix" per the 2× rule), with a local copy of the formula until
  T42 builds the real one.
- Retail column choices: `discount_pct` is whole percentage points
  (10 means 10%). Money columns are `DECIMAL(12,2)` (`unit_price`
  `DECIMAL(10,2)`). An empty `customer_segment` is NULL. Duplicate rows sit
  next to their original. A negative-quantity row is never copied, so that
  count stays at exactly 12. Negative rows also have negative `revenue`
  and `cost`.
- Tuned parameters, and why realised values differ from them:
  `GROWTH_PER_YEAR` is 5%, which realises as 7.7% for 2024 on 2023. The June
  duplicates and the Q4 2024 Electronics mix (R6) add to growth.
  `CUSTOMERS` is 6,800, which gives 5,910 customers with orders. In R6,
  Electronics' own return rate rises 0.69 points in Q4 2024 because the R3
  Headphones spike sits in December, so the check allows a category change
  of up to 1.5 points. The split is still mostly mix: rate over mix is 0.32.

### D-024 Retail R5 and R7 are briefing effects, as the spec says
- Date: 2026-10-06, task T05
- Decision: `truth.json` for retail marks R1, R5 and R7 `briefing: true`,
  following analytics-spec §10 ("Expected in the default briefing: retail
  R1, R5, R7"). T04 had marked only R1, and its test expected only R1.
- Why: evals recall (evals.md) counts every `briefing: true` effect. With
  R5 and R7 unmarked, recall would have been measured against the wrong set.
  The data and the content hash do not change; only the flags and the test.
- Considered: keeping R1 alone because "the main planted effect sits in the
  final month". That sentence explains where the main effect sits; it does
  not limit the briefing to it.

## Open questions

Answer these in the task named, then move the answer up into a decision.

- Q-01 (T03): answered in D-020, this site.
- Q-02 (T53): which Gemini model id is on the free tier now and good enough
  for planning? Check Google AI Studio.
- Q-03 (T10): do the file size limits in NFR-07 hold up when measured?
- Q-04 (T21): is DuckDB's own SQL parser usable for the guard in both
  adapters?
- Q-05 (Ved): final repository name and whether to buy a domain.
- Q-06 (T13, T45): S6 is marked `briefing: true` (analytics-spec §10.3), but
  the briefing's caveats list only serious health problems (§7 step 3).
  `industry` empty in 2% is minor under H3 (serious only at 20%), and no check
  in §3 detects `seats` 0 with `mrr` above 0. As written, S6 cannot appear in
  the briefing. Either add a check (for example "measure is zero while a
  related measure is positive") or drop `briefing: true` from S6.
- Q-07 (T13): `csat` is empty for about 60% of tickets, which H3 calls
  serious (20% or more on a dictionary column). T5 says empty `csat` must be
  described as "rated tickets only", not as a problem. The rule that exempts
  it is not written. Options: a dictionary flag such as `optional: true` on
  the hand-written dictionary, or treat rating-like `avg` measures as
  optional.
- Q-08 (T30, T42): for a change question already filtered to a segment
  ("Where did the March drop in electronics revenue come from?"), does the
  `truth.json` path for R1 include the filter value (Electronics, Online,
  West) or only the drill-down below it (Online, West)? evals §4 says the
  path must equal truth; the goldens need one convention.
- Q-09 (T00): the T00 skim of `docs/architecture.md` did not happen. The
  session's tool permission check refused to read that file. The next agent
  that reads it should look for conflicts with the other specs.
  T01: read in full, it opened normally. Within §3, §5 and §12 no conflict
  with `steps.md` was found. Installed versions differ from §3's "seen"
  column (TypeScript 5.9, React 19.2); §3 says to use what installers
  give. Still open: a cross-check of architecture against the other specs.
- Q-10 (Ved): `gh` is logged in as `vedjr02` while the repository and
  `CLAUDE.md` use `vedjrr`. Pushing works over HTTPS, and GitHub links the
  first commit to the `vedjrr` account, so authorship is fine. Only `gh`
  commands that need write access to `vedjrr/Footnote` (issues, releases)
  may fail until `gh` is switched to `vedjrr`.
- Q-11 (T13): R7 plants `customer_segment` empty in 0.5% of retail rows,
  but H3 reports empty values only at 1% or more. As written, the health
  screen will not show this planted problem. The other R7 problems are
  caught: duplicates at 1.2% are serious under H1, lower-case regions at
  0.8% are minor under H4, and negative quantities are minor under H6.
  Either lower the H3 floor for dictionary columns, or accept that the
  0.5% only shows in profile null counts.

## Later

Ideas outside 1.0. Add here instead of building them.

- Several tables with declared joins
- Excel files
- A model running in the browser for free-text questions with no key at all
- A saved comparison between two uploads of the same export ("what changed
  since last week's file")
- Scheduled briefings
