// Minimum acceptable figures (evals.md §7), read from eval/thresholds.json.
// A run below one fails, so CI stops a regression. Thresholds only move up;
// lowering one needs a decision that says why.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { Split } from './goldens';
import type { Mode } from './run';
import type { Headline } from './score';

const rate = z.number().min(0).max(1);
const limits = z.strictObject({
  minCorrectRate: rate,
  maxWrongAnswerRate: rate,
  minCoverage: rate,
});
const perSet = z.strictObject({ dev: limits.nullable(), holdout: limits.nullable() });
const thresholdsSchema = z.strictObject({
  keyless: perSet,
  ai: perSet,
  baseline: perSet,
});
export type Thresholds = z.infer<typeof thresholdsSchema>;

export const THRESHOLDS_PATH = join(process.cwd(), 'eval', 'thresholds.json');

export function loadThresholds(path = THRESHOLDS_PATH): Thresholds {
  return thresholdsSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}

/** Each figure below its threshold, in words; empty when the run passes or has none. */
export function breaches(h: Headline, thresholds: Thresholds, mode: Mode, set: Split): string[] {
  const t = thresholds[mode][set];
  if (!t) return [];
  const out: string[] = [];
  if (h.correctRate < t.minCorrectRate) {
    out.push(`correct rate ${h.correctRate} is below ${t.minCorrectRate}`);
  }
  if (h.wrongAnswerRate > t.maxWrongAnswerRate) {
    out.push(`wrong-answer rate ${h.wrongAnswerRate} is above ${t.maxWrongAnswerRate}`);
  }
  if ((h.coverage ?? 0) < t.minCoverage) {
    out.push(`coverage ${h.coverage} is below ${t.minCoverage}`);
  }
  return out;
}
