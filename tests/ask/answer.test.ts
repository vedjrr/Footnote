// Answers on the three samples (Node adapter): every starter question runs,
// passes its checks, and writes a sentence whose every number is the
// formatted value of the cell it names. The SQL shown, run on its own as if
// pasted into DuckDB, returns the same result as the statement that ran.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import { type Answer, rowsBehind, runAnswer, SAMPLE_ROWS } from '@/core/ask/answer';
import type { QueryEngine } from '@/core/engine/types';
import { type TimeFacts, readTimeFacts, timeFactsSql } from '@/core/findings/periods';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';
import { formatCompact, formatPercentChange, formatPoints } from '@/core/narrative/format';

const SAMPLES = [
  { id: 'retail', table: 'orders' },
  { id: 'saas', table: 'subscriptions' },
  { id: 'support', table: 'tickets' },
] as const;

interface Loaded {
  engine: QueryEngine;
  model: SemanticModel;
  time: TimeFacts;
}

const loaded = new Map<string, Loaded>();

beforeAll(async () => {
  for (const s of SAMPLES) {
    const engine = await createNodeEngine();
    await engine.registerFile(s.table, {
      kind: 'path',
      format: 'parquet',
      path: `data/demo/${s.id}/${s.table}.parquet`,
    });
    const parsed = parseModelYaml(readFileSync(`data/demo/${s.id}/dictionary.yaml`, 'utf8'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems));
    const model = parsed.model;
    const time = readTimeFacts(await engine.query(timeFactsSql(s.table, model.time!.column)));
    loaded.set(s.id, { engine, model, time });
  }
}, 60_000);

afterAll(async () => {
  for (const l of loaded.values()) await l.engine.close();
});

async function answer(sample: string, question: string, spec: unknown): Promise<Answer> {
  const l = loaded.get(sample)!;
  const outcome = await runAnswer({ ...l, question, spec: spec as never });
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.answer;
}

function sentenceText(a: Answer): string {
  return a.sentence.segments
    .map((s) => (typeof s === 'string' ? s : a.sentence.facts[s.fact].text))
    .join('');
}

/** What a fact's text must be, from its cell, by the column's kind. */
function expectedTexts(a: Answer, model: SemanticModel, row: number, column: string): string[] {
  const col = a.compiled.columns.find((c) => c.name === column)!;
  const i = a.compiled.columns.indexOf(col);
  const v = a.result.rows[row][i] as number;
  const m = model.metrics.find((x) => x.id === col.ref)!;
  if (col.kind === 'change_pct') return [formatPercentChange(Math.abs(v))];
  if (col.kind === 'change')
    return [formatPoints(Math.abs(v)), formatCompact(Math.abs(v), m.format)];
  return [formatCompact(v, m.format)];
}

describe.each(SAMPLES.map((s) => s.id))('%s starters', (sample) => {
  test('each runs, passes, and links every number to its cell', async () => {
    const { engine, model } = loaded.get(sample)!;
    expect(model.starters.length).toBe(3);
    for (const starter of model.starters) {
      const a = await answer(sample, starter.label, starter.spec);
      expect(a.problem, starter.label).toBeNull();
      expect(a.sentence.facts.length, starter.label).toBeGreaterThan(0);
      const text = sentenceText(a);
      console.log(`${sample}: ${starter.label}\n  ${text}`);
      expect(text).not.toMatch(/because|due to|caused|led to|thanks to|as a result/i);

      for (const f of a.sentence.facts) {
        const names = a.compiled.columns.map((c) => c.name);
        expect(names).toContain(f.cell.column);
        expect(f.cell.row).toBeLessThan(a.result.rowCount);
        expect(expectedTexts(a, model, f.cell.row, f.cell.column)).toContain(f.text);
      }

      // Pasted into DuckDB: the display SQL with no parameters.
      const pasted = await engine.query(a.compiled.displaySql);
      expect(pasted.rows).toEqual(a.result.rows);
      expect(pasted.columns.map((c) => c.name)).toEqual(a.result.columns.map((c) => c.name));
    }
  });
});

test('a filter value that does not exist fails C3 and leaves no sentence', async () => {
  const a = await answer('retail', 'Revenue in the Nrth', {
    metrics: ['revenue'],
    filters: [{ dimension: 'region', op: 'in', values: ['Nrth'] }],
  });
  expect(a.problem?.id).toBe('C3');
  expect(a.problem?.sentence).toContain('"North"');
  expect(a.sentence.facts).toEqual([]);
  expect(a.sentence.segments).toEqual([]);
});

test('an unknown metric is an error, not an answer', async () => {
  const outcome = await runAnswer({
    ...loaded.get('retail')!,
    question: 'Weather',
    spec: { metrics: ['weather'] },
  });
  expect(outcome).toMatchObject({
    ok: false,
    message: '"weather" is not a metric in the dictionary',
  });
});

test('a comparison sentence names the change, the previous and the current value', async () => {
  const a = await answer('retail', 'Revenue last month', {
    metrics: ['revenue'],
    time: { range: { kind: 'period', grain: 'month', offset: 0 } },
    compare: 'previous_period',
  });
  expect(a.sentence.facts.map((f) => f.cell.column)).toEqual([
    'revenue__change_pct',
    'revenue__previous',
    'revenue',
  ]);
  expect(sentenceText(a)).toMatch(
    /^Revenue (rose|fell) [\d.]+% in March 2025 against February 2025, from /,
  );
  expect(a.sentence.facts[1].title).toBe('Revenue, February 2025');
  expect(a.sentence.facts[0].title).toBe('Change in revenue, March 2025 against February 2025');
});

test('the rows behind a cell add up to it', async () => {
  const { engine, model } = loaded.get('retail')!;
  const starter = model.starters[1]; // revenue by category, last month against the one before
  const a = await answer('retail', starter.label, starter.spec);
  const f = a.sentence.facts.find((x) => x.cell.column === 'revenue')!;
  const rows = rowsBehind(a, model, f.cell.row, f.cell.column);

  const sample = await engine.query(rows.sample.sql, rows.sample.params);
  expect(sample.rowCount).toBe(SAMPLE_ROWS);
  expect(sample.columns.map((c) => c.name).filter((n) => n.startsWith('_'))).toEqual([]);
  expect(await engine.query(rows.sample.display)).toEqual(
    expect.objectContaining({ rows: sample.rows }),
  );

  const count = await engine.query(rows.count.sql, rows.count.params);
  expect(Number(count.rows[0][0])).toBeGreaterThan(SAMPLE_ROWS);
  const sum = await engine.query(
    rows.count.sql.replace('CAST(count(*) AS BIGINT) AS n', 'sum("revenue") AS s'),
    rows.count.params,
  );
  const cell = a.result.rows[f.cell.row][a.compiled.columns.findIndex((c) => c.name === 'revenue')];
  expect(Number(sum.rows[0][0])).toBeCloseTo(Number(cell), 6);

  const prev = a.sentence.facts.find((x) => x.cell.column === 'revenue__previous')!;
  const before = rowsBehind(a, model, prev.cell.row, prev.cell.column);
  const prevSum = await engine.query(
    before.count.sql.replace('CAST(count(*) AS BIGINT) AS n', 'sum("revenue") AS s'),
    before.count.params,
  );
  const prevCell =
    a.result.rows[prev.cell.row][
      a.compiled.columns.findIndex((c) => c.name === 'revenue__previous')
    ];
  expect(Number(prevSum.rows[0][0])).toBeCloseTo(Number(prevCell), 6);
});
