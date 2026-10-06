# T03 The query engine port

## What it does

Footnote runs every query on DuckDB: DuckDB-WASM in a Web Worker in the
browser, `@duckdb/node-api` in Node (evals, precompute, tests). Both sit
behind one interface, `QueryEngine`, and return results in the same shape.

## Why it is built this way

Calling each library directly fails because they return the same value in
different forms. `BIGINT` is a `bigint` in Node. `DECIMAL` is a number in
Node but four 32-bit words in the browser. `DATE` is a `Date` in one and
milliseconds in the other. Code written against one breaks on the other.

So each adapter converts values at the boundary, through shared helpers in
`src/core/engine/normalise.ts`, into one `Cell`: number, string, boolean or
null. A parity suite of 55 SQL statements runs on both engines, and the
outputs must match exactly.

The site serves the browser files itself. It also hosts the Parquet and JSON
extensions and loads them at start; otherwise DuckDB fetches them from
duckdb.org on first use, and offline loading breaks.

## Worked example

The parity fixture's `big_id` column holds 60 `BIGINT`s near 2^53.
`SELECT SUM(big_id) FROM fx` returns a `HUGEINT`. Node gives the `bigint`
540431955283830000n. The browser gives Arrow `Decimal(38,0)` words, which
the adapter decodes to the same `bigint`. Both go through `cellFromBigInt`.
The value is above `Number.MAX_SAFE_INTEGER` (9007199254740991), so it
becomes the string `"540431955283830000"`, not a rounded number.

## Interview questions

1. *Why not make everything a number?* Above 2^53, digits are lost silently.
2. *How do you know the engines agree?* Vitest writes
   `tests/parity/expected.json` from Node. Playwright runs the same
   statements in Chromium and compares each result with that file. A value
   changed on purpose in the file made the browser test fail.
3. *What happens with no network?* A test loads the page, cuts the network,
   then loads a CSV, a Parquet and a JSON file. No request is made, and
   nothing before that left the site.

## Known limits

- Timestamps keep milliseconds; microseconds are dropped.
- Engines differ: DuckDB 1.5.4 (browser), 1.5.6 (Node). Parity guards it.
- In the browser, a `DECIMAL(38,0)` column reads as an integer.
- First use downloads about 36 MB of WASM plus 4 MB of extensions (T72).
