// Scoring (evals.md §4): what an answerer may reply, whether a reply is
// correct for its golden, the outcome label, and the headline figures.
// Pure functions: the runner supplies the reference result, run at eval time.

import type { Cell, QueryResult } from '@/core/engine/types';
import type { Category, Golden } from './goldens';

/** How an answer was reached: the resolver, a spec from the planner, or raw SQL. */
export type Via = 'resolver' | 'spec' | 'raw';

export type Outcome =
  | { kind: 'answer'; via: Via; sql: string; result: QueryResult }
  | {
      kind: 'change';
      via: Via;
      /** The segment the change came from, dimension id to value. */
      path: Record<string, string>;
      /** The segment's share of the change, 1 = all of it; null if not reported. */
      share: number | null;
    }
  | { kind: 'clarify'; term: string; options: string[] }
  | { kind: 'decline'; reason: string };

export const LABELS = ['correct', 'wrong', 'over-cautious', 'over-confident', 'error'] as const;
export type Label = (typeof LABELS)[number];

export interface Score {
  label: Label;
  /** Why it is not correct, in a few words; null when correct. */
  reason: string | null;
}

// §4: numbers within relative 1e-6 or absolute 0.005.
export const RELATIVE_TOLERANCE = 1e-6;
export const ABSOLUTE_TOLERANCE = 0.005;
// §4: a change's reported share within 5 points of the realised share.
export const SHARE_TOLERANCE = 0.05;

type Norm = { t: 'empty' } | { t: 'num'; v: number } | { t: 'text'; v: string };

const NUMBER = /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i;
const MIDNIGHT = /^(\d{4}-\d{2}-\d{2})[T ]00:00:00(\.0+)?$/;

/**
 * Text is trimmed and case-folded; null and blank text are both empty. A
 * timestamp at midnight is its date, and text that is a plain number is that
 * number, so a period or a value is not marked wrong for its type alone.
 */
export function normalise(cell: Cell): Norm {
  if (cell === null) return { t: 'empty' };
  if (typeof cell === 'number') return { t: 'num', v: cell };
  if (typeof cell === 'boolean') return { t: 'text', v: String(cell) };
  const text = cell.trim();
  if (text === '') return { t: 'empty' };
  if (NUMBER.test(text)) return { t: 'num', v: Number(text) };
  const midnight = MIDNIGHT.exec(text);
  return { t: 'text', v: (midnight ? midnight[1] : text).toLowerCase() };
}

export function numbersMatch(a: number, b: number): boolean {
  if (a === b) return true;
  const diff = Math.abs(a - b);
  return (
    diff <= ABSOLUTE_TOLERANCE || diff <= RELATIVE_TOLERANCE * Math.max(Math.abs(a), Math.abs(b))
  );
}

function same(a: Norm, b: Norm): boolean {
  if (a.t === 'num' && b.t === 'num') return numbersMatch(a.v, b.v);
  if (a.t === 'text' && b.t === 'text') return a.v === b.v;
  return a.t === 'empty' && b.t === 'empty';
}

// Orders values so that a column compared as a multiset can be compared
// pairwise after sorting: empties, then numbers, then text.
function compare(a: Norm, b: Norm): number {
  const rank = { empty: 0, num: 1, text: 2 };
  if (a.t !== b.t) return rank[a.t] - rank[b.t];
  if (a.t === 'num' && b.t === 'num') return a.v - b.v;
  if (a.t === 'text' && b.t === 'text') return a.v < b.v ? -1 : a.v > b.v ? 1 : 0;
  return 0;
}

function sameValues(a: Norm[], b: Norm[], ordered: boolean): boolean {
  const x = ordered ? a : [...a].sort(compare);
  const y = ordered ? b : [...b].sort(compare);
  return x.every((v, i) => same(v, y[i]));
}

