/**
 * Value text for charts. Charts are client components fed from server
 * pages, so the format travels as data, not as a function. The text itself
 * comes from the one formatter, `core/narrative/format.ts`; this file is the
 * only chart code that calls it.
 */
import * as core from '@/core/narrative/format';
import type { NumberFormat } from '@/core/narrative/format';

export type ValueFormat = {
  /** `number` (default), `percent` (0.25 is 25%) or `unit` (number then unit). */
  style?: 'number' | 'percent' | 'unit';
  /** Fraction digits. Default: 0 for numbers, 1 for percent. */
  digits?: number;
  /** For `unit`: written after the number, e.g. "USD" or "min". */
  unit?: string;
};

function asNumberFormat(format: ValueFormat): NumberFormat {
  if (format.style === 'percent') return { style: 'percent', decimals: format.digits ?? 1 };
  return {
    style: 'number',
    unit: format.style === 'unit' ? format.unit : undefined,
    decimals: format.digits ?? 0,
  };
}

/** A value in full, as in a table or a tooltip: 1,210,655 or 12.5%. */
export function formatValue(value: number | null, format: ValueFormat = {}): string {
  return core.formatValue(value, asNumberFormat(format));
}

/** A signed change: +12,400 or −3.1%. Zero has no sign. */
export function formatChange(value: number, format: ValueFormat = {}): string {
  return core.formatValue(value, asNumberFormat(format), { signed: true });
}

/** A short value for axis ticks and tight labels: 1.2M, 48K, 25%. */
export function formatCompact(value: number, format: ValueFormat = {}): string {
  return core.formatTick(value, asNumberFormat(format));
}

/**
 * The format for labels on the marks: the unit is dropped, because the
 * title, the tooltip and the table carry it and repeating it on every bar
 * is noise.
 */
export function onMarks(format: ValueFormat): ValueFormat {
  return format.style === 'unit' ? { ...format, style: 'number' } : format;
}
