// The dictionary, also called the semantic model (architecture §6.1). The Zod
// schemas are the source of truth; the types are inferred from them. Parsing
// checks the shape and then the references between parts: metric ids are
// unique, ratios and differences name metrics that exist, filters name
// dimensions that exist, and no metric is built from itself.

import { z } from 'zod';

export const GRAINS = ['day', 'week', 'month', 'quarter', 'year'] as const;
export const grainSchema = z.enum(GRAINS);
export type Grain = z.infer<typeof grainSchema>;

export const AGGREGATIONS = [
  'sum',
  'avg',
  'min',
  'max',
  'median',
  'count',
  'count_distinct',
] as const;
export const aggregationSchema = z.enum(AGGREGATIONS);
export type Aggregation = z.infer<typeof aggregationSchema>;

const id = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'An id is lower case letters, digits and underscores');

const label = z.string().trim().min(1, 'A label cannot be empty');

export const filterSchema = z.strictObject({
  /** A dimension id. */
  dimension: id,
  op: z.enum(['in', 'not_in', 'contains']),
  values: z.array(z.string()).min(1),
});
export type Filter = z.infer<typeof filterSchema>;

export const formatSchema = z.strictObject({
  style: z.enum(['number', 'currency', 'percent', 'duration']),
  /** A currency code for `currency`, a time unit for `duration`, else a suffix. */
  unit: z.string().min(1).optional(),
  decimals: z.number().int().min(0).max(6).optional(),
});
export type MetricFormat = z.infer<typeof formatSchema>;

export const directionSchema = z.enum(['higher_better', 'lower_better', 'neutral']);
export type Direction = z.infer<typeof directionSchema>;

const metricHead = { id, label };
const metricTail = {
  format: formatSchema,
  direction: directionSchema,
  synonyms: z.array(z.string().trim().min(1)).default([]),
  description: z.string().optional(),
  /** 0..1, used to rank findings (analytics-spec §2.6). */
  importance: z.number().min(0).max(1),
};

export const simpleMetricSchema = z.strictObject({
  kind: z.literal('simple'),
  ...metricHead,
  /** Null only for a count of rows. */
  column: z.string().min(1).nullable(),
  agg: aggregationSchema,
  /** How the metric rolls up across periods (analytics-spec §2.7). */
  overTime: z.enum(['sum', 'last', 'avg']).default('sum'),
  where: z.array(filterSchema).optional(),
  ...metricTail,
});

export const ratioMetricSchema = z.strictObject({
  kind: z.literal('ratio'),
  ...metricHead,
  numerator: id,
  denominator: id,
  ...metricTail,
});

/** One metric minus another, both additive: gross profit = revenue - cost (D-031). */
export const differenceMetricSchema = z.strictObject({
  kind: z.literal('difference'),
  ...metricHead,
  minuend: id,
  subtrahend: id,
  ...metricTail,
});

export const metricSchema = z.discriminatedUnion('kind', [
  simpleMetricSchema,
  ratioMetricSchema,
  differenceMetricSchema,
]);
export type SimpleMetric = z.infer<typeof simpleMetricSchema>;
export type RatioMetric = z.infer<typeof ratioMetricSchema>;
export type DifferenceMetric = z.infer<typeof differenceMetricSchema>;
export type Metric = z.infer<typeof metricSchema>;

export const dimensionSchema = z.strictObject({
  id,
  label,
  column: z.string().min(1),
  /** `entity` is high variety, such as a customer id. */
  role: z.enum(['category', 'entity']),
  distinct: z.number().int().min(0),
  synonyms: z.array(z.string().trim().min(1)).default([]),
  /** Never sent to the model (analytics-spec §2.4). */
  private: z.boolean(),
});
export type Dimension = z.infer<typeof dimensionSchema>;

export const timeColumnSchema = z.strictObject({
  id,
  label,
  column: z.string().min(1),
  min: z.string().min(1),
  max: z.string().min(1),
  defaultGrain: grainSchema,
});
export type TimeColumn = z.infer<typeof timeColumnSchema>;

/** A question offered on first load. The spec is checked against QuerySpec in T20. */
export const starterSchema = z.strictObject({
  label,
  spec: z.record(z.string(), z.unknown()),
});
export type Starter = z.infer<typeof starterSchema>;

const modelShape = z.strictObject({
  table: z.string().min(1),
  version: z.number().int().min(1),
  time: timeColumnSchema.nullable(),
  metrics: z.array(metricSchema).min(1),
  dimensions: z.array(dimensionSchema).default([]),
  /** Columns left out of the dictionary. */
  hidden: z.array(z.string()).default([]),
  starters: z.array(starterSchema).default([]),
});

export const semanticModelSchema = modelShape.superRefine((model, ctx) => {
  const metricIds = new Map<string, Metric>();
  model.metrics.forEach((m, i) => {
    if (metricIds.has(m.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['metrics', i, 'id'],
        message: `The metric id "${m.id}" is used twice`,
      });
    }
    metricIds.set(m.id, m);
  });
  const dimensionIds = new Set<string>();
  model.dimensions.forEach((d, i) => {
    if (dimensionIds.has(d.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['dimensions', i, 'id'],
        message: `The dimension id "${d.id}" is used twice`,
      });
    }
    dimensionIds.add(d.id);
  });

  model.metrics.forEach((m, i) => {
    for (const [key, ref] of metricRefs(m)) {
      if (!metricIds.has(ref)) {
        ctx.addIssue({
          code: 'custom',
          path: ['metrics', i, key],
          message: `"${ref}" is not a metric id`,
        });
      }
    }
    if (m.kind === 'simple') {
      if (m.column === null && m.agg !== 'count') {
        ctx.addIssue({
          code: 'custom',
          path: ['metrics', i, 'column'],
          message: 'Only a count of rows can have no column',
        });
      }
      m.where?.forEach((f, j) => {
        if (!dimensionIds.has(f.dimension)) {
          ctx.addIssue({
            code: 'custom',
            path: ['metrics', i, 'where', j, 'dimension'],
            message: `"${f.dimension}" is not a dimension id`,
          });
        }
      });
    }
  });

  // A metric built from itself, directly or through others, has no value.
  const visiting = new Set<string>();
  const done = new Set<string>();
  const cyclic = (mid: string): boolean => {
    if (done.has(mid)) return false;
    if (visiting.has(mid)) return true;
    visiting.add(mid);
    const m = metricIds.get(mid);
    const found = m ? metricRefs(m).some(([, ref]) => cyclic(ref)) : false;
    visiting.delete(mid);
    done.add(mid);
    return found;
  };
  model.metrics.forEach((m, i) => {
    if (cyclic(m.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['metrics', i, 'id'],
        message: `The metric "${m.id}" is built from itself`,
      });
    }
  });
});

export type SemanticModel = z.infer<typeof semanticModelSchema>;
/** What a dictionary looks like before defaults are filled in, as written in YAML. */
export type SemanticModelInput = z.input<typeof semanticModelSchema>;

/** The metric ids a metric is built from, with the field that names each. */
export function metricRefs(m: Metric): Array<[string, string]> {
  if (m.kind === 'ratio') {
    return [
      ['numerator', m.numerator],
      ['denominator', m.denominator],
    ];
  }
  if (m.kind === 'difference') {
    return [
      ['minuend', m.minuend],
      ['subtrahend', m.subtrahend],
    ];
  }
  return [];
}
