// The checks every sample dataset must pass (steps.md T04 and T05): same seed
// gives the same rows, the committed Parquet matches a fresh run, the file is
// under 3 MB, truth.json is what the data says, and every effect is in range.

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { demoTruth, type DemoSpec } from './demo';
import { failures, summaryFailures, type SummaryValue, type TruthEffect } from './truth';
import { contentHash, writeParquet } from './write';

export interface CommittedTruth {
  contentHash: string;
  summary: Record<string, SummaryValue>;
  effects: TruthEffect[];
}

/** Registers the shared tests inside a `describe`; returns a getter for the loaded engine. */
export function demoSuite(
  spec: DemoSpec,
  briefing: string[],
): { truth: CommittedTruth; engine: () => QueryEngine } {
  const dir = join(import.meta.dirname, '..', 'demo', spec.id);
  const parquetPath = join(dir, `${spec.table}.parquet`);
  const truth = JSON.parse(readFileSync(join(dir, 'truth.json'), 'utf8')) as CommittedTruth;
  let engine: QueryEngine;

  beforeAll(async () => {
    engine = await createNodeEngine();
    await engine.registerFile(spec.table, { kind: 'path', path: parquetPath, format: 'parquet' });
  });

  afterAll(async () => {
    await engine.close();
  });

  it('gives identical rows from the same seed', () => {
    const hash = () => createHash('sha256').update(JSON.stringify(spec.rows())).digest('hex');
    expect(hash()).toBe(hash());
  });

  it('matches the committed Parquet when generated again', async () => {
    const other = await createNodeEngine();
    const tmp = await mkdtemp(join(tmpdir(), `footnote-${spec.id}-`));
    try {
      await writeParquet(
        other,
        spec.table,
        spec.rows(),
        spec.columns,
        join(tmp, `${spec.table}.parquet`),
      );
      expect(await contentHash(other, spec.table)).toBe(truth.contentHash);
    } finally {
      await other.close();
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it('keeps the Parquet file under 3 MB', () => {
    expect(statSync(parquetPath).size).toBeLessThan(3 * 1024 * 1024);
  });

  it('has a truth file whose realised values come from the data', async () => {
    const measured = await demoTruth(engine, spec);
    expect(measured.contentHash).toBe(truth.contentHash);
    expect(measured.summary).toEqual(truth.summary);
    expect(measured.effects).toEqual(truth.effects);
  });

  it('realises every planted effect inside the range the spec gives', () => {
    expect(summaryFailures(truth.summary)).toEqual([]);
    expect(failures(truth.effects)).toEqual([]);
    expect(truth.effects.map((e) => e.id)).toEqual(spec.effects.map((e) => e.id));
  });

  it('marks the effects the spec expects in the default briefing', () => {
    expect(truth.effects.filter((e) => e.briefing).map((e) => e.id)).toEqual(briefing);
  });

  return { truth, engine: () => engine };
}
