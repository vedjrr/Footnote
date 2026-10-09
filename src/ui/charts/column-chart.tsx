'use client';

/**
 * Columns: compare a measure across a few categories or periods, up to four
 * series side by side. Unordered categories whose names will not fit under
 * their column are drawn as horizontal bars instead, so a name is never cut
 * or turned on its side. ui-ux-rules §7.
 */
import { scaleBand, scaleLinear } from 'd3-scale';
import { AxisText, CategoryLabels, ValueGridY, tickLabelWidth } from './axes';
import { ChartFrame, Plot } from './frame';
import type { PlotLayout, Rect } from './frame';
import { formatCompact, formatValue } from './format';
import type { ValueFormat } from './format';
import { layoutHBars } from './hbars';
import {
  AXIS_SIZE,
  BAR_MAX,
  GAP,
  LABEL_SIZE,
  LINE_HEIGHT,
  barPath,
  thinLabels,
  valueTicks,
} from './layout';
import { legendFor } from './line-chart';
import type { Series } from './line-chart';
import { FALL, HOVER, RISE, LABEL_TEXT, MAX_SERIES, STRONG_TEXT, seriesColor } from './palette';
import { textWidth, wrapText } from './text';

export type ColumnChartProps = {
  title?: string;
  summary: string;
  categories: string[];
  series: Series[];
  /** What the categories are, for the table header. Default "Value". */
  categoryName?: string;
  format?: ValueFormat;
  /** Categories are periods or otherwise ordered: labels thin out rather than wrap. */
  ordered?: boolean;
  /** One series: the category the sentence is about; other columns turn grey. */
  emphasisCategory?: string;
  /** Several series: the series the sentence is about; the others turn grey. */
  emphasisSeries?: string;
  /** One series of changes: rises in series blue, falls in series orange. */
  change?: boolean;
  height?: number;
  empty?: string;
};

export function ColumnChart(props: ColumnChartProps) {
  const { categories, series, format = {}, emphasisSeries, emphasisCategory } = props;
  if (series.length > MAX_SERIES) {
    throw new Error(`ColumnChart shows at most ${MAX_SERIES} series`);
  }
  const seriesEmphasis =
    emphasisSeries === undefined ? undefined : series.findIndex((s) => s.name === emphasisSeries);
  const categoryEmphasis =
    emphasisCategory === undefined ? -1 : categories.indexOf(emphasisCategory);
  const colorOf = (k: number, i: number) => {
    if (props.change && series.length === 1) return (series[0].values[i] ?? 0) >= 0 ? RISE : FALL;
    if (series.length === 1 && categoryEmphasis >= 0) return seriesColor(i, categoryEmphasis);
    return seriesColor(k, seriesEmphasis);
  };
  const legend = legendFor(
    series.map((s) => s.name),
    series.map((_, k) => seriesColor(k, seriesEmphasis)),
    seriesEmphasis,
    'rect',
  );
  const hasValues = series.some((s) => s.values.some((v) => v !== null));
  return (
    <ChartFrame
      title={props.title}
      summary={props.summary}
      legend={legend}
      empty={
        hasValues && categories.length > 0
          ? undefined
          : (props.empty ?? 'There are no values to draw.')
      }
      table={{
        caption: props.title ?? props.summary,
        columns: [props.categoryName ?? 'Value', ...series.map((s) => s.name)],
        rows: categories.map((c, i) => [
          c,
          ...series.map((s) => formatValue(s.values[i] ?? null, format)),
        ]),
      }}
    >
      <Plot
        label={props.summary}
        defaultIndex={categoryEmphasis >= 0 ? categoryEmphasis : undefined}
        layout={(width, active) => layoutColumns(props, colorOf, categoryEmphasis, width, active)}
      />
    </ChartFrame>
  );
}

