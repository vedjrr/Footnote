// Number and date formatting (analytics-spec §9.2). The one place a number
// becomes text: a lint rule refuses `toFixed`, `toLocaleString`,
// `toPrecision` and `Intl` formatters anywhere else in `src`.
//
// - Full values (tables, working papers): thousands separators.
// - Compact values (prose, headline figures): three significant digits,
//   1.28M and 48.2K, from 10,000 up.
// - Percent changes one decimal; ratio changes in points, "pts".
// - A real minus sign (U+2212). No currency symbol is assumed: the unit is
//   written after the number, "48.2K GBP".

import type { Grain, MetricFormat } from '@/core/model/types';

const MINUS = '−';

/** How a value is written; the metric's dictionary format, or a plain number. */
export type NumberFormat = Pick<MetricFormat, 'style' | 'unit' | 'decimals'>;

export interface FormatOptions {
  /** Write a plus sign on rises. Zero has no sign. */
  signed?: boolean;
  /** Leave the unit off, for labels on marks where the title carries it. */
  bare?: boolean;
}

const fixedCache = new Map<string, Intl.NumberFormat>();

function digits(min: number, max: number): Intl.NumberFormat {
  const key = `${min}:${max}`;
  let f = fixedCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
    fixedCache.set(key, f);
  }
  return f;
}

const significant = new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 3 });
// en-US writes compact numbers as 1.28M and 48.2K; en-GB would write 1.28m.
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumSignificantDigits: 3,
});

/** Signs a formatted magnitude. `text` is the absolute value already written. */
function sign(value: number, text: string, signed: boolean): string {
  if (!/[1-9]/.test(text)) return text; // rounds to zero: no sign
  if (value < 0) return MINUS + text;
  return signed && value > 0 ? `+${text}` : text;
}

function withUnit(text: string, unit: string | undefined, options: FormatOptions): string {
  return unit && !options.bare ? `${text} ${unit}` : text;
}

/** A number with thousands separators and up to `maxDecimals` decimals: −1,234.5. */
export function formatNumber(value: number, maxDecimals = 0, options: FormatOptions = {}): string {
  return sign(value, digits(0, maxDecimals).format(Math.abs(value)), options.signed ?? false);
}

/** A number with exactly `decimals` decimals: 4.0, 12.50. */
export function formatFixed(value: number, decimals: number, options: FormatOptions = {}): string {
  return sign(value, digits(decimals, decimals).format(Math.abs(value)), options.signed ?? false);
}

/** A whole number with thousands separators and a real minus sign: −1,234. */
export function formatInteger(value: number): string {
  return formatNumber(value, 0);
}

/** A share of 0..1 as a percentage with one decimal: 0.012 -> "1.2%". Tiny shares say so. */
export function formatShare(value: number): string {
  if (value > 0 && value < 0.0005) return 'under 0.1%';
  return `${formatFixed(value * 100, 1)}%`;
}

/** A file size in megabytes of 1,000,000 bytes, as the operating system shows it. */
export function formatMegabytes(bytes: number): string {
  const mb = bytes / 1_000_000;
  return mb < 1 ? 'under 1 MB' : `${formatNumber(mb, 0)} MB`;
}

// ------------------------------------------------------------------ values

/**
 * A value in full, as in a table or a working paper: 1,210,655 GBP, 12.5%,
 * 95 minutes. Decimals follow the format; without them, up to two.
 */
export function formatValue(
  value: number | null,
  format: NumberFormat = { style: 'number' },
  options: FormatOptions = {},
): string {
  if (value === null || !Number.isFinite(value)) return 'No value';
  const signed = options.signed ?? false;
  switch (format.style) {
    case 'percent':
      return `${formatFixed(value * 100, format.decimals ?? 1, { signed })}%`;
    case 'duration':
      return withUnit(
        formatNumber(value, format.decimals ?? 1, { signed }),
        unitWord(durationUnit(format.unit), value),
        options,
      );
    default: {
      const text =
        format.decimals === undefined
          ? formatNumber(value, 2, { signed })
          : formatFixed(value, format.decimals, { signed });
      return withUnit(text, format.unit, options);
    }
  }
}

/**
 * A value for prose and headline figures: three significant digits, compact
 * from 10,000 (1.28M GBP, 48.2K), durations in a sensible unit.
 */
export function formatCompact(
  value: number | null,
  format: NumberFormat = { style: 'number' },
  options: FormatOptions = {},
): string {
  if (value === null || !Number.isFinite(value)) return 'No value';
  const signed = options.signed ?? false;
  switch (format.style) {
    case 'percent':
      return `${formatFixed(value * 100, format.decimals ?? 1, { signed })}%`;
    case 'duration':
      return formatDuration(value, format.unit, options);
    default: {
      const magnitude = Math.abs(value);
      const text = magnitude >= 10_000 ? compact.format(magnitude) : significant.format(magnitude);
      return withUnit(sign(value, text, signed), format.unit, options);
    }
  }
}

