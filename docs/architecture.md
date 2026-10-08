# Footnote: architecture

How the product is put together. Read the section your task points to. Section
2 (invariants) applies to every task.

## 1. Shape of the system

```
                         Browser
 ┌───────────────────────────────────────────────────────────────┐
 │  Next.js pages (React)                                        │
 │      │                                                        │
 │      ▼                                                        │
 │  features/  ──►  core/  (pure TypeScript: profile, dictionary,│
 │                          query compiler, findings, narrative, │
 │                          ask, report)                         │
 │                    │                 │                        │
 │                    ▼                 ▼                        │
 │          QueryEngine port      LlmClient port                 │
 │                    │                 │                        │
 │        DuckDB-WASM (worker)    fetch /api/plan, /api/polish   │
 │        file stays here         (only when AI assist is on)    │
 └────────────────────────────────────────│──────────────────────┘
                                          ▼
                         Next.js route handlers (Vercel)
                         validate payload ─► Gemini free tier

 Build time and tests (Node):  same core/  +  DuckDB Node adapter
     ├─ precompute sample briefings  ─► public/demo/*.json
     └─ eval runner                  ─► eval/results/*.json
```

There is no application server state and no database. The only server code is
two small route handlers that forward typed requests to Gemini.

## 2. Invariants

These hold after every task. If a task cannot be done without breaking one,
stop and ask.

1. **Works without a key.** With no API key and AI assist off, everything works
   except free-text interpretation and prose polish.
2. **Rows stay on the device.** No request carries rows from a user's file.
   Only the payloads in section 7 are ever sent, and only with AI assist on.
3. **The model never supplies a number.** Every number shown comes from a query
   result. Model text passes the grounding check (`analytics-spec.md` §9.3) or
   is discarded.
4. **Shown SQL is run SQL.** The SQL in a working paper is the statement that
   produced the result.
5. **One core.** `src/core` is the same code in the browser, in evals and in
   the build-time precompute. It imports nothing from React, Next, the DOM, or
   Node built-ins.
6. **Scores come from files.** Accuracy figures are read from
   `eval/results/*.json`, which only the eval runner writes.
7. **Zero cost.** Nothing that needs payment or a card on file.

## 3. Stack

Versions below were current on 2026-10-05. Use what the installers give you at
build time and record the versions in `docs/tooling.md`. Do not write code for
these libraries from memory: several had major releases recently. Check current
docs first (a docs MCP if connected, otherwise the official site).

| Layer | Choice | Seen version |
|---|---|---|
| Framework | Next.js, App Router | 16.3 |
| UI runtime | React | 19.3 |
| Language | TypeScript, strict | 7.0 |
| Styling | Tailwind CSS with CSS variables for tokens | 4.3 |
| Query engine, browser | `@duckdb/duckdb-wasm` in a Web Worker | 1.33 dev builds |
| Query engine, Node | `@duckdb/node-api` | 1.5 |
| Validation | Zod | 4.6 |
| Charts | Own SVG components on `d3-scale`, `d3-shape`, `d3-array` | 4.0 / 3.2 |
| Accessible primitives | Radix UI primitives, unstyled | 1.1 |
| State | Zustand | 5.0 |
| Local storage | `idb-keyval` over IndexedDB | 6.3 |
| Model (optional) | `@google/genai`, a Flash-class model on the free tier | 2.27 |
| Unit and integration tests | Vitest, `fast-check` for property tests | 5.0 / 4.10 |
| End-to-end and screenshots | Playwright | 1.63 |
| CI | GitHub Actions | |
| Hosting | Vercel Hobby | |

Not used, on purpose: a component kit with a default look (shadcn themes,
Tremor, MUI), a chart library with its own styling, smooth-scroll or
scroll-animation libraries, WebGL, any analytics or tracking script.

## 4. Query engine port

```ts
// src/core/engine/types.ts
export type ColumnType =
  | 'integer' | 'decimal' | 'boolean' | 'date' | 'timestamp' | 'text';

export interface ColumnInfo { name: string; type: ColumnType; nullable: boolean }

export type Cell = string | number | boolean | null; // dates as ISO strings

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Cell[][];
  rowCount: number;
  elapsedMs: number;
}

export interface QueryEngine {
  registerFile(table: string, source: FileSource): Promise<ColumnInfo[]>;
  query(sql: string, params?: Cell[]): Promise<QueryResult>;
  describe(table: string): Promise<ColumnInfo[]>;
  engineVersion(): Promise<string>;
  close(): Promise<void>;
}
```

Two adapters implement it: `adapters/duckdb-wasm` (browser, in a worker) and
`adapters/duckdb-node` (Node).

Rules that prevent the usual DuckDB-in-JavaScript problems:

