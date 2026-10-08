// Edits to a dictionary from the metrics screen (FR-13). Each returns a new
// model checked by the schema, or a sentence saying why the edit cannot be
// made; the model passed in is never changed.

import { dependents } from './describe';
import {
  type Aggregation,
  type Direction,
  type Metric,
  type MetricFormat,
  type SemanticModel,
  semanticModelSchema,
} from './types';
import { slug } from './words';

export type EditResult = { ok: true; model: SemanticModel } | { ok: false; message: string };

function checked(next: unknown): EditResult {
  const parsed = semanticModelSchema.safeParse(next);
  if (parsed.success) return { ok: true, model: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, message: issue.message.endsWith('.') ? issue.message : `${issue.message}.` };
}

function cleanSynonyms(synonyms: string[]): string[] {
  const seen = new Set<string>();
  return synonyms
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()));
}

export interface MetricChanges {
  label?: string;
  agg?: Aggregation;
  direction?: Direction;
  synonyms?: string[];
}

export function editMetric(model: SemanticModel, id: string, changes: MetricChanges): EditResult {
  const metric = model.metrics.find((m) => m.id === id);
  if (!metric) return { ok: false, message: 'That metric is no longer in the dictionary.' };
  if (changes.label !== undefined) {
    const label = changes.label.trim();
    if (label === '') return { ok: false, message: 'Give the metric a name.' };
    const clash = model.metrics.find(
      (m) => m.id !== id && m.label.toLowerCase() === label.toLowerCase(),
    );
    if (clash) return { ok: false, message: `Another metric is already called ${clash.label}.` };
  }
  if (changes.agg !== undefined) {
    if (metric.kind !== 'simple' || metric.column === null) {
      return {
        ok: false,
        message: 'Only a metric read from one column can change how it adds up.',
      };
    }
    if (changes.agg === 'count') {
      return { ok: false, message: 'Choose how the values of the column add up.' };
    }
  }
  const next: Metric = {
    ...metric,
    ...(changes.label !== undefined && { label: changes.label.trim() }),
    ...(changes.direction !== undefined && { direction: changes.direction }),
    ...(changes.synonyms !== undefined && { synonyms: cleanSynonyms(changes.synonyms) }),
    ...(changes.agg !== undefined && metric.kind === 'simple' && { agg: changes.agg }),
  };
  return checked({ ...model, metrics: model.metrics.map((m) => (m.id === id ? next : m)) });
}

export function removeMetric(model: SemanticModel, id: string): EditResult {
  const users = dependents(model, id);
  if (users.length > 0) {
    const names = users.map((m) => m.label).join(' and ');
    return {
      ok: false,
      message: `${names} ${users.length === 1 ? 'uses' : 'use'} this metric. Remove ${users.length === 1 ? 'it' : 'them'} first.`,
    };
  }
  if (model.metrics.length === 1) {
    return { ok: false, message: 'The dictionary needs at least one metric.' };
  }
  return checked({ ...model, metrics: model.metrics.filter((m) => m.id !== id) });
}

export interface NewRatio {
  label: string;
  numerator: string;
  denominator: string;
}

export function addRatio(model: SemanticModel, ratio: NewRatio): EditResult {
  const label = ratio.label.trim();
  if (label === '') return { ok: false, message: 'Give the new metric a name.' };
  if (model.metrics.some((m) => m.label.toLowerCase() === label.toLowerCase())) {
    return { ok: false, message: `A metric is already called ${label}.` };
  }
  const num = model.metrics.find((m) => m.id === ratio.numerator);
  const den = model.metrics.find((m) => m.id === ratio.denominator);
  if (!num || !den) return { ok: false, message: 'Choose two metrics to divide.' };
  if (num.id === den.id) return { ok: false, message: 'Choose two different metrics.' };
  const ids = new Set(model.metrics.map((m) => m.id));
  const base = slug(label);
  let id = base;
  for (let n = 2; ids.has(id); n++) id = `${base}_${n}`;
  // The same kind of value on both sides gives a percentage, such as cost
  // over revenue; money over a count stays money per item.
  const format: MetricFormat =
    num.format.style === den.format.style
      ? { style: 'percent', decimals: 1 }
      : num.format.style === 'currency'
        ? { ...num.format }
        : { style: 'number', decimals: 2 };
  const metric: Metric = {
    kind: 'ratio',
    id,
    label,
    numerator: num.id,
    denominator: den.id,
    format,
    direction: 'neutral',
    importance: 0.4,
    synonyms: [],
  };
  return checked({ ...model, metrics: [...model.metrics, metric] });
}

export function editDimension(
  model: SemanticModel,
  id: string,
  changes: { label?: string; synonyms?: string[] },
): EditResult {
  const dim = model.dimensions.find((d) => d.id === id);
  if (!dim) return { ok: false, message: 'That column is no longer in the dictionary.' };
  if (changes.label !== undefined && changes.label.trim() === '') {
    return { ok: false, message: 'Give the column a name.' };
  }
  const next = {
    ...dim,
    ...(changes.label !== undefined && { label: changes.label.trim() }),
    ...(changes.synonyms !== undefined && { synonyms: cleanSynonyms(changes.synonyms) }),
  };
  return checked({ ...model, dimensions: model.dimensions.map((d) => (d.id === id ? next : d)) });
}

/** Takes a dimension out of the dictionary; its column joins the hidden ones. */
export function hideDimension(model: SemanticModel, id: string): EditResult {
  const dim = model.dimensions.find((d) => d.id === id);
  if (!dim) return { ok: false, message: 'That column is no longer in the dictionary.' };
  const users = model.metrics.filter(
    (m) => m.kind === 'simple' && m.where?.some((f) => f.dimension === id),
  );
  if (users.length > 0) {
    const names = users.map((m) => m.label).join(' and ');
    return {
      ok: false,
      message: `${names} ${users.length === 1 ? 'counts' : 'count'} rows by this column. Remove ${users.length === 1 ? 'it' : 'them'} first.`,
    };
  }
  return checked({
    ...model,
    dimensions: model.dimensions.filter((d) => d.id !== id),
    hidden: [...model.hidden.filter((c) => c !== dim.column), dim.column],
  });
}

/**
 * Brings a hidden column back as the dimension it was in `original`, the
 * dictionary as first loaded. A column that was never a dimension cannot be
 * shown this way.
 */
export function showColumn(
  model: SemanticModel,
  original: SemanticModel,
  column: string,
): EditResult {
  const dim = original.dimensions.find((d) => d.column === column);
  if (!dim) return { ok: false, message: `${column} cannot be split by, so it stays hidden.` };
  const ids = new Set(model.dimensions.map((d) => d.id));
  const restored = ids.has(dim.id) ? { ...dim, id: `${dim.id}_${ids.size + 1}` } : dim;
  return checked({
    ...model,
    dimensions: [...model.dimensions, restored],
    hidden: model.hidden.filter((c) => c !== column),
  });
}
