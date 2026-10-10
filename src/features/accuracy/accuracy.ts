// The accuracy page's words and tables (FR-44, evals §9), built only from
// eval/results/summary.json. Every figure here is a field of the summary or
// a sum of its fields, written with the one formatter (NFR-11).

import { formatInteger } from '@/core/narrative/format';
import type { Category } from '../../../eval/runner/goldens';
import type { Mode, Summary } from '../../../eval/runner/run';
import type { Headline, Label } from '../../../eval/runner/score';

export type { Summary };
export type Run = Summary['runs'][number];
export type Miss = NonNullable<Run['notCorrect']>[number];

export const MODE_NAMES: Record<Mode, string> = {
  keyless: 'Without AI assist',
  ai: 'With AI assist',
  baseline: 'Baseline',
};

export const MODE_MEANINGS: Record<Mode, string> = {
  keyless: 'Footnote reads the question with fixed rules and calls no model.',
  ai: 'Footnote tries its rules first, then asks a model to pick from the metrics it knows.',
  baseline:
    'A model gets only the column names and the question, and its SQL is run as written. Most simple text-to-SQL tools work this way.',
};

export const CATEGORY_NAMES: Record<Category, string> = {
  single: 'Single value',
  ranking: 'Ranking',
  trend: 'Trend',
  comparison: 'Period comparison',
  ratio: 'Rates and averages',
  filters: 'Filters and loose wording',
  conditions: 'Several conditions',
  change: 'Where a change came from',
  ambiguous: 'Ambiguous, should ask',
  unanswerable: 'Not answerable, should decline',
};

export const EXPECTED: Record<Miss['expect'], string> = {
  answer: 'An answer',
  change: 'Where the change came from',
  clarify: 'A question back',
  decline: 'A decline',
};

export const HAPPENED: Record<Miss['kind'], string> = {
  answer: 'Answered',
  change: 'Explained a change',
  clarify: 'Asked a question',
  decline: 'Declined',
  error: 'Failed to run',
};

export const LABEL_NAMES: Record<Label, string> = {
  correct: 'Correct',
  wrong: 'Wrong',
  'over-cautious': 'Over-cautious',
  'over-confident': 'Over-confident',
  error: 'Error',
};

const count = (n: number, one: string, many: string) =>
  `${formatInteger(n)} ${n === 1 ? one : many}`;

/** Wrong answers in the §4 sense: a wrong number shown, or an answer that should not have been. */
export const wrongAnswers = (h: Headline) => h.wrong + h.overConfident;

/** The run the first sentence reports: AI assist over rules alone, held-back over dev. */
export function leadRun(summary: Summary): Run | null {
  const order: Array<[Mode, Run['set']]> = [
    ['ai', 'holdout'],
    ['ai', 'dev'],
    ['keyless', 'holdout'],
    ['keyless', 'dev'],
    ['baseline', 'holdout'],
    ['baseline', 'dev'],
  ];
  for (const [mode, set] of order) {
    const run = summary.runs.find((r) => r.mode === mode && r.set === set);
    if (run) return run;
  }
  return null;
}

/** The opening paragraph: what the latest results say, and what has not been run. */
export function leadSentences(summary: Summary): string[] {
  const run = leadRun(summary);
  if (!run) return ['Nothing has been measured yet, so there are no figures.'];
  const h = run.headline;
  const wrong = wrongAnswers(h);
  const who = run.mode === 'baseline' ? 'The baseline' : `${MODE_NAMES[run.mode]}, Footnote`;
  const questions = run.set === 'holdout' ? 'held-back test questions' : 'test questions';
  const out = [
    `${who} got ${formatInteger(h.correct)} of ${formatInteger(h.questions)} ${questions} right and gave ${
      wrong === 0 ? 'no wrong answers' : count(wrong, 'wrong answer', 'wrong answers')
    }.`,
  ];
  if (h.overCautious > 0) {
    out.push(
      `On ${formatInteger(h.overCautious)} more it declined or asked a question when it should not have.`,
    );
  }
  if (h.error > 0) out.push(`${count(h.error, 'question', 'questions')} failed to run.`);
  if (!summary.runs.some((r) => r.mode === 'ai')) out.push('AI assist has not been tested yet.');
  if (run.set === 'dev' && !summary.runs.some((r) => r.set === 'holdout')) {
    out.push(
      `The ${formatInteger(summary.goldens.holdout)} held-back questions have not been run yet.`,
    );
  }
  return out;
}

/** The runs on one set of questions, in mode order (the summary keeps that order). */
export const runsOn = (summary: Summary, set: Run['set']) =>
  summary.runs.filter((r) => r.set === set);

/** Modes with no run on this set, for the note under its table. */
export function modesNotRun(summary: Summary, set: Run['set']): Mode[] {
  const run = new Set(runsOn(summary, set).map((r) => r.mode));
  return (Object.keys(MODE_NAMES) as Mode[]).filter((m) => !run.has(m));
}

/** "AI assist and the baseline have not been run on these questions." */
export function notRunSentence(modes: Mode[]): string | null {
  if (modes.length === 0) return null;
  const names = modes.map((m) =>
    m === 'baseline' ? 'the baseline' : m === 'ai' ? 'AI assist' : 'Footnote without AI assist',
  );
  const list =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  const text = `${list} ${modes.length === 1 ? 'has' : 'have'} not been run on these questions.`;
  return text[0].toUpperCase() + text.slice(1);
}

/** The question types present in any of these runs, in the golden order. */
export function categoriesIn(runs: Run[]): Category[] {
  const present = new Set(runs.flatMap((r) => Object.keys(r.byCategory)));
  return (Object.keys(CATEGORY_NAMES) as Category[]).filter((c) => present.has(c));
}

/** The detail behind a miss, when it says more than the expected and actual kinds. */
export function missDetail(miss: Miss): string | null {
  if (!miss.reason || /; expected \w+$/.test(miss.reason)) return null;
  return miss.reason;
}

export { formatDay } from '@/core/narrative/format';
export { formatInteger };
