// Key changes on the three samples (Node adapter, analytics-spec §5.1).
// The planted effects in each sample's final month are flagged, seasonal
// peaks are not, and every number a finding carries is a cell of a query it
// ran.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { keyChanges } from '@/core/findings/changes';
import type { KeyChange } from '@/core/findings/finding';
import { type TimeFacts, readTimeFacts, timeFactsSql } from '@/core/findings/periods';
import type { SemanticModel } from '@/core/model/types';
import { parseModelYaml } from '@/core/model/yaml';

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

async function changes(sample: string, options = {}): Promise<KeyChange[]> {
  const l = loaded.get(sample)!;
  return keyChanges(l.model, l.engine, l.time, options);
}

function find(list: KeyChange[], metric: string): KeyChange {
  const k = list.find((c) => c.metric === metric);
  if (!k) throw new Error(`no key change for ${metric}`);
  return k;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.005, 1e-6 * Math.abs(b));
}

describe('key changes on every sample', () => {
  test.each(SAMPLES.map((s) => s.id))(
    '%s: one finding per metric, highest score first, every fact a cell of a query it ran',
    async (sample) => {
      const list = await changes(sample);
      const { model } = loaded.get(sample)!;
      expect(list.map((k) => k.metric).sort()).toEqual(model.metrics.map((m) => m.id).sort());
      for (let i = 1; i < list.length; i++) {
        expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
      }
      for (const k of list) {
        expect(k.score).toBeGreaterThanOrEqual(0);
        expect(k.score).toBeLessThanOrEqual(1);
        expect(Object.keys(k.facts).sort()).toEqual(
          ['change', 'change_pct', 'current', 'previous'].sort(),
        );
        for (const f of Object.values(k.facts)) {
          const q = k.queries.find((x) => x.id === f.query)!;
          const col = q.compiled.columns.findIndex((c) => c.name === f.cell.column);
          expect(col).toBeGreaterThanOrEqual(0);
          expect(q.result.rows[f.cell.row][col]).toBe(f.value);
        }
        // The series the label is judged on ends on the same value the facts show.
        const series = k.queries.find((x) => x.id === 'series')!;
        const last = series.result.rows[series.result.rows.length - 1];
        expect(String(last[0]).slice(0, 10)).toBe(k.period.current.from);
        expect(close(last[1] as number, k.facts.current.value as number)).toBe(true);
        // The change the assessment holds is the change SQL returned.
        if (k.assessment.change !== null) {
          expect(close(k.assessment.change, k.facts.change.value as number)).toBe(true);
        }
      }
    },
  );
});

describe('retail', () => {
  test('March 2025 revenue is flagged, judged against March last year', async () => {
    const revenue = find(await changes('retail'), 'revenue');
    expect(revenue.period.current).toEqual({ from: '2025-03-01', to: '2025-03-31' });
    expect(revenue.period.previous).toEqual({ from: '2025-02-01', to: '2025-02-28' });
    expect(['larger_than_usual', 'unusually_large']).toContain(revenue.assessment.label);
    expect(revenue.assessment.basis).toBe('seasonal');
    // R1: total revenue falls 6% to 9%.
    const pct = revenue.facts.change_pct.value as number;
    expect(pct).toBeLessThan(-0.06);
    expect(pct).toBeGreaterThan(-0.09);
    expect(revenue.assessment.littleChanged).toBe(false);
  });

  test('a normal December is not flagged as unusual, nor the January fall after it', async () => {
    const december = find(await changes('retail', { offset: 3 }), 'revenue');
    expect(december.period.current.from).toBe('2024-12-01');
    expect(december.assessment.label).toBe('normal');
    const january = find(await changes('retail', { offset: 2 }), 'revenue');
    expect(january.period.current.from).toBe('2025-01-01');
    // About 30% down on December, which is what January always does (R4).
    expect(january.facts.change_pct.value as number).toBeLessThan(-0.2);
    expect(january.assessment.label).toBe('normal');
  });

  test('two complete years is too little history: not assessed', async () => {
    const list = await changes('retail', { grain: 'year' });
    for (const k of list) {
      expect(k.period.current.from).toBe('2024-01-01');
      expect(k.assessment.label).toBe('not_assessed');
      expect(k.assessment.reason).toBe('short_history');
    }
  });
});

describe('subscriptions and support', () => {
  test('S1: December 2024 churn rate is unusually large, in points', async () => {
    const churn = find(await changes('saas'), 'churn_rate');
    expect(churn.period.current.from).toBe('2024-12-01');
    expect(churn.assessment.label).toBe('unusually_large');
    expect(churn.assessment.points).toBe(true);
  });

  test('T1: December 2024 SLA breach rate is unusually large; twelve months is sequential', async () => {
    const breach = find(await changes('support'), 'sla_breach_rate');
    expect(breach.assessment.label).toBe('unusually_large');
    expect(breach.assessment.basis).toBe('sequential');
  });

  test('four quarters is fewer than 8 periods: not assessed', async () => {
    const list = await changes('support', { grain: 'quarter' });
    expect(list.length).toBeGreaterThan(0);
    for (const k of list) expect(k.assessment.reason).toBe('short_history');
  });
});
