# Footnote: progress

The shared memory between agent sessions. Every session reads the current
state and the last three log entries before doing anything, and writes one
entry before stopping.

## Current state

Rewrite this block at every handoff. Keep it under 25 lines. It is shown to
each new session automatically, so it must be enough to start from.

<!-- STATE:START -->
- Last finished task: T04 Sample data: framework and retail (done)
- Next task: T05 Sample data: subscriptions and support
- In progress: nothing
- Build: Next.js 16.3 app. Routes `/`, `/styleguide`, `/dev/engine`
  (404 in production). `npm run check` (eslint, prettier, typegen + tsc,
  vitest 69 tests incl. Node parity and retail truth) and `npm run build`
  pass. `npm run test:e2e` 12 passed at T03.
- Engine: port `src/core/engine/types.ts`; `createNodeEngine()` and
  `createWasmEngine()` (one per page, D-022). Parity in `tests/parity/`.
- Sample data: `npm run data:generate` (tsx, `scripts/generate-data.mts`)
  writes `data/demo/retail/orders.parquet` (59,881 rows, 0.75 MB) and
  `truth.json` (R1-R7, realised by query, content hash). Framework in
  `data/generators/` (rng, write, truth); retail in `retail/` (D-023).
- UI: tokens in `src/ui/tokens.css`; primitives in `src/ui/`.
- Scripts: `dev`, `check`, `build`, `test`, `test:coverage`, `test:e2e`,
  `shots`, `format`, `data:generate`. `precompute`, `eval` do not exist yet.
- Evals: not run
- Blocked on Ved: nothing
- Watch out for: a raw hex outside `tokens.css` fails `npm run check`.
  `next dev` run by an agent appends a block to `CLAUDE.md` (D-014).
  After changing a generator, rerun `npm run data:generate` and commit the
  data, or the retail tests fail on the hash. `data/demo/` is not
  prettier-formatted. Open questions Q-06 to Q-11 in `decisions.md`.
- Updated: 2026-10-06, T04
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
