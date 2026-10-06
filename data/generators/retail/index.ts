// Generates data/demo/retail/: orders.parquet and truth.json.

import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { QueryEngine } from '@/core/engine/types';
import { failures, measureAll, queryNumbers, tidy } from '../truth';
import { contentHash, writeParquet, type ColumnSpec } from '../write';
import { generateRetail } from './generate';
import * as P from './params';
import { RETAIL_EFFECTS, SUMMARY_CHECKS, summarySql } from './truth';

export const RETAIL_COLUMNS: ColumnSpec[] = [
  { name: 'order_id', sqlType: 'VARCHAR' },
  { name: 'order_date', sqlType: 'DATE' },
  { name: 'region', sqlType: 'VARCHAR' },
  { name: 'channel', sqlType: 'VARCHAR' },
  { name: 'category', sqlType: 'VARCHAR' },
  { name: 'sub_category', sqlType: 'VARCHAR' },
  { name: 'customer_id', sqlType: 'VARCHAR' },
  { name: 'customer_segment', sqlType: 'VARCHAR' },
  { name: 'quantity', sqlType: 'INTEGER' },
  { name: 'unit_price', sqlType: 'DECIMAL(10,2)' },
  { name: 'discount_pct', sqlType: 'INTEGER' },
  { name: 'revenue', sqlType: 'DECIMAL(12,2)' },
  { name: 'cost', sqlType: 'DECIMAL(12,2)' },
  { name: 'returned', sqlType: 'BOOLEAN' },
];

/** Measures the planted effects in the `orders` table of `engine`. */
export async function retailTruth(engine: QueryEngine) {
  const q = queryNumbers(engine);
  const [summary] = await q(summarySql);
  return {
    dataset: 'retail',
    name: 'Harbour & Pine',
    synthetic: true,
    seed: P.SEED,
    table: 'orders',
    contentHash: await contentHash(engine, 'orders'),
    summary: Object.fromEntries(
      SUMMARY_CHECKS.map((c) => [
        c.key,
        { label: c.label, min: c.min, max: c.max, realised: tidy(summary[c.key]) },
      ]),
    ),
    effects: await measureAll(RETAIL_EFFECTS, q),
  };
}

export function summaryFailures(
  summary: Record<string, { min?: number; max?: number; realised: number }>,
): string[] {
  return Object.entries(summary)
    .filter(
      ([, s]) =>
        (s.min !== undefined && s.realised < s.min) || (s.max !== undefined && s.realised > s.max),
    )
    .map(([key, s]) => `summary ${key} = ${s.realised}, expected [${s.min ?? ''}, ${s.max ?? ''}]`);
}

export async function generateRetailDemo(engine: QueryEngine, outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const parquetPath = join(outDir, 'orders.parquet');
  const rows = generateRetail(P.SEED);
  await writeParquet(
    engine,
    'orders',
    rows as unknown as Record<string, unknown>[],
    RETAIL_COLUMNS,
    parquetPath,
  );
  const truth = await retailTruth(engine);
  await writeFile(join(outDir, 'truth.json'), JSON.stringify(truth, null, 2) + '\n');
  const { size } = await stat(parquetPath);
  return [
    `retail: ${truth.summary.rows.realised} rows, ${(size / 1024 / 1024).toFixed(2)} MB, hash ${truth.contentHash.slice(0, 16)}`,
    ...summaryFailures(truth.summary).map((f) => `  out of range: ${f}`),
    ...failures(truth.effects).map((f) => `  out of range: ${f}`),
  ];
}
