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

## Open questions

Answer these in the task named, then move the answer up into a decision.

- Q-01 (T03): serve the DuckDB WASM files from this site or from jsDelivr?
  Prefer this site.
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

## Later

Ideas outside 1.0. Add here instead of building them.

- Several tables with declared joins
- Excel files
- A model running in the browser for free-text questions with no key at all
- A saved comparison between two uploads of the same export ("what changed
  since last week's file")
- Scheduled briefings