- **Normalise at the adapter boundary.** Core only ever sees `Cell`. `BIGINT`
  becomes a number when it is a safe integer, otherwise a string. `DECIMAL`
  becomes a number. `DATE` becomes `YYYY-MM-DD`. `TIMESTAMP` becomes ISO 8601
  without a zone. `NULL` and `NaN` become `null`.
- **The compiler casts aggregates.** Sums and averages are emitted as
  `CAST(... AS DOUBLE)` and counts as `CAST(... AS BIGINT)` so both adapters
  return the same shapes.
- **Parameters, not string building.** Literal values go in as parameters. The
  display SQL (section 6.3) is produced separately.
- **Parity test.** `tests/parity/*.sql` holds at least 40 statements covering
  every construct the compiler emits. A Vitest suite runs them on the Node
  adapter and a Playwright test runs them on the WASM adapter. Normalised
  results must be identical. Record both `engineVersion()` values in
  `docs/tooling.md`.
- **Hosting the WASM files.** Prefer serving the DuckDB WASM and worker files
  from this site so the app makes no third-party requests. If Vercel limits or
  build size prevent it, load them from jsDelivr, say so on the About page, and
  record the decision (open question Q-01).
- **Extensions.** Check whether reading Parquet and JSON needs an extension
  download at run time. If it does, host the extension file or convert on
  ingest. A user must be able to load a file with the network cut after page
  load.

## 5. Directory layout

```
src/
  app/                       routes and layouts only; no business logic
    page.tsx                 sample briefing (static)
    w/[workspace]/...        briefing, ask, metrics, health, report
    accuracy/                the accuracy page
    about/
    styleguide/              tokens and components reference
    api/plan/route.ts
    api/polish/route.ts
  core/                      pure TypeScript (invariant 5)
    engine/                  port and shared types
    profile/                 column statistics
    health/                  data health checks
    model/                   dictionary: types, inference, validation, YAML
    query/                   QuerySpec, compiler, display SQL, guard, checks
    findings/                periods, changes, drivers, mix-rate, unusual points
    narrative/               templates, number formatting, grounding
    ask/                     resolver, plan types, prompt builders, follow-ups
    report/                  HTML and Markdown export
  adapters/
    duckdb-wasm/  duckdb-node/  llm-http/  llm-gemini/  storage/
  ui/                        tokens, primitives, charts (no data fetching)
  features/                  briefing, ask, metrics, health, report, accuracy
  config/product.ts          product name and links, one place
data/
  generators/                seeded generators for the sample datasets
  demo/<id>/                 generated Parquet, dictionary.yaml, truth.json
eval/
  goldens/dev/  goldens/holdout/
  runner/  recordings/  results/  thresholds.json
scripts/                     precompute, screenshots, data generation
tests/                       parity SQL, end-to-end
docs/
```

Import rules, enforced by ESLint `no-restricted-imports` (set up in T01):

- `core/**` may import only from `core/**` and from `zod`, `d3-array`, `yaml`.
- `ui/**` may not import from `features/**`, `adapters/**` or `app/**`.
- `adapters/**` may import from `core/**` only for types and ports.
- Only `features/**` and `app/**` wire adapters to core.

## 6. Query path

### 6.1 Dictionary (semantic model)

```ts
// src/core/model/types.ts (shape; write the Zod schemas to match)
type Aggregation =
  | 'sum' | 'avg' | 'min' | 'max' | 'median' | 'count' | 'count_distinct';

interface SimpleMetric {
  kind: 'simple';
  id: string;                 // slug, stable
  label: string;              // "Revenue"
  column: string | null;      // null for count of rows
  agg: Aggregation;           // 'avg' is compiled as sum / count of non-empty
  overTime: 'sum' | 'last' | 'avg';   // how it rolls up across periods
  where?: Filter[];           // e.g. count of rows where returned = true
}
interface RatioMetric {
  kind: 'ratio';
  id: string; label: string;
  numerator: string;          // metric id
  denominator: string;        // metric id
}
interface DifferenceMetric {   // D-031: gross profit = revenue - cost
  kind: 'difference';
  id: string; label: string;
  minuend: string;            // metric id
  subtrahend: string;         // metric id
}
type Metric = (SimpleMetric | RatioMetric | DifferenceMetric) & {
  format: { style: 'number' | 'currency' | 'percent' | 'duration';
            unit?: string; decimals?: number };
  direction: 'higher_better' | 'lower_better' | 'neutral';
  synonyms: string[];
  description?: string;
  importance: number;         // 0..1, used to rank findings
};

interface Dimension {
  id: string; label: string; column: string;
  role: 'category' | 'entity';   // entity = high variety, e.g. customer id
  distinct: number;
  synonyms: string[];
  private: boolean;              // never sent to the model
};

interface TimeColumn { id: string; label: string; column: string;
                       min: string; max: string; defaultGrain: Grain }

interface Starter { label: string; spec: QuerySpec }   // D-031

interface SemanticModel { table: string; metrics: Metric[];
                          dimensions: Dimension[]; time: TimeColumn | null;
                          hidden: string[]; version: number;
                          starters: Starter[] }
```

