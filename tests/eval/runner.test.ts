// The runner end to end on the real samples: an oracle that replies with each
// reference result (rows reversed, columns renamed, an extra column) scores
// every golden correct; the same oracle with one number nudged scores every
// answer wrong; failures and timeouts are errors; result files and the
// summary are written as evals §6 says.

import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import type { Cell, QueryResult } from '@/core/engine/types';
import { DATASETS, type Dataset, type LoadedGolden, loadGoldens } from '../../eval/runner/goldens';
import { keylessAnswerer } from '../../eval/runner/keyless';
import {
  type Answerer,
  type OpenDataset,
  type Summary,
  buildRunFile,
  openDatasets,
  realisedShare,
  runEval,
  writeResults,
} from '../../eval/runner/run';
import { breaches, loadThresholds } from '../../eval/runner/thresholds';

const goldens = loadGoldens();
let datasets: Map<Dataset, OpenDataset>;

beforeAll(async () => {
  datasets = await openDatasets(DATASETS);
}, 60_000);

afterAll(async () => {
  for (const d of datasets.values()) await d.engine.close();
});

function disguise(r: QueryResult, ordered: boolean): QueryResult {
  const rows = ordered ? r.rows : [...r.rows].reverse();
  return {
    ...r,
    columns: [
      { name: 'extra', type: 'text', nullable: false },
      ...r.columns.map((c, i) => ({ ...c, name: `col_${i}` })),
    ],
    rows: rows.map((row) => ['x', ...row]),
  };
}

function nudge(r: QueryResult): QueryResult {
  const rows = r.rows.map((row) => [...row]);
  const j = rows[0].findIndex((c) => typeof c === 'number');
  const v = rows[0][j] as number;
  rows[0][j] = v + Math.max(1, Math.abs(v) * 0.01);
  return { ...r, rows };
}

function oracle(change: (r: QueryResult, g: LoadedGolden) => QueryResult): Answerer {
  const byQuestion = new Map(goldens.map((g) => [g.question, g]));
  return {
    mode: 'keyless',
    modelId: null,
    async answer(question, context) {
      const g = byQuestion.get(question)!;
      switch (g.expect) {
        case 'answer': {
          const result = await context.engine.query(g.reference_sql);
          return {
            outcome: {
              kind: 'answer',
              via: 'spec',
              sql: g.reference_sql,
              result: change(result, g),
            },
          };
        }
        case 'change':
          return {
            outcome: {
              kind: 'change',
              via: 'spec',
              path: g.path,
              share: realisedShare(datasets.get(g.dataset)!.truth, g.truth),
            },
          };
        case 'clarify':
          return {
            outcome: { kind: 'clarify', term: g.term, options: [...g.acceptable, 'orders'] },
          };
        case 'decline':
          return { outcome: { kind: 'decline', reason: 'no data' } };
      }
    },
  };
}

