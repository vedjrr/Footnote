import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { failures, type TruthEffect } from '../truth';
import { contentHash, writeParquet } from '../write';
import { generateRetail } from './generate';
import { RETAIL_COLUMNS, retailTruth, summaryFailures } from './index';

const dir = join(import.meta.dirname, '..', '..', 'demo', 'retail');
const parquetPath = join(dir, 'orders.parquet');
const truth = JSON.parse(readFileSync(join(dir, 'truth.json'), 'utf8')) as {
  contentHash: string;
  summary: Record<string, { min?: number; max?: number; realised: number }>;
  effects: TruthEffect[];
};

let engine: QueryEngine;

beforeAll(async () => {
  engine = await createNodeEngine();
  await engine.registerFile('orders', { kind: 'path', path: parquetPath, format: 'parquet' });
});

afterAll(async () => {
  await engine.close();
});

describe('retail sample', () => {
  it('gives identical rows from the same seed', () => {
    const hash = () => createHash('sha256').update(JSON.stringify(generateRetail())).digest('hex');
    expect(hash()).toBe(hash());
  });

  it('matches the committed Parquet when generated again', async () => {
    const other = await createNodeEngine();
    const tmp = await mkdtemp(join(tmpdir(), 'footnote-retail-'));
    try {
      await writeParquet(
        other,
        'orders',
        generateRetail() as unknown as Record<string, unknown>[],
        RETAIL_COLUMNS,
        join(tmp, 'orders.parquet'),
      );
      expect(await contentHash(other, 'orders')).toBe(truth.contentHash);
    } finally {
      await other.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('keeps the Parquet file under 3 MB', () => {
    expect(statSync(parquetPath).size).toBeLessThan(3 * 1024 * 1024);
  });

  it('has a truth file whose realised values come from the data', async () => {
    const measured = await retailTruth(engine);
    expect(measured.contentHash).toBe(truth.contentHash);
    expect(measured.summary).toEqual(truth.summary);
    expect(measured.effects).toEqual(truth.effects);
  });

  it('realises every planted effect inside the range the spec gives', () => {
    expect(summaryFailures(truth.summary)).toEqual([]);
    expect(failures(truth.effects)).toEqual([]);
    expect(truth.effects.map((e) => e.id)).toEqual(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']);
  });

  it('expects only the latest-month effect in the default briefing', () => {
    expect(truth.effects.filter((e) => e.briefing).map((e) => e.id)).toEqual(['R1']);
  });
});