`overTime` matters. Revenue adds up across months (`sum`). Monthly recurring
revenue, seat counts and balances do not: the yearly figure is the last month's
figure (`last`). Summing them across periods is a classic wrong answer, and one
the naive baseline is expected to make.

### 6.2 QuerySpec

```ts
type Grain = 'day' | 'week' | 'month' | 'quarter' | 'year';

type TimeRange =
  | { kind: 'absolute'; from: string; to: string }          // inclusive dates
  | { kind: 'last_n'; n: number; grain: Grain; complete: boolean }
  | { kind: 'period'; grain: Grain; offset: number }        // 0 = latest complete
  | { kind: 'all' };

interface Filter {
  dimension: string;                                // dimension id
  op: 'in' | 'not_in' | 'contains';
  values: string[];
}

interface QuerySpec {
  metrics: string[];                 // 1 to 4 metric ids
  by: string[];                      // 0 to 2 dimension ids
  time?: { grain?: Grain; range: TimeRange };   // grain set = series over time
  filters: Filter[];
  compare?: 'previous_period' | 'same_period_last_year';
  calc?: 'share_of_total' | 'running_total' | 'rank';
  sort?: { by: string; dir: 'asc' | 'desc' };   // metric or dimension id
  limit?: number;                               // 1 to 1000
}
```

Relative periods are resolved against the data, never the clock: "now" is the
latest date in the time column (`analytics-spec.md` §4).

### 6.3 Compiler

`compile(spec, model) -> { sql, params, displaySql, columns }`

- Pure function. Same input, same output, byte for byte.
- Rejects any id not in the model with a typed error. It cannot emit a column
  that does not exist.
- Identifiers are double-quoted and escaped. Values are parameters.
- Ratio metrics compile to `numerator / NULLIF(denominator, 0)`, each side
  aggregated at the query's grouping, never an average of row-level ratios.
  An `avg` metric is compiled the same way, as the sum over the count of
  non-empty values, so it can be decomposed like any other ratio.
- `overTime: 'last'` metrics aggregate within each period first, then take the
  last period in range when no time grain is requested.
- `compare` produces current, previous, absolute change and percent change
  columns.
- `displaySql` is the same statement with values inlined and formatted for
  reading. A test asserts that running `displaySql` returns the same result as
  `sql` with `params` for every parity case.

### 6.4 Raw SQL guard

The plan type allows a raw SQL escape hatch for questions the spec cannot
express. It runs only if it passes all of:

- one statement, parsed, `SELECT` or `WITH ... SELECT` only
- references only the workspace table
- no functions that read files, the network or settings (`read_csv`,
  `read_parquet`, `httpfs`, `install`, `load`, `attach`, `copy`, `pragma`,
  `set`, `export`, and anything not on an allow-list of analytic functions)
- wrapped in an outer `SELECT * FROM (...) LIMIT 1000`
- a 5 second timeout

Answers that took this path are labelled "Not checked against the dictionary"
in the working paper and are scored as a separate column in evals.

### 6.5 Result checks

Run on every result before it is shown. Listed in `analytics-spec.md` §8.

## 7. Model contract (optional AI assist)

The browser never calls Gemini directly and never builds a prompt. It sends a
typed payload to a route handler, which builds the prompt on the server.

### POST /api/plan

Request, validated with Zod, 16 KB cap:

```ts
{
  question: string,                    // max 300 characters
  digest: {
    metrics: { id, label, kind, format, synonyms, description? }[],
    dimensions: { id, label, role, synonyms,
                  values?: string[] }[],   // see rule below
    time: { id, label, min, max, grains } | null,
    dataNow: string                    // latest date in the data
  },
  previous?: QuerySpec                 // for follow-ups
}
```

Dimension `values` are included only when the dimension has 50 or fewer
distinct values and is not marked `private`, capped at 25 values of 40
characters each. Columns that look like names, emails, phone numbers,
addresses or free text are marked `private` by inference (`analytics-spec.md`
§2.4). Filters on other dimensions are resolved to real values in the browser
after planning.

Response:

```ts
type Plan =
  | { kind: 'query'; spec: QuerySpec }
  | { kind: 'change'; metric: string; from: TimeRange; to: TimeRange;
      filters: Filter[] }
  | { kind: 'clarify'; question: string; term: string;
      options: { label: string; metricOrDimension: string }[] }
  | { kind: 'decline'; reason: 'not_in_data' | 'not_a_data_question'
      | 'unsupported' | 'could_not_plan'; missing?: string; nearest?: string[] }
  | { kind: 'sql'; sql: string; rationale: string };
```

Server behaviour:

