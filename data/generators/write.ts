// Writes generated rows to Parquet through the Node query engine, and hashes
// a table's content in a way that does not depend on row order.

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { QueryEngine } from '@/core/engine/types';

export interface ColumnSpec {
  name: string;
  sqlType: string;
}

const quote = (name: string): string => `"${name.replaceAll('"', '""')}"`;
const literal = (text: string): string => `'${text.replaceAll("'", "''")}'`;

/**
 * Loads `rows` into `table` with the given column types, in the given order,
 * then copies the table to `outPath` as Parquet.
 */
export async function writeParquet(
  engine: QueryEngine,
  table: string,
  rows: readonly Record<string, unknown>[],
  columns: readonly ColumnSpec[],
  outPath: string,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'footnote-data-'));
  try {
    const jsonPath = join(dir, `${table}.json`);
    const lines = rows.map((row, seq) => JSON.stringify({ __seq: seq, ...row }));
    await writeFile(jsonPath, lines.join('\n'));
    const types = columns.map((c) => `${literal(c.name)}: ${literal(c.sqlType)}`).join(', ');
    const select = columns.map((c) => quote(c.name)).join(', ');
    await engine.query(
      `CREATE OR REPLACE TABLE ${quote(table)} AS SELECT ${select} FROM read_json(${literal(jsonPath)}, ` +
        `format = 'newline_delimited', columns = {'__seq': 'INTEGER', ${types}}) ORDER BY __seq`,
    );
    await engine.query(
      `COPY ${quote(table)} TO ${literal(outPath)} (FORMAT parquet, COMPRESSION zstd)`,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** sha256 over every row as text, sorted, so row order does not matter. */
export async function contentHash(engine: QueryEngine, table: string): Promise<string> {
  const result = await engine.query(
    `SELECT sha256(string_agg(CAST(t AS VARCHAR), chr(10) ORDER BY CAST(t AS VARCHAR))) FROM ${quote(table)} t`,
  );
  return String(result.rows[0][0]);
}
