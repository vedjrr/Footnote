'use client';

/**
 * Line: a measure over time, up to four series. ui-ux-rules §7.
 */
import { line as d3line } from 'd3-shape';
import { scaleLinear, scalePoint } from 'd3-scale';
import { CategoryLabels, ValueGridY, tickLabelWidth } from './axes';
import { ChartFrame, Plot } from './frame';
import type { LegendItem, PlotLayout } from './frame';
import { formatCompact, formatValue } from './format';
import type { ValueFormat } from './format';
import type { Box, Segment } from './layout';
import {
  placeLabel,
  DOT_R,
  LABEL_SIZE,
  RING,
  crisp,
  spreadLabels,
  thinLabels,
  valueTicks,
} from './layout';
import {
  AXIS_TEXT,
  CONTEXT,
  LABEL_TEXT,
  MAX_SERIES,
  STRONG_TEXT,
  SURFACE,
  seriesColor,
} from './palette';
import { textWidth } from './text';

/** Room from a line end to its label: the dot, its ring and a leader. */
const END_GAP = 18;

export type Series = { name: string; values: Array<number | null> };

export type LineChartProps = {
  title?: string;
  summary: string;
  /** Period labels, in order. One per value in each series. */
  categories: string[];
  series: Series[];
  /** What the categories are, for the table header. Default "Period". */
  categoryName?: string;
  format?: ValueFormat;
  /** Name of the series the sentence is about; the others turn grey. */
  emphasis?: string;
  /** Index of the point the sentence is about; it gets a dot and a label. */
  mark?: number;
  /** Start the value axis at zero. Default false for lines. */
  zero?: boolean;
  height?: number;
  empty?: string;
};

export function LineChart(props: LineChartProps) {
  const { categories, series, format = {}, emphasis, categoryName = 'Period' } = props;
  if (series.length > MAX_SERIES) {
    throw new Error(
      `LineChart shows at most ${MAX_SERIES} series; show the top three and "Other", or small multiples`,
    );
  }
  const emphasisIndex =
    emphasis === undefined ? undefined : series.findIndex((s) => s.name === emphasis);
  const colors = series.map((_, i) => seriesColor(i, emphasisIndex));
  const hasValues = series.some((s) => s.values.some((v) => v !== null));
  const legend = legendFor(
    series.map((s) => s.name),
    colors,
    emphasisIndex,
    'line',
  );
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
        columns: [categoryName, ...series.map((s) => s.name)],
        rows: categories.map((c, i) => [
          c,
          ...series.map((s) => formatValue(s.values[i] ?? null, format)),
        ]),
      }}
    >
      <Plot
        label={props.summary}
        defaultIndex={props.mark}
        layout={(width, active) => layoutLine(props, colors, emphasisIndex, width, active)}
      />
    </ChartFrame>
  );
}

function lastIndex(values: Array<number | null>): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
  return -1;
}