export function layoutColumns(
  props: ColumnChartProps,
  colorOf: (k: number, i: number) => string,
  categoryEmphasis: number,
  width: number,
  active: number | null,
): PlotLayout {
  const { categories, series, format = {}, ordered } = props;
  const n = series.length;
  const tip = (i: number) => ({
    title: categories[i],
    rows: series.map((s, k) => ({
      name: n > 1 ? s.name : undefined,
      value: formatValue(s.values[i] ?? null, format),
      color: n > 1 ? colorOf(k, i) : undefined,
      key: 'rect' as const,
    })),
  });

  const { domain, ticks } = valueTicks(
    series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
    { zero: true },
  );
  const tick = (v: number) => formatCompact(v, format);
  const left = tickLabelWidth(ticks, tick) + 8;
  const band = scaleBand<number>()
    .domain(categories.map((_, i) => i))
    .range([left, width])
    .paddingInner(0.2)
    .paddingOuter(0.1);
  const step = band.step();
  const labelWidth = Math.max(step - 4, 8);
  const wrapped = categories.map((c) => wrapText(c, labelWidth, AXIS_SIZE));
  const maxLines = Math.max(1, ...wrapped.map((l) => l.length));

  // Unordered names that need more than two lines, or a word broken in the
  // middle, are drawn as rows instead: one bar per series, grouped.
  const brokenWord = categories.some((c) =>
    c.split(/\s+/).some((word) => textWidth(word, AXIS_SIZE) > labelWidth),
  );
  if (!ordered && (maxLines > 2 || brokenWord)) {
    const rows = categories.flatMap((c, i) =>
      series.map((s, k) => ({
        label: k === 0 ? c : '',
        from: 0,
        to: s.values[i] ?? 0,
        color: colorOf(k, i),
        text: formatValue(s.values[i] ?? null, format),
        strong: n === 1 && i === categoryEmphasis,
        tight: k > 0,
      })),
    );
    const l = layoutHBars(rows, width, { isActive: (r) => Math.floor(r / n) === active });
    return {
      height: l.height,
      svg: l.svg,
      targets: categories.map((_, i) => {
        const first = l.targets[i * n] as Rect;
        const last = l.targets[i * n + n - 1] as Rect;
        return { x: 0, y: first.y, w: width, h: last.y + last.h - first.y };
      }),
      anchor: (i) => l.anchor(i * n),
      tip,
    };
  }

  const labelLines = ordered ? 1 : maxLines;
  const height = (props.height ?? 220) + (labelLines - 1) * LINE_HEIGHT;
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const hasNegative = values.some((v) => v < 0);

  // Values on the caps: the emphasised column, or every column of a single
  // series when each value fits its column.
  const capText = (k: number, i: number) => {
    const v = series[k].values[i] as number;
    return (props.change && v > 0 ? '+' : '') + formatCompact(v, format);
  };
  const labelAll =
    n === 1 &&
    categoryEmphasis < 0 &&
    categories.length <= 12 &&
    categories.every(
      (_, i) => series[0].values[i] === null || textWidth(capText(0, i), LABEL_SIZE) <= step - 2,
    );
  const labelled = (k: number, i: number) =>
    series[k].values[i] !== null && (labelAll || (categoryEmphasis === i && n === 1));

  const top = 20;
  const labelBand = labelLines * LINE_HEIGHT + 8;
  const bottom = height - labelBand - (hasNegative ? 18 : 0);
  const y = scaleLinear().domain(domain).range([bottom, top]);

  const barW = Math.min(BAR_MAX, Math.max(2, (band.bandwidth() - (n - 1) * GAP) / n));
  const groupW = n * barW + (n - 1) * GAP;
  const groupX = (i: number) => (band(i) ?? 0) + (band.bandwidth() - groupW) / 2;
  const center = (i: number) => (band(i) ?? 0) + band.bandwidth() / 2;
  const shown = ordered ? thinLabels(categories, step) : categories.map((_, i) => i);

  const svg = (
    <>
      {active !== null && (
        <rect
          x={center(active) - step / 2}
          y={top}
          width={step}
          height={bottom - top}
          fill={HOVER}
        />
      )}
      <ValueGridY ticks={ticks} y={y} left={left} right={width} labelX={left - 8} format={tick} />
      {categories.map((_, i) =>
        series.map((s, k) => {
          const v = s.values[i];
          if (v === null || v === undefined || v === 0) return null;
          const x = groupX(i) + k * (barW + GAP);
          const y0 = y(0);
          const y1 = y(v);
          return (
            <path
              key={`${i}-${k}`}
              d={barPath(x, Math.min(y0, y1), barW, Math.abs(y1 - y0), v > 0 ? 'top' : 'bottom')}
              fill={colorOf(k, i)}
            />
          );
        }),
      )}
      {categories.map((_, i) =>
        series.map((s, k) => {
          if (!labelled(k, i)) return null;
          const v = s.values[i] as number;
          const x = groupX(i) + k * (barW + GAP) + barW / 2;
          return (
            <text
              key={`l${i}-${k}`}
              x={x}
              y={v >= 0 ? y(v) - 6 : y(v) + 14}
              textAnchor="middle"
              fill={i === categoryEmphasis ? STRONG_TEXT : LABEL_TEXT}
              fontWeight={i === categoryEmphasis ? 600 : 400}
              fontSize={LABEL_SIZE}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {capText(k, i)}
            </text>
          );
        }),
      )}
      {ordered ? (
        <CategoryLabels labels={categories} shown={shown} x={center} y={height - 6} width={width} />
      ) : (
        categories.map((_, i) => (
          <g key={`x${i}`}>
            {wrapped[i].map((line, k) => (
              <AxisText
                key={k}
                x={center(i)}
                y={height - labelBand + 4 + (k + 1) * LINE_HEIGHT - 4}
                anchor="middle"
              >
                {line}
              </AxisText>
            ))}
          </g>
        ))
      )}
    </>
  );

  return {
    height,
    svg,
    targets: categories.map((_, i) => ({
      x: center(i) - Math.max(step, 24) / 2,
      y: top,
      w: Math.max(step, 24),
      h: height - top,
    })),
    anchor: (i) => {
      const vals = series
        .map((s) => s.values[i])
        .filter((v): v is number => v !== null && v !== undefined);
      return { x: center(i), y: vals.length ? y(Math.max(0, ...vals)) : bottom };
    },
    tip,
  };
}