function rowsMatch(ref: Norm[][], got: Norm[][], ordered: boolean): boolean {
  const rowSame = (r: Norm[], g: Norm[]) => r.every((v, i) => same(v, g[i]));
  if (ordered) return ref.every((r, i) => rowSame(r, got[i]));
  // As a set: a perfect matching of reference rows to result rows, found by
  // augmenting paths so that near-equal numbers cannot pair up wrongly.
  const owner: number[] = Array.from({ length: got.length }, () => -1);
  const edges = ref.map((r) => got.flatMap((g, j) => (rowSame(r, g) ? [j] : [])));
  const place = (i: number, seen: boolean[]): boolean => {
    for (const j of edges[i]) {
      if (seen[j]) continue;
      seen[j] = true;
      if (owner[j] === -1 || place(owner[j], seen)) {
        owner[j] = i;
        return true;
      }
    }
    return false;
  };
  return ref.every((_, i) =>
    place(
      i,
      Array.from({ length: got.length }, () => false),
    ),
  );
}

// More column assignments than this is not a result anyone meant.
const MAX_ASSIGNMENTS = 10_000;

/**
 * §4: every reference column has a result column with the same values (names
 * ignored, extra result columns allowed), the row counts are equal, and the
 * rows match as a set, or in order when `ordered`.
 */
export function matchResult(reference: QueryResult, got: QueryResult, ordered: boolean): Score {
  const fail = (reason: string): Score => ({ label: 'wrong', reason });
  if (got.rows.length !== reference.rows.length) {
    return fail(`${got.rows.length} rows, expected ${reference.rows.length}`);
  }
  const ref = reference.rows.map((r) => r.map(normalise));
  const res = got.rows.map((r) => r.map(normalise));
  const refCols = reference.columns.map((_, j) => ref.map((r) => r[j]));
  const resCols = got.columns.map((_, c) => res.map((r) => r[c]));

  const candidates = refCols.map((col) =>
    resCols.flatMap((other, c) => (sameValues(col, other, ordered) ? [c] : [])),
  );
  const missing = candidates.findIndex((c) => c.length === 0);
  if (missing !== -1) {
    return fail(`no result column has the values of "${reference.columns[missing].name}"`);
  }

  let tried = 0;
  const chosen: number[] = [];
  const assign = (j: number): boolean => {
    if (j === candidates.length) {
      tried += 1;
      const projected = res.map((row) => chosen.map((c) => row[c]));
      return rowsMatch(ref, projected, ordered);
    }
    for (const c of candidates[j]) {
      if (chosen.includes(c) || tried >= MAX_ASSIGNMENTS) continue;
      chosen.push(c);
      if (assign(j + 1)) return true;
      chosen.pop();
    }
    return false;
  };
  if (assign(0)) return { label: 'correct', reason: null };
  return fail(ordered ? 'rows differ or are in another order' : 'rows differ');
}

const fold = (text: string) => text.trim().toLowerCase();

function pathsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const norm = (p: Record<string, string>) =>
    new Map(Object.entries(p).map(([k, v]) => [fold(k), fold(v)]));
  const x = norm(a);
  const y = norm(b);
  return x.size === y.size && [...x].every(([k, v]) => y.get(k) === v);
}

export interface Expected {
  /** The reference SQL's result, for an answer golden whose reply is an answer. */
  reference?: QueryResult;
  /** The realised share from truth.json, for a change golden; null if none is recorded. */
  share?: number | null;
}

/**
 * The label for one reply (§4). A shown answer or change analysis that is not
 * correct is wrong when one was expected and over-confident when a question
 * or a decline was; a question or decline that is not correct is
 * over-cautious (D-041).
 */