/**
 * A value on an axis tick or a tight label: 1.2M, 48K, 2K, 25%. Compact from
 * 1,000, so ticks of 2,000 and 4,000 read 2K and 4K. Never carries the unit.
 */
export function formatTick(value: number, format: NumberFormat = { style: 'number' }): string {
  if (format.style === 'percent') {
    const pct = value * 100;
    return `${formatNumber(pct, Math.abs(pct) < 10 && pct !== 0 ? 1 : 0)}%`;
  }
  const magnitude = Math.abs(value);
  const text = magnitude >= 1_000 ? compact.format(magnitude) : significant.format(magnitude);
  return sign(value, text, false);
}

// ----------------------------------------------------------------- changes

/** A relative change of a value, one decimal: 0.124 -> "12.4%"; signed, "+12.4%". */
export function formatPercentChange(ratio: number, options: FormatOptions = {}): string {
  return `${formatFixed(ratio * 100, 1, options)}%`;
}

/**
 * A change in a ratio metric, in percentage points with one decimal. The
 * change is given as a fraction: 0.024 -> "2.4 pts"; signed, "+2.4 pts".
 */
export function formatPoints(change: number, options: FormatOptions = {}): string {
  return `${formatFixed(change * 100, 1, options)} pts`;
}

// --------------------------------------------------------------- durations

type DurationUnit = 'seconds' | 'minutes' | 'hours' | 'days';

const MINUTES_PER: Record<DurationUnit, number> = {
  seconds: 1 / 60,
  minutes: 1,
  hours: 60,
  days: 1440,
};

function durationUnit(unit: string | undefined): DurationUnit {
  const u = (unit ?? 'minutes').toLowerCase();
  if (u.startsWith('s')) return 'seconds';
  if (u.startsWith('h')) return 'hours';
  if (u.startsWith('d')) return 'days';
  return 'minutes';
}

function unitWord(unit: DurationUnit, value: number): string {
  return Math.abs(value) === 1 ? unit.slice(0, -1) : unit;
}

/**
 * A duration in a sensible unit: seconds under a minute, minutes under 2
 * hours, hours under 3 days, days beyond. `unit` is what the value is in.
 */
export function formatDuration(
  value: number,
  unit: string | undefined,
  options: FormatOptions = {},
): string {
  const minutes = Math.abs(value * MINUTES_PER[durationUnit(unit)]);
  let shown: DurationUnit;
  if (minutes < 1) shown = 'seconds';
  else if (minutes < 120) shown = 'minutes';
  else if (minutes < 72 * 60) shown = 'hours';
  else shown = 'days';
  const amount = minutes / MINUTES_PER[shown];
  const decimals = shown === 'seconds' || (shown === 'minutes' && amount >= 10) ? 0 : 1;
  const text = formatNumber(Math.sign(value) * amount, decimals, options);
  const rounded = Number(text.replace(/[^\d.]/g, ''));
  return withUnit(text, unitWord(shown, rounded), options);
}

// ------------------------------------------------------------------- dates

const day = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const monthYear = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

// Written out, not from Intl: en-GB's short September is "Sept" in some
// ICU versions and "Sep" in others.
const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** An ISO date or timestamp read as a calendar day, never as a moment. */
function utcDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d || 1));
}

/** An ISO date as "18 July 2024". */
export function formatDay(iso: string): string {
  return day.format(utcDay(iso));
}

/** An ISO date's month as "March 2025". */
export function formatMonth(iso: string): string {
  return monthYear.format(utcDay(`${iso.slice(0, 7)}-01`));
}

/** A week by its first day: "the week of 9 June 2025". */
export function formatWeek(iso: string): string {
  return `the week of ${formatDay(iso)}`;
}

/** An ISO date's quarter as "Q2 2025". */
export function formatQuarter(iso: string): string {
  const d = utcDay(iso);
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`;
}

/** A period by its first day, as prose writes it. */
export function formatPeriod(iso: string, grain: Grain): string {
  switch (grain) {
    case 'day':
      return formatDay(iso);
    case 'week':
      return formatWeek(iso);
    case 'month':
      return formatMonth(iso);
    case 'quarter':
      return formatQuarter(iso);
    case 'year':
      return iso.slice(0, 4);
  }
}

/** A period by its first day, short, for axes and table rows: "9 Jun 2025", "Mar 2025". */
export function formatPeriodShort(iso: string, grain: Grain): string {
  switch (grain) {
    case 'day':
    case 'week': {
      const d = utcDay(iso);
      return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    case 'month': {
      const d = utcDay(iso);
      return `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    }
    case 'quarter':
      return formatQuarter(iso);
    case 'year':
      return iso.slice(0, 4);
  }
}
