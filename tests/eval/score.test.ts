// The scorer (evals.md §4): columns matched by values, row order, the
// tolerances, text normalisation, and every outcome label.

import { describe, expect, test } from 'vitest';
import type { Cell, QueryResult } from '@/core/engine/types';
import type { Golden } from '../../eval/runner/goldens';
import { type Outcome, type Scored, headline, matchResult, score } from '../../eval/runner/score';

function result(names: string[], rows: Cell[][]): QueryResult {
  return {
    columns: names.map((name) => ({ name, type: 'text', nullable: true })),
    rows,
    rowCount: rows.length,
    elapsedMs: 0,
  };
}

const reference = result(
  ['category', 'revenue'],
  [
    ['Electronics', 1200.5],
    ['Kitchen', 830],
    ['Garden', 410.25],
  ],
);

const label = (ref: QueryResult, got: QueryResult, ordered = false) =>
  matchResult(ref, got, ordered).label;

describe('columns', () => {
  test('names are ignored and extra result columns are allowed, in any position', () => {
    const got = result(
      ['revenue__change', 'sum_rev', 'cat'],
      [
        [0.1, 1200.5, 'Electronics'],
        [0.2, 830, 'Kitchen'],
        [0.3, 410.25, 'Garden'],
      ],
    );
    expect(label(reference, got)).toBe('correct');
  });

  test('a reference column with no matching result column is wrong', () => {
    const got = result(['category'], [['Electronics'], ['Kitchen'], ['Garden']]);
    const s = matchResult(reference, got, false);
    expect(s.label).toBe('wrong');
    expect(s.reason).toContain('revenue');
  });

  test('columns with the same values but paired differently across rows are told apart', () => {
    const ref = result(
      ['k', 'v'],
      [
        ['A', 1],
        ['B', 2],
      ],
    );
    // Both numeric columns hold {1, 2}; only the last pairs them as the reference does.
    const got = result(
      ['k', 'decoy', 'v'],
      [
        ['A', 2, 1],
        ['B', 1, 2],
      ],
    );
    expect(label(ref, got)).toBe('correct');
    const decoyOnly = result(
      ['k', 'decoy'],
      [
        ['A', 2],
        ['B', 1],
      ],
    );
    expect(label(ref, decoyOnly)).toBe('wrong');
  });

  test('one result column cannot stand in for two reference columns that pair differently', () => {
    const ref = result(
      ['a', 'b'],
      [
        [1, 2],
        [2, 1],
      ],
    );
    expect(label(ref, result(['x'], [[1], [2]]))).toBe('wrong');
  });
});

describe('rows', () => {
  const shuffled = result(
    ['category', 'revenue'],
    [
      ['Garden', 410.25],
      ['Electronics', 1200.5],
      ['Kitchen', 830],
    ],
  );

  test('compared as a set unless the order is part of the answer', () => {
    expect(label(reference, shuffled, false)).toBe('correct');
    expect(label(reference, shuffled, true)).toBe('wrong');
    expect(label(reference, reference, true)).toBe('correct');
  });

  test('a different number of rows is wrong, even when every row present matches', () => {
    const fewer = result(['category', 'revenue'], reference.rows.slice(0, 2));
    expect(matchResult(reference, fewer, false)).toEqual({
      label: 'wrong',
      reason: '2 rows, expected 3',
    });
    const more = result(['category', 'revenue'], [...reference.rows, ['Toys', 1]]);
    expect(label(reference, more)).toBe('wrong');
  });

  test('a duplicated row does not stand in for a missing one', () => {
    const ref = result(['v'], [[1], [2]]);
    expect(label(ref, result(['v'], [[1], [1]]))).toBe('wrong');
  });

  test('near-equal rows are paired so that every row finds a partner', () => {
    // A first-come pairing gives 1.004 the 1.000 row and leaves 1.000 none.
    const ref = result(['v'], [[1.004], [1.0]]);
    const got = result(['v'], [[1.0], [1.008]]);
    expect(label(ref, got)).toBe('correct');
  });
});

