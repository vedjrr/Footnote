// Golden questions (evals.md §3): the schema of the YAML files under
// eval/goldens/<split>/<dataset>.yaml, and a loader that validates them.
// Expected results are never stored here; the runner computes them by running
// each reference SQL at eval time.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';

export const DATASETS = ['retail', 'saas', 'support'] as const;
export const SPLITS = ['dev', 'holdout'] as const;
export const CATEGORIES = [
  'single',
  'ranking',
  'trend',
  'comparison',
  'ratio',
  'filters',
  'conditions',
  'change',
  'ambiguous',
  'unanswerable',
] as const;

export type Dataset = (typeof DATASETS)[number];
export type Split = (typeof SPLITS)[number];
export type Category = (typeof CATEGORIES)[number];

/**
 * `snapshot`: the answer depends on a snapshot metric rolled up as its last
 * period (analytics-spec §2.7). `ratio`: the answer depends on a ratio built
 * from totals, where an average of row-level ratios gives a different number.
 */
const tagSchema = z.enum(['snapshot', 'ratio']);

const common = {
  id: z.string().regex(/^(retail|saas|support)-\d{3}$/),
  category: z.enum(CATEGORIES),
  question: z.string().min(5),
  tags: z.array(tagSchema).optional(),
  notes: z.string().optional(),
};

const answerGolden = z.strictObject({
  ...common,
  expect: z.literal('answer'),
  reference_sql: z.string().min(10),
  ordered: z.boolean(),
});

const changeGolden = z.strictObject({
  ...common,
  expect: z.literal('change'),
  /** An effect id in the dataset's truth.json. */
  truth: z.string().regex(/^[RST]\d$/),
  /**
   * The segment the change came from, as dimension id to value, below any
   * filter the question already names (D-040). Matched in any order.
   */
  path: z.record(z.string().min(1), z.string().min(1)),
});

const clarifyGolden = z.strictObject({
  ...common,
  expect: z.literal('clarify'),
  term: z.string().min(1),
  /** Metric ids a clarifying question should offer. */
  acceptable: z.array(z.string().min(1)).min(2),
});

const declineGolden = z.strictObject({
  ...common,
  expect: z.literal('decline'),
});

export const goldenSchema = z.discriminatedUnion('expect', [
  answerGolden,
  changeGolden,
  clarifyGolden,
  declineGolden,
]);

export type Golden = z.infer<typeof goldenSchema>;
export type LoadedGolden = Golden & { dataset: Dataset; split: Split };

export const GOLDENS_DIR = join(process.cwd(), 'eval', 'goldens');

/** Reads and validates every golden in one split, or both. */
export function loadGoldens(splits: readonly Split[] = SPLITS, dir = GOLDENS_DIR): LoadedGolden[] {
  const out: LoadedGolden[] = [];
  for (const split of splits) {
    const files = readdirSync(join(dir, split)).filter((f) => f.endsWith('.yaml'));
    for (const file of files.sort()) {
      const dataset = file.replace(/\.yaml$/, '');
      if (!(DATASETS as readonly string[]).includes(dataset)) {
        throw new Error(`${split}/${file}: not a sample dataset`);
      }
      const raw: unknown = parse(readFileSync(join(dir, split, file), 'utf8'));
      const parsed = z.array(goldenSchema).safeParse(raw);
      if (!parsed.success) {
        throw new Error(`${split}/${file}: ${z.prettifyError(parsed.error)}`);
      }
      for (const g of parsed.data) {
        if (!g.id.startsWith(`${dataset}-`)) {
          throw new Error(`${split}/${file}: ${g.id} belongs to another dataset`);
        }
        out.push({ ...g, dataset: dataset as Dataset, split });
      }
    }
  }
  return out;
}
