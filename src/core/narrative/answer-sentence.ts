// The answer sentence (analytics-spec §9.1): a template per shape of answer,
// with every number taken from one cell of the result and recorded as a
// fact. A fact is what a reference mark opens: the cell it came from and the
// words for its working paper. Nothing here adds, divides or rounds a value
// into a new number; picking the largest row is choosing a cell, not making
// one.
//
// | Shape                                   | Sentence                                  |
// |-----------------------------------------|-------------------------------------------|
// | totals                                  | Revenue was 1.21M GBP in March 2025.      |
// | totals with a comparison                | Revenue fell 7.4% in March 2025 against   |
// |                                         | February 2025, from 1.31M to 1.21M GBP.   |
// | a series                                | first, last and the highest point         |
// | a series per value of a split           | the highest value in the latest period    |
// | one split                               | the top value and the one after it        |
// | one split with a comparison             | the value that changed the most           |
// | anything else                           | no numbers; the chart or table holds them |

import type { Cell, QueryResult } from '@/core/engine/types';
import { type TimeFacts, isComplete } from '@/core/findings/periods';
import type { Metric, SemanticModel } from '@/core/model/types';
import type { Compiled } from '@/core/query/compile';
import type { QuerySpec } from '@/core/query/spec';
import { formatCompact, formatPercentChange, formatPeriod, formatPoints } from './format';
import { inPeriod, inRange, rangeWords } from './period-words';

/** Where a number in a sentence came from: a row of the result and a column name. */
export interface CellRef {
  row: number;
  column: string;
}

export interface Fact {
  cell: CellRef;
  /** The number as the sentence shows it. */
  text: string;
  /** The working paper's title: "Revenue, Electronics, March 2025". */
  title: string;
}

/** Text, or the index of a fact in `facts`. */
export type Segment = string | { fact: number };

export interface Sentence {
  segments: Segment[];
  facts: Fact[];
}

/**
 * A label inside a sentence: "Return rate" becomes "return rate", while
 * "MRR" and "SLA breach rate" keep their capitals.
 */
export function inSentence(label: string): string {
  return /^[A-Z][a-z]/.test(label) ? label[0].toLowerCase() + label.slice(1) : label;
}