describe('tolerance', () => {
  const one = (v: Cell) => result(['v'], [[v]]);

  test('absolute 0.005', () => {
    expect(label(one(100), one(100.0049))).toBe('correct');
    expect(label(one(100), one(100.0051))).toBe('wrong');
    expect(label(one(0), one(-0.004))).toBe('correct');
  });

  test('relative 1e-6 for large numbers', () => {
    expect(label(one(1_000_000_000), one(1_000_000_999))).toBe('correct');
    expect(label(one(1_000_000_000), one(1_000_001_001))).toBe('wrong');
  });
});

describe('text and empty values', () => {
  const one = (v: Cell) => result(['v'], [[v]]);

  test('trimmed and case-folded', () => {
    expect(label(one('Online West'), one('  online west '))).toBe('correct');
    expect(label(one('Online West'), one('Online-West'))).toBe('wrong');
  });

  test('empty equals empty, and nothing else', () => {
    expect(label(one(null), one(''))).toBe('correct');
    expect(label(one(null), one('   '))).toBe('correct');
    expect(label(one(null), one(0))).toBe('wrong');
    expect(label(one(''), one('none'))).toBe('wrong');
  });

  test('a midnight timestamp is its date, and numeric text is its number', () => {
    expect(label(one('2025-03-01'), one('2025-03-01T00:00:00'))).toBe('correct');
    expect(label(one('2025-03-01'), one('2025-03-01T00:00:00.000'))).toBe('correct');
    expect(label(one('2025-03-01'), one('2025-03-01T12:00:00'))).toBe('wrong');
    expect(label(one(12.5), one('12.50'))).toBe('correct');
    expect(label(one(true), one('TRUE'))).toBe('correct');
  });
});

const answerGolden: Golden = {
  id: 'retail-001',
  category: 'ranking',
  question: 'Revenue by category',
  expect: 'answer',
  reference_sql: 'SELECT 1 AS one',
  ordered: false,
};
const changeGolden: Golden = {
  id: 'retail-002',
  category: 'change',
  question: 'Where did the drop come from?',
  expect: 'change',
  truth: 'R1',
  path: { region: 'West', channel: 'Online' },
};
const clarifyGolden: Golden = {
  id: 'retail-003',
  category: 'ambiguous',
  question: 'How are sales doing?',
  expect: 'clarify',
  term: 'sales',
  acceptable: ['revenue', 'quantity'],
};
const declineGolden: Golden = {
  id: 'retail-004',
  category: 'unanswerable',
  question: 'What is our customer acquisition cost?',
  expect: 'decline',
};

const answer = (r: QueryResult): Outcome => ({
  kind: 'answer',
  via: 'spec',
  sql: 'SELECT',
  result: r,
});
const change = (path: Record<string, string>, share: number | null): Outcome => ({
  kind: 'change',
  via: 'spec',
  path,
  share,
});
const clarify = (term: string, options: string[]): Outcome => ({ kind: 'clarify', term, options });
const decline: Outcome = { kind: 'decline', reason: 'no such data' };

