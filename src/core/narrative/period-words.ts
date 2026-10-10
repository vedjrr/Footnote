// A range of days in words, for answer sentences, interpretation tags and
// working paper titles: "March 2025", "April to September 2025", "2024",
// "1 to 14 June 2025" is written in full as "1 June 2025 to 14 June 2025".

import { periodEnd, periodStart, type DayRange } from '@/core/findings/periods';
import type { Grain } from '@/core/model/types';
import { formatDay, formatMonth, formatPeriod, formatQuarter } from './format';

/** The one whole period a range is, or null. Checked from the largest grain down. */
function wholePeriod(range: DayRange): Grain | null {
  for (const grain of ['year', 'quarter', 'month', 'day'] as const) {
    if (periodStart(range.from, grain) === range.from && periodEnd(range.from, grain) === range.to)
      return grain;
  }
  return null;
}

/** True when the range starts on a month's first day and ends on a month's last day. */
function wholeMonths(range: DayRange): boolean {
  return (
    periodStart(range.from, 'month') === range.from && periodEnd(range.to, 'month') === range.to
  );
}

/** "March 2025" without the year. */
function monthName(iso: string): string {
  return formatMonth(iso).replace(/ \d{4}$/, '');
}

/** The range as a name: "March 2025", "Q2 2025", "April to September 2025". */
export function rangeWords(range: DayRange): string {
  const whole = wholePeriod(range);
  if (whole === 'year') return range.from.slice(0, 4);
  if (whole === 'quarter') return formatQuarter(range.from);
  if (whole === 'month') return formatMonth(range.from);
  if (whole === 'day') return formatDay(range.from);
  if (wholeMonths(range)) {
    const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
    return `${sameYear ? monthName(range.from) : formatMonth(range.from)} to ${formatMonth(range.to)}`;
  }
  return `${formatDay(range.from)} to ${formatDay(range.to)}`;
}

/** The range with its preposition, for a sentence: "in March 2025", "from April to September 2025". */
export function inRange(range: DayRange): string {
  const whole = wholePeriod(range);
  if (whole === 'day') return `on ${formatDay(range.from)}`;
  if (whole) return `in ${rangeWords(range)}`;
  return `from ${rangeWords(range)}`;
}

/** One period of a series, with its preposition: "in March 2025", "on 18 July 2024". */
export function inPeriod(iso: string, grain: Grain): string {
  return `${grain === 'day' ? 'on' : 'in'} ${formatPeriod(iso, grain)}`;
}
