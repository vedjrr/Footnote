// The golden questions (evals.md §3): the counts per category, dataset and
// split are right, the quotas hold, every reference SQL runs on its sample
// and returns rows, and no two questions say nearly the same thing.

import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { createNodeEngine } from '@/adapters/duckdb-node';
import type { QueryEngine } from '@/core/engine/types';
import { parseModelYaml } from '@/core/model/yaml';
import {
  CATEGORIES,
  type Category,
  DATASETS,
  type Dataset,
  type LoadedGolden,
  loadGoldens,
} from '../../eval/runner/goldens';

const TABLES: Record<Dataset, string> = {
  retail: 'orders',
  saas: 'subscriptions',
  support: 'tickets',
};

// evals.md §3: 80 questions, 32 retail, 26 subscriptions, 22 support.
const PER_DATASET: Record<Dataset, number> = { retail: 32, saas: 26, support: 22 };
const PER_CATEGORY: Record<Category, number> = {
  single: 10,
  ranking: 12,
  trend: 10,
  comparison: 10,
  ratio: 10,
  filters: 8,
  conditions: 6,
  change: 6,
  ambiguous: 4,
  unanswerable: 4,
};
const EXPECT: Partial<Record<Category, string>> = {
  change: 'change',
  ambiguous: 'clarify',
  unanswerable: 'decline',
};

const goldens = loadGoldens();
const engines = new Map<Dataset, QueryEngine>();

beforeAll(async () => {
  for (const d of DATASETS) {
    const engine = await createNodeEngine();
    await engine.registerFile(TABLES[d], {
      kind: 'path',
      format: 'parquet',
      path: `data/demo/${d}/${TABLES[d]}.parquet`,
    });
    engines.set(d, engine);
  }
}, 60_000);

afterAll(async () => {
  for (const e of engines.values()) await e.close();
});

function count<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const out = new Map<string, number>();
  for (const t of items) out.set(key(t), (out.get(key(t)) ?? 0) + 1);
  return out;
}

describe('counts', () => {
  test('80 questions with unique ids, numbered 1 to N per dataset', () => {
    expect(goldens).toHaveLength(80);
    expect(new Set(goldens.map((g) => g.id)).size).toBe(80);
    for (const d of DATASETS) {
      const numbers = goldens
        .filter((g) => g.dataset === d)
        .map((g) => Number(g.id.slice(-3)))
        .sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: PER_DATASET[d] }, (_, i) => i + 1));
    }
  });

  test('per dataset and per category, as in evals §3', () => {
    expect(Object.fromEntries(count(goldens, (g) => g.dataset))).toEqual(PER_DATASET);
    expect(Object.fromEntries(count(goldens, (g) => g.category))).toEqual(PER_CATEGORY);
  });

  test('50 dev and 30 holdout, every category in both', () => {
    expect(goldens.filter((g) => g.split === 'dev')).toHaveLength(50);
    expect(goldens.filter((g) => g.split === 'holdout')).toHaveLength(30);
    for (const c of CATEGORIES) {
      for (const s of ['dev', 'holdout'] as const) {
        expect(
          goldens.some((g) => g.category === c && g.split === s),
          `${c} in ${s}`,
        ).toBe(true);
      }
    }
  });

  test('every dataset appears in both splits', () => {
    for (const d of DATASETS) {
      for (const s of ['dev', 'holdout'] as const) {
        expect(goldens.some((g) => g.dataset === d && g.split === s)).toBe(true);
      }
    }
  });

  test('at least six snapshot questions and four ratio-from-totals questions', () => {
    const tagged = (t: string) => goldens.filter((g) => g.tags?.includes(t as never));
    expect(tagged('snapshot').length).toBeGreaterThanOrEqual(6);
    expect(tagged('ratio').length).toBeGreaterThanOrEqual(4);
    // A snapshot question only makes sense on the snapshot table.
    for (const g of tagged('snapshot')) expect(g.dataset, g.id).toBe('saas');
  });

  test('each category carries the expected outcome', () => {
    for (const g of goldens) expect(g.expect, g.id).toBe(EXPECT[g.category] ?? 'answer');
  });
});

