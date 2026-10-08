// QuerySpec (architecture §6.2): a question as data. The composer, the phrase
// reader and the AI planner all produce one; only the compiler turns it into
// SQL, so every answer is built from the dictionary.

import { z } from 'zod';
import { filterSchema, grainSchema } from '@/core/model/types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A date is written YYYY-MM-DD');

export const timeRangeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('absolute'), from: isoDate, to: isoDate }),
  z.strictObject({
    kind: z.literal('last_n'),
    n: z.number().int().min(1).max(1000),
    grain: grainSchema,
    complete: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal('period'),
    grain: grainSchema,
    /** 0 is the latest complete period, 1 the one before, and so on. */
    offset: z.number().int().min(0).max(1000),
  }),
  z.strictObject({ kind: z.literal('all') }),
]);
export type TimeRange = z.infer<typeof timeRangeSchema>;

export const querySpecSchema = z
  .strictObject({
    metrics: z.array(z.string().min(1)).min(1).max(4),
    by: z.array(z.string().min(1)).max(2).default([]),
    /** A grain asks for a series over time. */
    time: z.strictObject({ grain: grainSchema.optional(), range: timeRangeSchema }).optional(),
    filters: z.array(filterSchema).default([]),
    compare: z.enum(['previous_period', 'same_period_last_year']).optional(),
    calc: z.enum(['share_of_total', 'running_total', 'rank']).optional(),
    /** A metric or dimension id, or `period` for the time grain. */
    sort: z.strictObject({ by: z.string().min(1), dir: z.enum(['asc', 'desc']) }).optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  })
  .superRefine((spec, ctx) => {
    if (new Set(spec.metrics).size !== spec.metrics.length) {
      ctx.addIssue({ code: 'custom', path: ['metrics'], message: 'A metric is listed twice' });
    }
    if (new Set(spec.by).size !== spec.by.length) {
      ctx.addIssue({ code: 'custom', path: ['by'], message: 'A split is listed twice' });
    }
    if (spec.time?.range.kind === 'absolute' && spec.time.range.from > spec.time.range.to) {
      ctx.addIssue({
        code: 'custom',
        path: ['time', 'range'],
        message: 'The period starts after it ends',
      });
    }
  });

export type QuerySpec = z.infer<typeof querySpecSchema>;
export type QuerySpecInput = z.input<typeof querySpecSchema>;