export function score(golden: Golden, outcome: Outcome, expected: Expected = {}): Score {
  const shown = outcome.kind === 'answer' || outcome.kind === 'change';
  const expectsShown = golden.expect === 'answer' || golden.expect === 'change';

  if (shown && !expectsShown) {
    return { label: 'over-confident', reason: `gave an answer; expected ${golden.expect}` };
  }
  if (!shown && golden.expect !== outcome.kind) {
    return { label: 'over-cautious', reason: `${outcome.kind}; expected ${golden.expect}` };
  }

  if (golden.expect === 'answer') {
    if (outcome.kind !== 'answer')
      return { label: 'wrong', reason: 'change analysis; expected an answer' };
    if (!expected.reference) throw new Error(`${golden.id}: no reference result to score against`);
    return matchResult(expected.reference, outcome.result, golden.ordered);
  }

  if (golden.expect === 'change') {
    if (outcome.kind !== 'change')
      return { label: 'wrong', reason: 'answer; expected a change analysis' };
    if (!pathsEqual(outcome.path, golden.path)) {
      return { label: 'wrong', reason: `path ${JSON.stringify(outcome.path)}` };
    }
    const realised = expected.share ?? null;
    if (realised !== null) {
      if (outcome.share === null) return { label: 'wrong', reason: 'no share reported' };
      if (Math.abs(outcome.share - realised) > SHARE_TOLERANCE) {
        return { label: 'wrong', reason: `share ${outcome.share}, realised ${realised}` };
      }
    }
    return { label: 'correct', reason: null };
  }

  if (golden.expect === 'clarify' && outcome.kind === 'clarify') {
    if (fold(outcome.term) !== fold(golden.term)) {
      return { label: 'over-cautious', reason: `asked about "${outcome.term}"` };
    }
    const offered = new Set(outcome.options.map(fold));
    const absent = golden.acceptable.filter((o) => !offered.has(fold(o)));
    if (absent.length > 0) {
      return { label: 'over-cautious', reason: `did not offer ${absent.join(', ')}` };
    }
    return { label: 'correct', reason: null };
  }

  // A decline expected and given.
  return { label: 'correct', reason: null };
}

export interface Scored {
  category: Category;
  expect: Golden['expect'];
  /** The reply's kind, or `error` when the answerer failed. */
  kind: Outcome['kind'] | 'error';
  via: Via | null;
  label: Label;
  modelCalls: number;
  polish: { attempted: number; rejected: number } | null;
}

export interface Tally {
  questions: number;
  correct: number;
  wrong: number;
  overCautious: number;
  overConfident: number;
  error: number;
}

export interface Headline extends Tally {
  correctRate: number;
  /** (wrong + over-confident) / all: the figure that decides trust. */
  wrongAnswerRate: number;
  /** Share of answer and change questions that got an answer; null if there are none. */
  coverage: number | null;
  /** Answers that used the raw SQL escape hatch, over answers shown; null if none shown. */
  rawSqlShare: number | null;
  /** Polished sentences rejected by the grounding check, over attempted; null if none. */
  groundingRejectionRate: number | null;
  modelCalls: number;
}

export function tally(items: readonly Pick<Scored, 'label'>[]): Tally {
  const n = (label: Label) => items.filter((s) => s.label === label).length;
  return {
    questions: items.length,
    correct: n('correct'),
    wrong: n('wrong'),
    overCautious: n('over-cautious'),
    overConfident: n('over-confident'),
    error: n('error'),
  };
}

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);

export function headline(items: readonly Scored[]): Headline {
  const t = tally(items);
  const expectsShown = items.filter((s) => s.expect === 'answer' || s.expect === 'change');
  const shown = items.filter((s) => s.kind === 'answer' || s.kind === 'change');
  const answers = items.filter((s) => s.kind === 'answer');
  const polish = items.flatMap((s) => (s.polish ? [s.polish] : []));
  const attempted = polish.reduce((sum, p) => sum + p.attempted, 0);
  return {
    ...t,
    correctRate: ratio(t.correct, t.questions) ?? 0,
    wrongAnswerRate: ratio(t.wrong + t.overConfident, t.questions) ?? 0,
    coverage: ratio(expectsShown.filter((s) => shown.includes(s)).length, expectsShown.length),
    rawSqlShare: ratio(answers.filter((s) => s.via === 'raw').length, answers.length),
    groundingRejectionRate: ratio(
      polish.reduce((sum, p) => sum + p.rejected, 0),
      attempted,
    ),
    modelCalls: items.reduce((sum, s) => sum + s.modelCalls, 0),
  };
}