describe('scoring the real references', () => {
  test('an oracle with disguised results gets every golden correct', async () => {
    const records = await runEval(
      oracle((r, g) => disguise(r, g.expect === 'answer' && g.ordered)),
      goldens,
      datasets,
    );
    expect(records.filter((r) => r.label !== 'correct').map((r) => `${r.id}: ${r.reason}`)).toEqual(
      [],
    );
    const run = buildRunFile(
      {
        mode: 'keyless',
        set: 'dev',
        runAt: '',
        commit: '',
        dirty: false,
        modelId: null,
        engineVersion: '',
      },
      records,
    );
    expect(run.headline).toMatchObject({
      questions: 80,
      correctRate: 1,
      wrongAnswerRate: 0,
      coverage: 1,
    });
  }, 60_000);

  test('nudging one number in each answer makes every answer wrong', async () => {
    const records = await runEval(oracle(nudge), goldens, datasets);
    const answers = records.filter((r) => r.expect === 'answer');
    expect(answers.length).toBe(66);
    expect(answers.filter((r) => r.label !== 'wrong').map((r) => r.id)).toEqual([]);
  }, 60_000);

  test('reversing the rows of an ordered answer makes it wrong', async () => {
    const ordered = goldens.filter(
      (g): g is Extract<LoadedGolden, { expect: 'answer' }> => g.expect === 'answer' && g.ordered,
    );
    expect(ordered.length).toBeGreaterThan(0);
    const reverse = (r: QueryResult) => ({ ...r, rows: [...r.rows].reverse() });
    const records = await runEval(oracle(reverse), ordered, datasets);
    // A one-row or palindromic result reads the same reversed.
    const symmetric = (rows: Cell[][]) =>
      JSON.stringify(rows) === JSON.stringify([...rows].reverse());
    for (const r of records) {
      const g = ordered.find((o) => o.id === r.id)!;
      const reference = await datasets.get(g.dataset)!.engine.query(g.reference_sql);
      expect(r.label, r.id).toBe(symmetric(reference.rows) ? 'correct' : 'wrong');
    }
  }, 60_000);
});

describe('failures', () => {
  const dev = goldens.filter((g) => g.split === 'dev').slice(0, 2);

  test('a reply that throws is an error, with its message kept', async () => {
    const broken: Answerer = {
      mode: 'keyless',
      modelId: null,
      answer: () => Promise.reject(new Error('model unavailable')),
    };
    const records = await runEval(broken, dev, datasets);
    expect(records.map((r) => [r.label, r.kind, r.error])).toEqual([
      ['error', 'error', 'model unavailable'],
      ['error', 'error', 'model unavailable'],
    ]);
  });

  test('a reply that never comes is an error after the timeout', async () => {
    const stuck: Answerer = { mode: 'keyless', modelId: null, answer: () => new Promise(() => {}) };
    const records = await runEval(stuck, dev.slice(0, 1), datasets, { timeoutMs: 50 });
    expect(records[0].label).toBe('error');
  });
});

describe('result files', () => {
  test('the run file, and a summary that keeps other runs and hides holdout failures', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'footnote-eval-'));
    for (const set of ['dev', 'holdout'] as const) {
      const records = await runEval(
        keylessAnswerer,
        goldens.filter((g) => g.split === set),
        datasets,
      );
      const run = buildRunFile(
        {
          mode: 'keyless',
          set,
          runAt: '2026-10-10T00:00:00.000Z',
          commit: 'abc1234',
          dirty: false,
          modelId: null,
          engineVersion: 'v1',
        },
        records,
      );
      writeResults(run, dir);
    }
    expect(readdirSync(dir).sort()).toEqual([
      'keyless-dev.json',
      'keyless-holdout.json',
      'summary.json',
    ]);
    const summary = JSON.parse(readFileSync(join(dir, 'summary.json'), 'utf8')) as Summary;
    expect(summary.runs.map((r) => r.set)).toEqual(['dev', 'holdout']);
    const [dev, holdout] = summary.runs;
    expect(dev.headline.questions).toBe(50);
    expect(dev.notCorrect).toHaveLength(dev.headline.questions - dev.headline.correct);
    expect(holdout.notCorrect).toBeNull();
    expect(dev).not.toHaveProperty('records');
  });

  test('the keyless run declines everything, so it covers nothing and is never wrong', async () => {
    const records = await runEval(
      keylessAnswerer,
      goldens.filter((g) => g.split === 'dev'),
      datasets,
    );
    const { headline } = buildRunFile(
      {
        mode: 'keyless',
        set: 'dev',
        runAt: '',
        commit: '',
        dirty: false,
        modelId: null,
        engineVersion: '',
      },
      records,
    );
    expect(headline.wrong + headline.overConfident).toBe(0);
    expect(headline.coverage).toBe(0);
    expect(breaches(headline, loadThresholds(), 'keyless', 'dev')).toEqual([]);
  });
});