export function layoutLine(
  props: LineChartProps,
  colors: string[],
  emphasisIndex: number | undefined,
  width: number,
  active: number | null,
): PlotLayout {
  const { categories, series, format = {}, mark } = props;
  const height = props.height ?? 240;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { domain, ticks } = valueTicks(all, { zero: props.zero ?? false });
  const tick = (v: number) => formatCompact(v, format);

  // End labels: the last value of each series, beside its line end, with
  // the series name when there are several and the names fit.
  const endValues = series.map((s) => {
    const i = lastIndex(s.values);
    return { i, value: i >= 0 ? formatCompact(s.values[i] as number, format) : '' };
  });
  const widest = (texts: string[]) => Math.max(0, ...texts.map((t) => textWidth(t, LABEL_SIZE)));
  const named = series.map((s, k) => `${s.name} ${endValues[k].value}`);
  const withNames = series.length > 1 && widest(named) + END_GAP < width * 0.3;
  const ends = endValues.map((e, k) => ({ i: e.i, text: withNames ? named[k] : e.value }));
  const endWidth = widest(ends.map((e) => e.text));
  const showEnds = endWidth + END_GAP < width * 0.3;

  const top = 12;
  const bottom = height - 24;
  const left = tickLabelWidth(ticks, tick) + 8;
  const right = width - (showEnds ? endWidth + END_GAP : DOT_R + RING);

  const x = scalePoint<number>()
    .domain(categories.map((_, i) => i))
    .range([left + DOT_R + RING, right])
    .padding(categories.length === 1 ? 0.5 : 0);
  const y = scaleLinear().domain(domain).range([bottom, top]);
  const px = (i: number) => x(i) ?? left;

  const path = d3line<number | null>()
    .defined((v) => v !== null)
    .x((_, i) => px(i))
    .y((v) => y(v as number));

  const step = categories.length > 1 ? px(1) - px(0) : width;
  const shown = thinLabels(categories, step);

  const endYs = showEnds
    ? spreadLabels(
        ends.map((e, k) => (e.i >= 0 ? y(series[k].values[e.i] as number) : top)),
        { top: 0, bottom: height - 20 },
      )
    : null;

  // Draw context series first so the emphasised one sits on top.
  const order = series
    .map((_, i) => i)
    .sort((a, b) => Number(a === emphasisIndex) - Number(b === emphasisIndex));
  const focusSeries = emphasisIndex !== undefined && emphasisIndex >= 0 ? emphasisIndex : 0;

  const endBoxes: Box[] = endYs
    ? ends.flatMap((e, k) =>
        e.i < 0
          ? []
          : [
              {
                x: px(e.i) + END_GAP,
                y: endYs[k] - 8,
                w: textWidth(e.text, LABEL_SIZE),
                h: 16,
              },
            ],
      )
    : [];
  const segments: Segment[] = series.flatMap((s) =>
    s.values.slice(1).flatMap((v, i) => {
      const u = s.values[i];
      return u === null || v === null ? [] : [[px(i), y(u), px(i + 1), y(v)] as Segment];
    }),
  );

  // The point the sentence is about: a label placed clear of every line.
  const markLabel = (() => {
    if (mark === undefined || mark < 0 || mark >= categories.length) return null;
    // The line end already carries its value.
    if (showEnds && mark === ends[focusSeries]?.i) return null;
    const v = series[focusSeries]?.values[mark];
    if (v === null || v === undefined) return null;
    const text = formatCompact(v, format);
    const box = placeLabel({ x: px(mark), y: y(v) }, textWidth(text, LABEL_SIZE), 14, {
      bounds: { x: left, y: 0, w: width - left, h: bottom },
      lines: segments,
      avoid: endBoxes,
    });
    return box ? { x: box.x, y: box.y + 11, text } : null;
  })();

  const svg = (
    <>
      <ValueGridY ticks={ticks} y={y} left={left} right={right} labelX={left - 8} format={tick} />
      <CategoryLabels labels={categories} shown={shown} x={px} y={height - 6} width={width} />
      {active !== null && (
        <line
          x1={crisp(px(active))}
          x2={crisp(px(active))}
          y1={top}
          y2={bottom}
          stroke={AXIS_TEXT}
          strokeWidth={1}
        />
      )}
      {order.map((k) => (
        <path
          key={series[k].name}
          d={path(series[k].values) ?? ''}
          fill="none"
          stroke={colors[k]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {order.map((k) => {
        const e = ends[k];
        if (e.i < 0) return null;
        return <Dot key={k} x={px(e.i)} y={y(series[k].values[e.i] as number)} color={colors[k]} />;
      })}
      {mark !== undefined && series[focusSeries]?.values[mark] != null && (
        <Dot
          x={px(mark)}
          y={y(series[focusSeries].values[mark] as number)}
          color={colors[focusSeries]}
        />
      )}
      {active !== null &&
        order.map((k) => {
          const v = series[k].values[active];
          return v === null || v === undefined ? null : (
            <Dot key={`a${k}`} x={px(active)} y={y(v)} color={colors[k]} />
          );
        })}
      {endYs &&
        ends.map((e, k) => {
          if (e.i < 0) return null;
          const dotY = y(series[k].values[e.i] as number);
          // A leader from the dot when the label had to move off its line.
          return Math.abs(endYs[k] - dotY) > 3 ? (
            <line
              key={`leader${k}`}
              x1={px(e.i) + DOT_R + RING}
              y1={dotY}
              x2={px(e.i) + END_GAP - 2}
              y2={endYs[k]}
              stroke={AXIS_TEXT}
              strokeWidth={1}
            />
          ) : null;
        })}
      {endYs &&
        ends.map((e, k) =>
          e.i < 0 ? null : (
            <text
              key={k}
              x={px(e.i) + END_GAP}
              y={endYs[k] + 4}
              fill={k === emphasisIndex ? STRONG_TEXT : LABEL_TEXT}
              fontWeight={k === emphasisIndex ? 600 : 400}
              fontSize={LABEL_SIZE}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {e.text}
            </text>
          ),
        )}
      {markLabel && (
        <text
          x={markLabel.x}
          y={markLabel.y}
          fill={STRONG_TEXT}
          fontSize={LABEL_SIZE}
          fontWeight={600}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {markLabel.text}
        </text>
      )}
    </>
  );

  const half = step / 2;
  return {
    height,
    svg,
    targets: categories.map((_, i) => ({
      x: Math.max(0, px(i) - half),
      y: 0,
      w: Math.min(width, px(i) + half) - Math.max(0, px(i) - half),
      h: height,
    })),
    anchor: (i) => {
      const vals = series
        .map((s) => s.values[i])
        .filter((v): v is number => v !== null && v !== undefined);
      return { x: px(i), y: vals.length ? y(Math.max(...vals)) : top };
    },
    tip: (i) => ({
      title: categories[i],
      rows: series.map((s, k) => ({
        name: series.length > 1 ? s.name : undefined,
        value: formatValue(s.values[i] ?? null, format),
        color: series.length > 1 ? colors[k] : undefined,
        key: 'line' as const,
      })),
    }),
  };
}

export function Dot({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={DOT_R + RING} fill={SURFACE} />
      <circle cx={x} cy={y} r={DOT_R} fill={color} />
    </g>
  );
}

/**
 * Legend entries. With emphasis, the context series share one grey entry,
 * because one grey cannot tell them apart: "West" and "East, North, South".
 */
export function legendFor(
  names: string[],
  colors: string[],
  emphasisIndex: number | undefined,
  key: 'line' | 'rect',
): LegendItem[] {
  if (emphasisIndex === undefined || emphasisIndex < 0) {
    return names.map((name, i) => ({ name, color: colors[i], key }));
  }
  const others = names.filter((_, i) => i !== emphasisIndex);
  return [
    { name: names[emphasisIndex], color: colors[emphasisIndex], key },
    ...(others.length ? [{ name: others.join(', '), color: CONTEXT, key }] : []),
  ];
}