describe('labels', () => {
  test('answer questions', () => {
    expect(score(answerGolden, answer(reference), { reference }).label).toBe('correct');
    const off = result(
      ['c', 'r'],
      [
        ['Electronics', 1200.5],
        ['Kitchen', 831],
        ['Garden', 410.25],
      ],
    );
    expect(score(answerGolden, answer(off), { reference }).label).toBe('wrong');
    expect(score(answerGolden, change({ region: 'West' }, 1), { reference }).label).toBe('wrong');
    expect(score(answerGolden, decline).label).toBe('over-cautious');
    expect(score(answerGolden, clarify('revenue', ['a', 'b'])).label).toBe('over-cautious');
  });

  test('an answer scored with no reference is a harness fault, not a label', () => {
    expect(() => score(answerGolden, answer(reference))).toThrow(/no reference/);
  });

  test('change questions: the path in any order and case, and the share within 5 points', () => {
    const path = { CHANNEL: 'online', region: 'West ' };
    expect(score(changeGolden, change(path, 1.02), { share: 1.0615 }).label).toBe('correct');
    expect(score(changeGolden, change(path, 1.0), { share: 1.0615 }).label).toBe('wrong');
    expect(score(changeGolden, change(path, null), { share: 1.0615 }).label).toBe('wrong');
    // With no realised share recorded, the path alone decides.
    expect(score(changeGolden, change(path, null), { share: null }).label).toBe('correct');
    expect(score(changeGolden, change({ region: 'West' }, 1.06), { share: 1.0615 }).label).toBe(
      'wrong',
    );
    const extra = { region: 'West', channel: 'Online', segment: 'Consumer' };
    expect(score(changeGolden, change(extra, 1.06), { share: 1.0615 }).label).toBe('wrong');
    expect(score(changeGolden, answer(reference)).label).toBe('wrong');
    expect(score(changeGolden, decline).label).toBe('over-cautious');
  });

  test('clarify questions', () => {
    expect(score(clarifyGolden, clarify('Sales', ['Quantity', 'revenue', 'orders'])).label).toBe(
      'correct',
    );
    const missing = score(clarifyGolden, clarify('sales', ['revenue', 'orders']));
    expect(missing).toEqual({ label: 'over-cautious', reason: 'did not offer quantity' });
    expect(score(clarifyGolden, clarify('doing', ['revenue', 'quantity'])).label).toBe(
      'over-cautious',
    );
    expect(score(clarifyGolden, decline).label).toBe('over-cautious');
    expect(score(clarifyGolden, answer(reference)).label).toBe('over-confident');
    expect(score(clarifyGolden, change({ region: 'West' }, 1)).label).toBe('over-confident');
  });

  test('decline questions', () => {
    expect(score(declineGolden, decline).label).toBe('correct');
    expect(score(declineGolden, clarify('cost', ['a', 'b'])).label).toBe('over-cautious');
    expect(score(declineGolden, answer(reference)).label).toBe('over-confident');
  });
});

describe('headline figures', () => {
  const item = (s: Partial<Scored> & Pick<Scored, 'expect' | 'kind' | 'label'>): Scored => ({
    category: 'single',
    via: null,
    modelCalls: 0,
    polish: null,
    ...s,
  });

  test('rates follow §4, with error counted as neither wrong nor covered', () => {
    const items = [
      item({ expect: 'answer', kind: 'answer', via: 'spec', label: 'correct', modelCalls: 1 }),
      item({ expect: 'answer', kind: 'answer', via: 'raw', label: 'wrong', modelCalls: 2 }),
      item({ expect: 'answer', kind: 'decline', label: 'over-cautious' }),
      item({ expect: 'change', kind: 'error', label: 'error' }),
      item({ expect: 'clarify', kind: 'answer', via: 'spec', label: 'over-confident' }),
      item({ expect: 'decline', kind: 'decline', label: 'correct' }),
      item({
        expect: 'answer',
        kind: 'answer',
        via: 'resolver',
        label: 'correct',
        polish: { attempted: 4, rejected: 1 },
      }),
      item({
        expect: 'answer',
        kind: 'clarify',
        label: 'over-cautious',
        polish: { attempted: 0, rejected: 0 },
      }),
    ];
    expect(headline(items)).toEqual({
      questions: 8,
      correct: 3,
      wrong: 1,
      overCautious: 2,
      overConfident: 1,
      error: 1,
      correctRate: 3 / 8,
      wrongAnswerRate: 2 / 8,
      // answer and change questions: 6; of those, 3 got an answer
      coverage: 3 / 6,
      // answers shown: 4, one through raw SQL
      rawSqlShare: 1 / 4,
      groundingRejectionRate: 1 / 4,
      modelCalls: 3,
    });
  });

  test('a run that only declines covers nothing and is never wrong', () => {
    const items = [
      item({ expect: 'answer', kind: 'decline', label: 'over-cautious' }),
      item({ expect: 'decline', kind: 'decline', label: 'correct' }),
    ];
    const h = headline(items);
    expect(h.coverage).toBe(0);
    expect(h.wrongAnswerRate).toBe(0);
    expect(h.rawSqlShare).toBeNull();
    expect(h.groundingRejectionRate).toBeNull();
  });
});
