/**
 * Value text for charts. Charts are client components fed from server
 * pages, so the format travels as data, not as a function.
 *
 * T23 moves number formatting into `core/narrative/format.ts`; this file is
 * then the only chart code that calls it.
 */

export type ValueFormat = {
  /** `number` (default), `percent` (0.25 is 25%) or `unit` (number then unit). */
  style?: 'number' | 'percent' | 'unit';
  /** Fraction digits. Default: 0 for numbers, 1 for percent. */
  digits?: number;
  /** For `unit`: written after the number, e.g. "USD" or "min". */
  unit?: string;
};

const MINUS = '−';

function realMinus(text: string): string {
  return text.replace(/^-/, MINUS);
}

function digitsFor(format: ValueFormat): number {
  return format.digits ?? (format.style === 'percent' ? 1 : 0);
}

/** A value in full, as in a table or a tooltip: 1,210,655 or 12.5%. */
export function formatValue(value: number | null, format: ValueFormat = {}): string {
  if (value === null || !Number.isFinite(value)) return 'No value';
  const digits = digitsFor(format);
  if (format.style === 'percent') {
    const text = new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
    return realMinus(text);
  }
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
  const withUnit = format.style === 'unit' && format.unit ? `${text} ${format.unit}` : text;
  return realMinus(withUnit);
}

/** A signed change: +12,400 or −3.1%. Zero has no sign. */
export function formatChange(value: number, format: ValueFormat = {}): string {
  const text = formatValue(value, format);
  return value > 0 ? `+${text}` : text;
}

/** A short value for axis ticks and tight labels: 1.2M, 48K, 25%. */
export function formatCompact(value: number, format: ValueFormat = {}): string {
  if (format.style === 'percent') {
    const text = new Intl.NumberFormat('en-US', {
      style: 'percent',
      maximumFractionDigits: Math.abs(value) < 0.1 && value !== 0 ? 1 : 0,
    }).format(value);
    return realMinus(text);
  }
  const text = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumSignificantDigits: 3,
  }).format(value);
  return realMinus(text);
}

/**
 * The format for labels on the marks: the unit is dropped, because the
 * title, the tooltip and the table carry it and repeating it on every bar
 * is noise.
 */
export function onMarks(format: ValueFormat): ValueFormat {
  return format.style === 'unit' ? { ...format, style: 'number' } : format;
}