- Uses the SDK's structured output with a JSON schema generated from the Zod
  `Plan` schema.
- Validates the reply against the schema and against the digest (every id must
  exist). On failure, one repair call that includes the validation error. If
  that fails, returns `decline` with `could_not_plan`.
- Text from the data (dimension values, labels edited by the user) is placed in
  a clearly delimited block and the instructions say it is data, not
  instructions. Because the reply must validate against the digest, injected
  text cannot make the app run anything outside the dictionary.
- Model id comes from `GEMINI_MODEL`. Choose the current free-tier Flash or
  Flash-Lite model from Google AI Studio in task T53 and record it (Q-02).
  Temperature 0.

### POST /api/polish

Request, 8 KB cap: `{ sentences: { id, text }[] }` where each `text` is a
template sentence that already contains its final numbers. Response:
`{ sentences: { id, text }[] }`. The browser applies the grounding check and
keeps the template for any sentence that fails.

### Keys, limits and abuse

- `GEMINI_API_KEY` lives only in server environment variables. A user may
  supply their own key in Settings; it is kept in `localStorage`, sent as the
  `x-footnote-key` header, used for that request and never logged.
- No key from either source: the route returns `503 { error: 'ai_unavailable' }`
  and the UI shows AI assist as unavailable.
- Requests need a same-origin `Origin` header and JSON content type.
- A per-IP token bucket in memory (best effort across serverless instances):
  10 requests a minute.
- Upstream 429 or 5xx: return `{ error: 'ai_busy' }`. The browser falls back to
  the composer and shows one notice per session.
- Request bodies are never logged.
- The real ceiling is the free-tier quota. The Google project must have no
  billing account, so the worst case for abuse is AI assist switching off until
  the quota resets.

### Call budget

At most 2 planning calls and 1 polish call per question. Identical
`(digest hash, question, previous)` requests are cached in the browser for the
session.

## 8. State and storage

- **Sample workspaces** are static: Parquet and precomputed JSON under
  `public/demo/<id>/`. Their briefing pages are statically rendered.
- **Local workspaces** are stored in IndexedDB: the original file bytes (or an
  OPFS handle where supported), the dictionary with edits, learned synonyms,
  the question thread and the report. Deleting a workspace deletes all of it.
- **UI state** is in a Zustand store per workspace. Nothing about a user's data
  is put in the URL.

## 9. Build-time precompute

`scripts/precompute.ts` runs core with the Node adapter over each sample
dataset and writes `profile.json`, `model.json`, `health.json` and
`briefing.json` to `public/demo/<id>/`. It runs in `npm run build`. An
end-to-end test recomputes one briefing in the browser and compares it with
the precomputed file, which doubles as a whole-system parity check.

## 10. Security and privacy details

- Content Security Policy: scripts from self plus `'wasm-unsafe-eval'`,
  workers from self and `blob:`, connections to self only (plus jsDelivr only
  if Q-01 resolves that way). No inline scripts beyond what Next requires.
- Text from files (column names, values) is rendered as text, never as HTML.
- `.env*` files are never committed. `.env.example` lists variable names only.
- No analytics, no tracking, no third-party fonts at run time (fonts are
  self-hosted through `next/font`).

## 11. Testing

| Level | Tool | Covers |
|---|---|---|
| Unit | Vitest | profile, health, inference, compiler, findings, narrative, resolver |
| Property | fast-check | compiler never emits unknown identifiers; decompositions sum to the total; grounding check |
| Integration | Vitest with the Node adapter | compile, run, check on the sample data |
| Parity | Vitest and Playwright | both adapters agree |
| End-to-end | Playwright | first load, file upload, ask, working paper, report export, AI off and on (mocked) |
| Visual | `npm run shots` | screenshots at three widths in both themes, reviewed by eye |
| Evals | `eval/runner` | answer correctness and behaviour, see `evals.md` |

## 12. Scripts every task can rely on

Defined in T01 and extended by later tasks. Keep the names stable.

| Command | Does |
|---|---|
| `npm run dev` | local dev server |
| `npm run check` | lint, type check and unit tests. Must pass before every commit |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run shots -- <route> [...]` | screenshots to `.screens/` at 390, 834 and 1440 px, light and dark |
| `npm run data:generate` | regenerate sample datasets and truth files |
| `npm run precompute` | rebuild `public/demo/*` JSON |
| `npm run eval -- --mode <keyless\|ai\|baseline> [--set dev\|holdout] [--live]` | run evals |
| `npm run build` | precompute, then production build |

## 13. Environments

- Local: `.env.local` with optional `GEMINI_API_KEY` and `GEMINI_MODEL`.
- CI: no secrets. Runs `check`, `build`, and evals in keyless and replay modes.
- Production: Vercel, `main` branch. Optional `GEMINI_API_KEY`,
  `GEMINI_MODEL`.