function capital(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

interface Ctx {
  spec: QuerySpec;
  model: SemanticModel;
  compiled: Compiled;
  result: QueryResult;
  /** The days in the data, to leave an incomplete latest period out of a series sentence. */
  time?: TimeFacts | null;
}

export function writeSentence(ctx: Ctx): Sentence {
  const { spec, compiled, result } = ctx;
  const out: Sentence = { segments: [], facts: [] };
  if (result.rowCount === 0) return out;

  const index = new Map(compiled.columns.map((c, i) => [c.name, i]));
  const columnOf = new Map(compiled.columns.map((c) => [c.name, c]));
  const cell = (row: number, column: string): Cell => result.rows[row]?.[index.get(column)!];
  const num = (row: number, column: string): number | null => {
    const v = cell(row, column);
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };
  const metric = (id: string): Metric => ctx.model.metrics.find((m) => m.id === id)!;
  const grain = spec.time?.grain;
  const range = compiled.range;
  const comparison = compiled.comparison;
  const where = range ? inRange(range) : grain ? '' : 'across all the data';
  const against = comparison ? `against ${rangeWords(comparison)}` : '';
  const dimLabel = (id: string) => ctx.model.dimensions.find((d) => d.id === id)?.label ?? id;
  const valueName = (row: number, dim: string): string => {
    const v = cell(row, dim);
    return v === null || v === '' ? `No ${inSentence(dimLabel(dim))}` : String(v);
  };

  const say = (...parts: string[]) => {
    const text = parts.join('');
    const last = out.segments[out.segments.length - 1];
    if (typeof last === 'string') out.segments[out.segments.length - 1] = last + text;
    else out.segments.push(text);
  };
  const title = (row: number, column: string): string => {
    const col = columnOf.get(column)!;
    const m = metric(col.ref);
    const name =
      col.kind === 'change' || col.kind === 'change_pct'
        ? `Change in ${inSentence(m.label)}`
        : col.kind === 'share'
          ? `Share of ${inSentence(m.label)}`
          : col.kind === 'running'
            ? `Running total of ${inSentence(m.label)}`
            : m.label;
    const parts = [name, ...spec.by.map((d) => valueName(row, d))];
    const period = cell(row, 'period');
    if (grain && typeof period === 'string') parts.push(formatPeriod(period, grain));
    else if (col.kind === 'previous' && comparison) parts.push(rangeWords(comparison));
    else if ((col.kind === 'change' || col.kind === 'change_pct') && range && comparison)
      parts.push(`${rangeWords(range)} against ${rangeWords(comparison)}`);
    else if (range) parts.push(rangeWords(range));
    else parts.push('all the data');
    return parts.join(', ');
  };
  const fact = (row: number, column: string, text: string) => {
    out.facts.push({ cell: { row, column }, text, title: title(row, column) });
    out.segments.push({ fact: out.facts.length - 1 });
  };
  const value = (row: number, m: Metric) => {
    fact(row, m.id, formatCompact(num(row, m.id), m.format));
  };

  /** "rose 7.4%" or "fell 2.1 pts", with the change as a fact. */
  const moved = (row: number, m: Metric): boolean => {
    const change = num(row, `${m.id}__change`);
    if (change === null) return false;
    if (change === 0) {
      say(' was unchanged');
      return true;
    }
    say(change > 0 ? ' rose ' : ' fell ');
    const pct = num(row, `${m.id}__change_pct`);
    if (m.format.style === 'percent') fact(row, `${m.id}__change`, formatPoints(Math.abs(change)));
    else if (pct !== null) fact(row, `${m.id}__change_pct`, formatPercentChange(Math.abs(pct)));
    else fact(row, `${m.id}__change`, formatCompact(Math.abs(change), m.format));
    return true;
  };
  const fromTo = (row: number, m: Metric) => {
    say(', from ');
    fact(row, `${m.id}__previous`, formatCompact(num(row, `${m.id}__previous`), m.format));
    say(' to ');
    value(row, m);
  };

  const metrics = spec.metrics.map(metric);
  const first = metrics[0];

  // ------------------------------------------------------------- totals
  if (!grain && spec.by.length === 0) {
    if (spec.compare) {
      metrics.forEach((m, i) => {
        say(i ? ' ' : '', m.label);
        if (!moved(0, m)) {
          say(' was ');
          value(0, m);
          say(' ', [where, against].filter(Boolean).join(' '), '.');
          return;
        }
        say(' ', [where, against].filter(Boolean).join(' '));
        fromTo(0, m);
        say('.');
      });
      return out;
    }
    metrics.forEach((m, i) => {
      const lead = i === 0 ? m.label : inSentence(m.label);
      say(i === 0 ? '' : i === metrics.length - 1 ? ' and ' : ', ', lead, ' was ');
      value(0, m);
    });
    say(' ', where, '.');
    return out;
  }

  // ------------------------------------------------------------- series
  if (grain && spec.by.length === 0) {
    const rows = result.rows.map((_, i) => i).filter((i) => num(i, first.id) !== null);
    if (rows.length === 0) return out;
    const period = (row: number) => inPeriod(String(cell(row, 'period')), grain);
    // A last period that is not complete yet would read as a fall; the
    // sentence ends at the last complete one and says so (C4 also cautions).
    const complete = (row: number) =>
      !ctx.time || isComplete(String(cell(row, 'period')), grain, ctx.time);
    const partial = rows.length > 1 && !complete(rows[rows.length - 1]) ? rows.pop()! : null;
    const [a, z] = [rows[0], rows[rows.length - 1]];
    const notComplete = () => {
      if (partial === null) return;
      say(
        ' ',
        capital(formatPeriod(String(cell(partial, 'period')), grain)),
        ' is not complete yet.',
      );
    };
    if (a === z) {
      say(first.label, ' was ');
      value(a, first);
      say(' ', period(a), '.');
      notComplete();
      return out;
    }
    let top = a;
    for (const i of rows) if (num(i, first.id)! > num(top, first.id)!) top = i;
    say(first.label, ' went from ');
    value(a, first);
    say(' ', period(a), ' to ');
    value(z, first);
    say(' ', period(z), '.');
    if (top !== a && top !== z) {
      say(' The highest was ');
      value(top, first);
      say(' ', period(top), '.');
    }
    notComplete();
    return out;
  }

  // ------------------------------------------- a series for each value
  if (grain && spec.by.length === 1) {
    const dim = spec.by[0];
    const periods = result.rows.map((r) => r[index.get('period')!]).filter((p) => p !== null);
    const latest = periods.map(String).sort().at(-1);
    let top: number | null = null;
    result.rows.forEach((r, i) => {
      if (String(r[index.get('period')!]) !== latest || num(i, first.id) === null) return;
      if (top === null || num(i, first.id)! > num(top, first.id)!) top = i;
    });
    if (top === null || !latest) return out;
    say(capital(inPeriod(latest, grain)), ', ', valueName(top, dim), ' had the highest ');
    say(inSentence(first.label), ', at ');
    value(top, first);
    say('.');
    return out;
  }

  // -------------------------------------------------------- one split
  if (!grain && spec.by.length === 1 && metrics.length === 1) {
    const dim = spec.by[0];
    const rows = result.rows.map((_, i) => i).filter((i) => num(i, first.id) !== null);
    if (rows.length === 0) return out;

    if (spec.compare) {
      let top: number | null = null;
      for (const i of rows) {
        const c = num(i, `${first.id}__change`);
        if (c === null) continue;
        if (top === null || Math.abs(c) > Math.abs(num(top, `${first.id}__change`)!)) top = i;
      }
      if (top !== null && num(top, `${first.id}__change`) !== 0) {
        say(`The largest change in ${inSentence(first.label)} `);
        say([where, against].filter(Boolean).join(' '), ' was in ', valueName(top, dim));
        say(', which');
        moved(top, first);
        fromTo(top, first);
        say('.');
        return out;
      }
    }

    if (rows.length === 1) {
      say(valueName(rows[0], dim), ' had ', inSentence(first.label), ' of ');
      value(rows[0], first);
      say(' ', where, '.');
      return out;
    }
    // Sorted on the metric, the first row is the end that was asked for;
    // otherwise the largest value is found among the rows.
    const sorted = spec.sort?.by === first.id;
    const dir = sorted ? spec.sort!.dir : 'desc';
    let top = rows[0];
    if (!sorted) for (const i of rows) if (num(i, first.id)! > num(top, first.id)!) top = i;
    say(valueName(top, dim), ` had the ${dir === 'desc' ? 'highest' : 'lowest'} `);
    say(inSentence(first.label), where ? ` ${where}` : '', ', at ');
    value(top, first);
    if (sorted) {
      say(', followed by ', valueName(rows[1], dim), ' at ');
      value(rows[1], first);
    }
    say('.');
    return out;
  }

  // --------------------------------------------------------- the rest
  const labels = metrics.map((m, i) => (i ? inSentence(m.label) : m.label));
  const by = spec.by.map((d) => inSentence(dimLabel(d)));
  say(
    `Here is ${inSentence(labels.join(' and '))}`,
    by.length ? ` by ${by.join(' and ')}` : '',
    grain ? ` for each ${grain}` : '',
    where ? ` ${where}` : '',
    '.',
  );
  return out;
}
