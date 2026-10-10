// How an answer's result reads in tables and charts: column headers and
// cell text, all through the one formatter.

import type { Answer } from '@/core/ask/answer';
import type { Cell } from '@/core/engine/types';
import type { MetricFormat, SemanticModel } from '@/core/model/types';
import {
  formatPercentChange,
  formatPeriodShort,
  formatPoints,
  formatValue,
} from '@/core/narrative/format';
import type { OutputColumn } from '@/core/query/compile';
import type { ValueFormat } from '@/ui/charts';

const GRAIN_HEADER = {
  day: 'Day',
  week: 'Week of',
  month: 'Month',
  quarter: 'Quarter',
  year: 'Year',
};

export function metricOf(model: SemanticModel, id: string) {
  return model.metrics.find((m) => m.id === id);
}

export function header(col: OutputColumn, answer: Answer, model: SemanticModel): string {
  if (col.kind === 'period') return GRAIN_HEADER[answer.spec.time?.grain ?? 'month'];
  if (col.kind === 'dimension')
    return model.dimensions.find((d) => d.id === col.ref)?.label ?? col.ref;
  const m = metricOf(model, col.ref);
  const label = m?.label ?? col.ref;
  // The unit is written once, in the header, not after every value.
  const unit = m?.format.unit && m.format.style !== 'percent' ? ` (${m.format.unit})` : '';
  switch (col.kind) {
    case 'previous':
      return `${label} before${unit}`;
    case 'change':
      return m?.format.style === 'percent' ? 'Change' : `Change${unit}`;
    case 'change_pct':
      return 'Change %';
    case 'share':
      return 'Share';
    case 'running':
      return `Running total${unit}`;
    case 'rank':
      return 'Rank';
    default:
      return `${label}${unit}`;
  }
}

/** A cell in full, as a table shows it. */
export function cellText(
  col: OutputColumn,
  cell: Cell,
  answer: Answer,
  model: SemanticModel,
): string {
  if (cell === null) return 'No value';
  if (col.kind === 'period')
    return formatPeriodShort(String(cell), answer.spec.time?.grain ?? 'month');
  if (col.kind === 'dimension') return String(cell) || 'No value';
  const value = Number(cell);
  if (col.kind === 'rank') return formatValue(value, { style: 'number', decimals: 0 });
  const given = metricOf(model, col.ref)?.format ?? { style: 'number' };
  // Money reads with two decimals in full, so a column's values line up.
  const format =
    given.style === 'currency' && given.decimals === undefined ? { ...given, decimals: 2 } : given;
  if (col.kind === 'change_pct') return formatPercentChange(value, { signed: true });
  if (col.kind === 'change') {
    return format.style === 'percent'
      ? formatPoints(value, { signed: true })
      : formatValue(value, format, { signed: true, bare: true });
  }
  if (col.kind === 'share') return formatValue(value, { style: 'percent', decimals: 1 });
  return formatValue(value, format, { bare: true });
}

/** A dictionary format as a chart's value format. */
export function chartFormat(format: MetricFormat): ValueFormat {
  if (format.style === 'percent') return { style: 'percent', digits: format.decimals ?? 1 };
  if (format.unit) return { style: 'unit', unit: format.unit, digits: format.decimals };
  return { style: 'number', digits: format.decimals };
}

export function isNumeric(col: OutputColumn): boolean {
  return col.kind !== 'period' && col.kind !== 'dimension';
}
