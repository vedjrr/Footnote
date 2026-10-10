// The shared Finding type: one statement in a briefing, with the queries it
// ran and the cells its numbers come from. A briefing sentence cites facts;
// a fact names a query and a cell of that query's result, so the working
// paper can show the SQL that ran and the value it returned. The specs let
// anyone rerun a query from the dictionary.

import type { Cell, QueryResult } from '@/core/engine/types';
import type { Grain } from '@/core/model/types';
import type { CellRef } from '@/core/narrative/answer-sentence';
import type { Compiled } from '@/core/query/compile';
import type { QuerySpec } from '@/core/query/spec';
import type { DayRange } from './periods';

export type FindingKind = 'key_change' | 'unusual_point' | 'run' | 'concentration';

/** A query a finding ran: the spec that reproduces it, the SQL and the result. */
export interface FindingQuery {
  id: string;
  spec: QuerySpec;
  compiled: Compiled;
  result: QueryResult;
}

/** A number in a finding: the cell it came from and its value. */
export interface FindingFact {
  /** The id of a query in the finding's `queries`. */
  query: string;
  cell: CellRef;
  value: Cell;
}

export interface FindingPeriod {
  grain: Grain;
  /** The period the finding is about. */
  current: DayRange;
  /** The period it is compared with, when there is one. */
  previous: DayRange | null;
}

interface FindingBase {
  /** Stable within a briefing: kind, metric and period. */
  id: string;
  kind: FindingKind;
  /** Metric id. */
  metric: string;
  period: FindingPeriod;
  facts: Record<string, FindingFact>;
  queries: FindingQuery[];
  /** 0 to 1, for ranking (analytics-spec §7). */
  score: number;
}

/** Whether a change is within the normal range for the metric (analytics-spec §5.1). */
export type NormalRange = 'unusually_large' | 'larger_than_usual' | 'normal' | 'not_assessed';

export interface ChangeAssessment {
  label: NormalRange;
  /**
   * What the change was measured against: the same period last season
   * (`seasonal`) or the period before (`sequential`). Null when not assessed.
   */
  basis: 'seasonal' | 'sequential' | null;
  /** The robust z-score of the change against its history. */
  z: number | null;
  /** How many earlier changes the z-score compares against. */
  history: number;
  /** Why the change was not assessed, when it was not. */
  reason: 'short_history' | 'missing_value' | 'no_spread' | null;
  /** Current minus previous. Null when either is empty. */
  change: number | null;
  /** Change over |previous|. Null when previous is 0 or empty. */
  pct: number | null;
  /** True for percent metrics, whose change is reported in points. */
  points: boolean;
  /** Under 0.5% (0.1 points for percent metrics): not broken down. */
  littleChanged: boolean;
}

export interface KeyChange extends FindingBase {
  kind: 'key_change';
  assessment: ChangeAssessment;
}

/** Grows with T43: unusual points, runs and concentration. */
export type Finding = KeyChange;
