# Footnote: tooling

What is installed on Ved's machine, checked in T00 on 2026-10-06. Update this
file when a tool is added or a version changes in a way that matters.

## Versions

| Tool | Version |
|---|---|
| OS | macOS 27.0.1 (build 26A434), arm64 |
| Node | v26.8.2 |
| npm | 11.19.1 |
| git | 2.54.0 (Apple Git-157) |
| gh | 2.96.0, logged in to github.com as `vedjr02` |

Git identity for this repository: `vedjrr <ambreved3@gmail.com>` (global
config). Remote: `https://github.com/vedjrr/Footnote.git`, branch `main`.
Pushing over HTTPS works with the stored credentials.

## Project packages

Installed in T01 on 2026-10-06 (`npm ls --depth=0`). Use what the installer
gives; record changes here.

| Package | Version |
|---|---|
| next, eslint-config-next | 16.3.8 |
| react, react-dom | 19.2.8 |
| typescript | 5.9.3 |
| tailwindcss, @tailwindcss/postcss | 4.3.3 |
| eslint | 9.39.5 |
| prettier | 3.9.9 |
| vitest, @vitest/coverage-v8 | 5.0.3 |
| fast-check | 4.10.2 |
| @playwright/test (Chromium installed) | 1.63.0. In T02 the headless shell (build 1243) was missing from the cache and was reinstalled with `npx playwright install chromium`; run that if `shots` or `test:e2e` says the executable does not exist |
| @types/node | 24.19.1 (see D-013) |
| radix-ui (added T02, D-016) | 1.7.0 |
| lucide-react (added T02, D-016) | 1.52.0 |
| @duckdb/duckdb-wasm (added T03, D-020) | 1.33.1-dev57.0; engine reports `duckdb v1.5.4 (duckdb-wasm)` |
| apache-arrow (added T03) | 17.0.0, pinned to the version duckdb-wasm depends on, so there is one copy |
| @duckdb/node-api (dev, added T03) | 1.5.6-r.1; engine reports `duckdb v1.5.6 (node-api)` |

The two engines are different DuckDB versions (1.5.4 in the browser, 1.5.6
in Node). The parity suite (`tests/parity/`, 55 statements) passes on both;
rerun it after changing either package. Node has Parquet and JSON built in;
the browser loads them from `public/duckdb/extensions/` (D-020).

CI: GitHub Actions, `actions/checkout@v7`, `actions/setup-node@v7`, Node 24.

`npm audit` (T01): 5 high, all from `braces` under `eslint-config-next`
(lint-time only, not shipped). The only fix offered is `--force`, which
would break the lint setup. Recheck when `eslint-config-next` updates.

## Skills for the jobs in `CLAUDE.md`

| Job | Skill to use | Status |
|---|---|---|
| Interface work | `frontend-design` | Not installed. Use `impeccable:impeccable` instead; `design-taste-frontend` and `minimalist-ui` as second opinions. `docs/ui-ux-rules.md` wins over all of them |
| Charts | `dataviz` | Installed |
| SQL, compiler, goldens | `data:sql-queries`, `data:write-query` | Installed |
| Statistics in findings | `data:statistical-analysis` | Installed |
| Checking an analysis or eval | `data:validate-data` | Installed |
| Writing or refactoring code | `andrej-karpathy-skills:karpathy-guidelines` | Installed |
| Interface copy, README, explainers | `humanizer` | Installed as `anthropic-skills:humanizer` |
| Hard second opinion | `gauntlet-loop`, `/audit` | Installed as `anthropic-skills:gauntlet-loop`; `/audit` is in `.claude/skills/` |

Project skills in `.claude/skills/`: `next`, `handoff`, `progress`, `audit`.

Other installed skills that may help: `data:explore-data` (profiling ideas for
T11), `data:data-visualization`, `safe-refactor`, `surgical-patch`,
`investigate-first`, `verify-and-stop`, `code-review`, `security-review`,
`simplify`, `run` (launch the app and look at it), `claude-api` (not relevant:
Footnote uses Gemini).

Not useful here and not to be used for the product: image generation skills
(`imagegen-*`, `image-to-code`, `brandkit`), motion-heavy design skills
(`gpt-taste`, `high-end-visual-design`, `industrial-brutalist-ui`) whose
defaults break `ui-ux-rules.md` §8 and §12.

## MCP servers

| Server | Useful for |
|---|---|
| Context7 | Library docs: DuckDB-WASM, Next.js, Tailwind, Zod, the Gemini SDK, d3. Use before writing code against any of them |
| Claude in Chrome | Looking at the running app, console and network logs. Network log is how to check that no request carries file rows (NFR-02) |
| Firecrawl (two connections) | Reading a docs page Context7 lacks, for example Google AI Studio's free-tier model list (Q-02) |
| draw.io | Architecture diagrams for the case study, if wanted |
| Vercel | Not authenticated. Needed only in T75, and Ved imports the repo himself |
| Notion, Gmail, Google Calendar, Claude Docs, Apify, Mobbin, Clerk | Not needed for Footnote |
| `plugin:data:definite` | Failed to connect. Not needed |

## Missing from the table in `CLAUDE.md`

- `frontend-design` skill: not installed (substitute above).
- Everything else in the table is available.
