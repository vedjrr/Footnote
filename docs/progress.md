# Footnote: progress

The shared memory between agent sessions. Every session reads the current
state and the last three log entries before doing anything, and writes one
entry before stopping.

## Current state

Rewrite this block at every handoff. Keep it under 25 lines. It is shown to
each new session automatically, so it must be enough to start from.

<!-- STATE:START -->
- Last finished task: T02 Design tokens, type and primitives (done)
- Next task: T03 Query engine port, adapters and parity
- In progress: nothing
- Build: Next.js 16.3 app. Routes `/` (name only) and `/styleguide`, the
  visual reference for every token and primitive in both themes.
  `npm run check` (eslint, prettier, typegen + tsc, vitest 46 tests) and
  `npm run build` pass. `npm run test:e2e` 8 passed. CI green.
- UI: tokens in `src/ui/tokens.css` (Tailwind defaults cleared, D-018);
  primitives in `src/ui/` on Radix and Lucide (D-016); mark and highlight
  in `src/ui/mark.tsx` (`Notes`, `Mark`, `Highlight`).
- Scripts: `dev`, `check`, `build`, `test`, `test:coverage`, `test:e2e`,
  `shots`, `format`. `precompute`, `data:generate`, `eval` do not exist yet.
- Evals: not run
- Blocked on Ved: nothing
- Watch out for: a raw hex outside `tokens.css` fails `npm run check`.
  `next dev` run by an agent appends a block to `CLAUDE.md` (D-014). If
  Playwright says its browser is missing, run `npx playwright install
  chromium`. Open questions Q-06 to Q-10 in `decisions.md`.
- Updated: 2026-10-06, T02
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
