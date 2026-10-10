'use client';

// The chart plan (core/narrative/chart.ts) turned into chart props. Every
// value drawn is a cell of the result; nothing is added up here.

import type { Answer } from '@/core/ask/answer';
import type { Cell } from '@/core/engine/types';
import type { SemanticModel } from '@/core/model/types';
import { cellKey } from '@/core/narrative/chart';
import { formatPercentChange, formatPeriodShort, formatPoints } from '@/core/narrative/format';
import {
  ChartTable,
  LineChart,
  RankedBars,
  SmallMultiples,
  type BarItem,
  type TableView,
} from '@/ui/charts';
import { cellText, chartFormat, header, isNumeric, metricOf } from './cells';

export function resultTable(answer: Answer, model: SemanticModel, caption: string): TableView {
  const cols = answer.compiled.columns;
  return {
    caption,
    columns: cols.map((c) => header(c, answer, model)),
    rows: answer.result.rows.map((row) =>
      row.map((cell, i) => cellText(cols[i], cell, answer, model)),
    ),
    numeric: cols.slice(1).map(isNumeric),
  };
}

export function AnswerChart({
  answer,
  model,
  summary,
  emphasis,
  markPeriod,
}: {
  answer: Answer;
  model: SemanticModel;
  /** One sentence: the chart's accessible name. */
  summary: string;
  /** The split value the sentence is about. */
  emphasis?: string;
  /** A period the sentence names, labelled on a line. */
  markPeriod?: string;
}) {
  const { chart: plan, compiled, result, spec } = answer;
  const index = (name: string) => compiled.columns.findIndex((c) => c.name === name);
  const col = (name: string) => compiled.columns[index(name)];
  const num = (cell: Cell) => (typeof cell === 'number' && Number.isFinite(cell) ? cell : null);
  const grain = spec.time?.grain ?? 'month';
  const metric = metricOf(model, spec.metrics[0])!;
  const format = chartFormat(metric.format);
  const label = (name: string) => header(col(name), answer, model);
  const splitName = (value: string) => value || 'No value';

  const periods = () => {
    const i = index('period');
    const seen: string[] = [];
    for (const row of result.rows) {
      const p = String(row[i]);
      if (!seen.includes(p)) seen.push(p);
    }
    return seen.sort();
  };
  /** The value of `column` in each of `keys` along `x`, for rows matching the split. */
  const valuesAlong = (
    x: string,
    keys: string[],
    column: string,
    split?: { dimension: string; value: string },
  ) =>
    keys.map((k) => {
      const row = result.rows.find(
        (r) =>
          cellKey(r[index(x)]) === k &&
          (!split || cellKey(r[index(split.dimension)]) === split.value),
      );
      return row ? num(row[index(column)]) : null;
    });

  switch (plan.form) {
    case 'figures':
    case 'waterfall':
      return null;
    case 'table':
      return <ChartTable table={resultTable(answer, model, summary)} />;
    case 'line': {
      const keys = periods();
      return (
        <LineChart
          summary={summary}
          categories={keys.map((p) => formatPeriodShort(p, grain))}
          categoryName={header(col('period'), answer, model)}
          series={plan.series.map((s) => ({
            name: s.split ? splitName(s.split.value) : label(s.column),
            values: valuesAlong('period', keys, s.column, s.split),
          }))}
          format={format}
          emphasis={emphasis}
          mark={markPeriod === undefined ? undefined : keys.indexOf(markPeriod)}
        />
      );
    }
    case 'bars': {
      const ci = index(plan.category);
      const vi = index(plan.value);
      const items: BarItem[] = [];
      for (const key of plan.order) {
        const row = result.rows.find((r) => cellKey(r[ci]) === key);
        const value = row ? num(row[vi]) : null;
        if (!row || value === null) continue;
        let detail: string | undefined;
        if (plan.labelChange) {
          const change = num(row[index(`${metric.id}__change`)]);
          const pct = num(row[index(`${metric.id}__change_pct`)]);
          if (metric.format.style === 'percent' && change !== null)
            detail = formatPoints(change, { signed: true });
          else if (pct !== null) detail = formatPercentChange(pct, { signed: true });
        }
        items.push({ label: splitName(key), value, detail });
      }
      return (
        <RankedBars
          summary={summary}
          items={items}
          ordered={plan.ordered}
          categoryName={label(plan.category)}
          valueName={label(plan.value)}
          format={format}
          emphasis={emphasis}
        />
      );
    }
    case 'small_multiples': {
      const keys = plan.kind === 'line' ? periods() : plan.order;
      const categories =
        plan.kind === 'line' ? keys.map((p) => formatPeriodShort(p, grain)) : keys.map(splitName);
      const panelFormat = (column: string) =>
        chartFormat(metricOf(model, col(column).ref)?.format ?? { style: 'number' });
      return (
        <SmallMultiples
          summary={summary}
          kind={plan.kind}
          categories={categories}
          categoryName={label(plan.x)}
          panels={plan.panels.map((p) => ({
            name: p.split ? splitName(p.split.value) : label(p.column),
            values: valuesAlong(plan.x, keys, p.column, p.split),
          }))}
          format={plan.panels.length ? panelFormat(plan.panels[0].column) : format}
          emphasis={emphasis}
        />
      );
    }
  }
}
