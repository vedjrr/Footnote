import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import results from '../../../eval/results/summary.json';
import { leadSentences } from './accuracy';
import { AccuracyView, type Summary } from './accuracy-view';

type Run = Summary['runs'][number];
type Headline = Run['headline'];

const real = results as Summary;

/** The page's visible text, tags dropped and entities decoded. */
function pageText(summary: Summary): string {
  return renderToStaticMarkup(createElement(AccuracyView, { summary }))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

const figures = (text: string) =>
  (text.match(/\d+(?:[.,]\d+)*/g) ?? []).map((t) => Number(t.replace(/,/g, '')));

/**
 * Every figure the page may show: the numbers written in the summary file,
 * plus the sums the page states (all goldens, wrong answers, misses listed).
 */
function allowed(summary: Summary): Set<number> {
  const out = new Set(figures(JSON.stringify(summary)));
  out.add(summary.goldens.dev + summary.goldens.holdout);
  for (const run of summary.runs) {
    for (const h of [run.headline, ...Object.values(run.byCategory)] as Headline[]) {
      out.add(h.wrong + h.overConfident);
    }
    if (run.notCorrect) out.add(run.notCorrect.length);
  }
  return out;
}

function unexplained(summary: Summary): number[] {
  const ok = allowed(summary);
  return figures(pageText(summary)).filter((n) => !ok.has(n));
}

function h(
  questions: number,
  correct: number,
  wrong: number,
  overCautious: number,
  overConfident: number,
  error: number,
): Headline {
  return {
    questions,
    correct,
    wrong,
    overCautious,
    overConfident,
    error,
    correctRate: correct / questions,
    wrongAnswerRate: (wrong + overConfident) / questions,
    coverage: null,
    rawSqlShare: null,
    groundingRejectionRate: null,
    modelCalls: 0,
  };
}

// Figures no hand-typed text would happen to contain.
const keylessDev: Run = {
  mode: 'keyless',
  set: 'dev',
  runAt: '2031-07-23T10:00:00.000Z',
  commit: 'abcdefa',
  dirty: true,
  modelId: null,
  engineVersion: 'duckdb test',
  headline: h(731, 523, 17, 181, 6, 4),
  byCategory: { single: h(311, 203, 9, 95, 2, 2), unanswerable: h(420, 320, 8, 86, 4, 2) },
  byDataset: {},
  notCorrect: [
    {
      id: 'retail-x',
      dataset: 'retail',
      category: 'change',
      question: 'Where did the drop come from?',
      expect: 'change',
      kind: 'change',
      label: 'wrong',
      reason: 'share 0.41, realised 0.77',
    },
    {
      id: 'saas-y',
      dataset: 'saas',
      category: 'single',
      question: 'What was churn?',
      expect: 'answer',
      kind: 'decline',
      label: 'over-cautious',
      reason: 'decline; expected answer',
    },
  ],
};
const aiHoldout: Run = {
  ...keylessDev,
  mode: 'ai',
  set: 'holdout',
  runAt: '2032-11-29T08:00:00.000Z',
  commit: 'fedcbaf',
  dirty: false,
  modelId: 'model-test',
  headline: h(419, 377, 13, 22, 5, 2),
  byCategory: { ranking: h(419, 377, 13, 22, 5, 2) },
  notCorrect: null,
};
const goldens = { dev: 731, holdout: 419 };

describe('accuracy page', () => {
  test('every figure on the page comes from the results file', () => {
    expect(real.runs.length).toBeGreaterThan(0);
    expect(unexplained(real)).toEqual([]);
  });

  test('every figure comes from the summary it is given, whatever the figures', () => {
    for (const summary of [
      { goldens, runs: [keylessDev] },
      { goldens, runs: [keylessDev, aiHoldout] },
      { goldens, runs: [] },
    ]) {
      expect(unexplained(summary)).toEqual([]);
    }
  });

  test('the first sentence reports the current results file', () => {
    const run = real.runs.find((r) => r.mode === 'keyless' && r.set === 'dev')!;
    const lead = leadSentences(real)[0];
    expect(lead).toContain(`${run.headline.correct} of ${run.headline.questions}`);
    if (!real.runs.some((r) => r.mode === 'ai')) {
      expect(leadSentences(real)).toContain('AI assist has not been tested yet.');
    }
  });

  test('the first sentence leads with AI assist on held-back questions when it has run', () => {
    expect(leadSentences({ goldens, runs: [keylessDev, aiHoldout] })).toEqual([
      'With AI assist, Footnote got 377 of 419 held-back test questions right and gave 18 wrong answers.',
      'On 22 more it declined or asked a question when it should not have.',
      '2 questions failed to run.',
    ]);
    expect(leadSentences({ goldens, runs: [keylessDev] })).toEqual([
      'Without AI assist, Footnote got 523 of 731 test questions right and gave 23 wrong answers.',
      'On 181 more it declined or asked a question when it should not have.',
      '4 questions failed to run.',
      'AI assist has not been tested yet.',
      'The 419 held-back questions have not been run yet.',
    ]);
    expect(leadSentences({ goldens, runs: [] })).toEqual([
      'Nothing has been measured yet, so there are no figures.',
    ]);
  });

  test('lists every non-correct development question and hides held-back ones', () => {
    const text = pageText({ goldens, runs: [keylessDev, aiHoldout] });
    for (const miss of keylessDev.notCorrect!) expect(text).toContain(miss.question);
    expect(text).toContain('share 0.41, realised 0.77');
    expect(text).not.toContain('decline; expected answer');
    expect(text).toContain('with uncommitted changes');

    const realText = pageText(real);
    for (const run of real.runs) {
      for (const miss of run.notCorrect ?? []) expect(realText).toContain(miss.question);
    }
  });

  test('a figure typed into the page is caught', () => {
    const summary = { goldens, runs: [keylessDev] };
    const ok = allowed(summary);
    const typed = figures('About 80 questions, 3 datasets.');
    expect(typed.filter((n) => !ok.has(n))).toEqual([80, 3]);
  });
});