describe('references', () => {
  test('change questions name an effect in their truth.json', () => {
    for (const g of goldens) {
      if (g.expect !== 'change') continue;
      const truth = JSON.parse(readFileSync(`data/demo/${g.dataset}/truth.json`, 'utf8')) as {
        effects: { id: string }[];
      };
      expect(
        truth.effects.map((e) => e.id),
        g.id,
      ).toContain(g.truth);
    }
  });

  test('clarify options are metrics in the dictionary, and the term is in the question', () => {
    for (const g of goldens) {
      if (g.expect !== 'clarify') continue;
      const parsed = parseModelYaml(readFileSync(`data/demo/${g.dataset}/dictionary.yaml`, 'utf8'));
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems));
      const ids = parsed.model.metrics.map((m) => m.id);
      for (const a of g.acceptable) expect(ids, `${g.id}: ${a}`).toContain(a);
      expect(g.question.toLowerCase(), g.id).toContain(g.term.toLowerCase());
    }
  });

  test('ordered answers sort in SQL; a limit always comes with a sort', () => {
    for (const g of goldens) {
      if (g.expect !== 'answer') continue;
      const sql = g.reference_sql.toUpperCase();
      if (g.ordered) expect(sql, g.id).toContain('ORDER BY');
      if (sql.includes('LIMIT')) expect(sql, g.id).toContain('ORDER BY');
    }
  });

  test('every reference SQL runs on its sample and returns rows with values', async () => {
    const answers = goldens.filter(
      (g): g is Extract<LoadedGolden, { expect: 'answer' }> => g.expect === 'answer',
    );
    expect(answers.length).toBe(80 - 6 - 4 - 4);
    for (const g of answers) {
      const result = await engines.get(g.dataset)!.query(g.reference_sql);
      expect(result.rowCount, g.id).toBeGreaterThan(0);
      // No column is empty on every row: that would be a filter on a value
      // that does not exist, which compares equal to any other empty answer.
      result.columns.forEach((c, i) => {
        expect(
          result.rows.some((r) => r[i] !== null),
          `${g.id}: ${c.name}`,
        ).toBe(true);
      });
      // A ranking cut by LIMIT must not cut through a tie.
      const limit = /LIMIT\s+(\d+)/i.exec(g.reference_sql);
      if (limit) {
        const all = await engines
          .get(g.dataset)!
          .query(g.reference_sql.replace(/LIMIT\s+\d+/i, ''));
        const n = Number(limit[1]);
        if (all.rowCount > n) {
          const last = result.columns.length - 1;
          expect(all.rows[n][last], `${g.id}: tie at the cut`).not.toEqual(all.rows[n - 1][last]);
        }
      }
    }
  }, 60_000);
});

// Word sets after lower-casing and dropping a few words that carry no
// meaning here. Two questions sharing 70% or more of their words are too
// close to count as separate tests.
const STOP = new Set([
  'the',
  'a',
  'an',
  'in',
  'of',
  'for',
  'by',
  'what',
  'was',
  'our',
  'we',
  'did',
]);
function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w)),
  );
}
function jaccard(a: Set<string>, b: Set<string>): number {
  let both = 0;
  for (const w of a) if (b.has(w)) both++;
  return both / (a.size + b.size - both);
}

describe('wording', () => {
  test('no two questions are near-duplicates', () => {
    const sets = goldens.map((g) => ({ id: g.id, w: words(g.question) }));
    const close: string[] = [];
    for (let i = 0; i < sets.length; i++) {
      for (let j = i + 1; j < sets.length; j++) {
        const s = jaccard(sets[i].w, sets[j].w);
        if (s >= 0.7) close.push(`${sets[i].id} ~ ${sets[j].id} (${s.toFixed(2)})`);
      }
    }
    expect(close).toEqual([]);
  });

  test('no two answer questions share the same reference SQL', () => {
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const sqls = goldens.flatMap((g) => (g.expect === 'answer' ? [norm(g.reference_sql)] : []));
    expect(new Set(sqls).size).toBe(sqls.length);
  });
});
