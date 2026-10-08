import { describe, expect, test } from 'vitest';
import { semanticModelSchema } from './types';
import { modelToYaml, parseModelYaml } from './yaml';

const VALID = `table: orders
version: 1
time: null
metrics:
  - kind: simple
    id: rows
    label: Rows
    column: null
    agg: count
    format: { style: number }
    direction: higher_better
    importance: 0.7
  - kind: simple
    id: revenue
    label: Revenue
    column: revenue
    agg: sum
    format: { style: currency, unit: GBP }
    direction: higher_better
    importance: 1
  - kind: ratio
    id: revenue_per_row
    label: Revenue per row
    numerator: revenue
    denominator: rows
    format: { style: currency }
    direction: higher_better
    importance: 0.4
dimensions:
  - id: region
    label: Region
    column: region
    role: category
    distinct: 4
    private: false
`;

describe('parseModelYaml', () => {
  test('reads a valid dictionary and fills defaults', () => {
    const result = parseModelYaml(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.metrics[1]).toMatchObject({ overTime: 'sum', synonyms: [] });
    expect(result.model.hidden).toEqual([]);
    expect(result.model.starters).toEqual([]);
  });

  test('round-trips through YAML unchanged', () => {
    const result = parseModelYaml(VALID);
    if (!result.ok) throw new Error('invalid');
    const again = parseModelYaml(modelToYaml(result.model));
    expect(again).toEqual(result);
  });

  test('broken YAML reports the line it is on', () => {
    const result = parseModelYaml('table: orders\nmetrics:\n  - id: [unclosed\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems[0].line).toBeGreaterThanOrEqual(3);
    expect(result.problems[0].path).toBe('');
    expect(result.problems[0].message).not.toMatch(/at line/);
  });

  test('a wrong value reports its own line and path', () => {
    const text = VALID.replace('agg: sum', 'agg: total');
    const result = parseModelYaml(text);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const line = text.split('\n').findIndex((l) => l.includes('agg: total')) + 1;
    expect(result.problems).toEqual([expect.objectContaining({ line, path: 'metrics.1.agg' })]);
  });

  test('a missing key is reported on the line of the item that lacks it', () => {
    const text = VALID.replace('    importance: 1\n', '');
    const result = parseModelYaml(text);
    if (result.ok) throw new Error('should fail');
    const line = text.split('\n').findIndex((l) => l.includes('id: revenue')) - 0;
    expect(result.problems[0]).toMatchObject({ path: 'metrics.1.importance', line });
  });
});

describe('references between parts', () => {
  const base = () => {
    const r = parseModelYaml(VALID);
    if (!r.ok) throw new Error('invalid');
    return structuredClone(r.model);
  };
  const messages = (model: unknown) => {
    const r = semanticModelSchema.safeParse(model);
    return r.success ? [] : r.error.issues.map((i) => i.message);
  };

  test('a ratio must name metrics that exist', () => {
    const m = base();
    Object.assign(m.metrics[2], { denominator: 'orders' });
    expect(messages(m)).toEqual(['"orders" is not a metric id']);
  });

  test('ids are unique', () => {
    const m = base();
    m.metrics[1].id = 'rows';
    expect(messages(m)).toContain('The metric id "rows" is used twice');
  });

  test('a metric cannot be built from itself', () => {
    const m = base();
    Object.assign(m.metrics[2], { numerator: 'revenue_per_row' });
    expect(messages(m)).toContain('The metric "revenue_per_row" is built from itself');
  });

  test('filters name dimensions that exist, and only counts have no column', () => {
    const m = base();
    Object.assign(m.metrics[0], { where: [{ dimension: 'colour', op: 'in', values: ['red'] }] });
    Object.assign(m.metrics[1], { column: null });
    expect(messages(m)).toEqual([
      '"colour" is not a dimension id',
      'Only a count of rows can have no column',
    ]);
  });

  test('unknown keys are refused, so a typo is not silently ignored', () => {
    const m = base() as Record<string, unknown>;
    m.metircs = [];
    expect(messages(m).length).toBe(1);
  });
});
