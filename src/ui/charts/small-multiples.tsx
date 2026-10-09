'use client';

/**
 * Small multiples: one measure across a few segments, one small panel per
 * segment on a shared scale, so shapes can be compared without a crowded
 * legend. Panels show a line over periods, or bars across the values of a
 * second column. ui-ux-rules §7.
 */
import { scaleLinear, scalePoint } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import type { ReactNode } from 'react';
import { AxisText, ValueGridY, tickLabelWidth } from './axes';
import { ChartFrame, Plot } from './frame';
import type { PlotLayout, Rect } from './frame';
import { formatCompact, formatValue, onMarks } from './format';
import type { ValueFormat } from './format';
import { layoutHBars } from './hbars';
import { AXIS_SIZE, LABEL_SIZE, LINE_HEIGHT, crisp, valueTicks } from './layout';
import { Dot } from './line-chart';
import { AXIS_TEXT, LABEL_TEXT, STRONG_TEXT, seriesColor } from './palette';
import { textWidth, wrapText } from './text';

export type Panel = { name: string; values: Array<number | null> };

export type SmallMultiplesProps = {
  title?: string;
  summary: string;
  /** Periods (for lines) or the values of the second column (for bars). */
  categories: string[];
  panels: Panel[];
  kind: 'line' | 'bars';
  /** What the categories are, for the table header. */
  categoryName?: string;
  format?: ValueFormat;
  /** The panel the sentence is about; the other panels turn grey. */
  emphasis?: string;
  empty?: string;
};

const GUTTER_X = 24;
const GUTTER_Y = 32;
const PLOT_H = 120;

export function SmallMultiples(props: SmallMultiplesProps) {
  const { categories, panels, format = {} } = props;
  const hasValues = panels.some((p) => p.values.some((v) => v !== null));
  return (
    <ChartFrame
      title={props.title}
      summary={props.summary}
      empty={
        hasValues && categories.length > 0
          ? undefined
          : (props.empty ?? 'There are no values to draw.')
      }
      table={{
        caption: props.title ?? props.summary,
        columns: [
          props.categoryName ?? (props.kind === 'line' ? 'Period' : 'Value'),
          ...panels.map((p) => p.name),
        ],
        rows: categories.map((c, i) => [
          c,
          ...panels.map((p) => formatValue(p.values[i] ?? null, format)),
        ]),
      }}
    >
      <Plot
        label={props.summary}
        layout={(width, active) => layoutMultiples(props, width, active)}
      />
    </ChartFrame>
  );
}

function lastIndex(values: Array<number | null>): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
  return -1;
}

export function layoutMultiples(
  props: SmallMultiplesProps,
  width: number,
  active: number | null,
): PlotLayout {
  const { categories, panels, kind, format = {}, emphasis } = props;
  const minPanel = kind === 'line' ? 220 : 260;
  const cols = Math.max(
    1,
    Math.min(panels.length, Math.floor((width + GUTTER_X) / (minPanel + GUTTER_X))),
  );
  const panelW = (width - (cols - 1) * GUTTER_X) / cols;
  const colorOf = (p: number) => {
    const e = emphasis === undefined ? -1 : panels.findIndex((q) => q.name === emphasis);
    return e >= 0 ? seriesColor(p, e) : seriesColor(0);
  };
  const all = panels.flatMap((p) => p.values.filter((v): v is number => v !== null));
  const tick = (v: number) => formatCompact(v, format);

  // Titles: the name, and for lines the last value on the same line if it fits.
  const titles = panels.map((p) => {
    const i = lastIndex(p.values);
    const value = kind === 'line' && i >= 0 ? formatValue(p.values[i] as number, format) : '';
    const valueW = value ? textWidth(value, LABEL_SIZE) + 12 : 0;
    const fits = textWidth(p.name, LABEL_SIZE) + valueW <= panelW;
    const lines = wrapText(p.name, fits ? panelW - valueW : panelW, LABEL_SIZE);
    return { lines, value, valueOwnLine: Boolean(value) && !fits };
  });
  const titleH = (t: (typeof titles)[number]) =>
    (t.lines.length + (t.valueOwnLine ? 1 : 0)) * LINE_HEIGHT + 8;

  // Each panel's body.
  type Body = {
    height: number;
    svg: ReactNode;
    targets: Rect[];
    anchor: (i: number) => { x: number; y: number };
  };
  let bodies: Body[];
  if (kind === 'line') {
    const { domain, ticks } = valueTicks(all, { zero: false, count: 3 });
    const left = tickLabelWidth(ticks, tick) + 8;
    const x = scalePoint<number>()
      .domain(categories.map((_, i) => i))
      .range([left + 6, panelW - 6])
      .padding(categories.length === 1 ? 0.5 : 0);
    const px = (i: number) => x(i) ?? left;
    const y = scaleLinear()
      .domain(domain)
      .range([PLOT_H - 4, 6]);
    const step = categories.length > 1 ? px(1) - px(0) : panelW;
    const path = d3line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => px(i))
      .y((v) => y(v as number));
    const firstW = textWidth(categories[0] ?? '', AXIS_SIZE);
    const lastW = textWidth(categories[categories.length - 1] ?? '', AXIS_SIZE);
    const showLast = categories.length > 1 && firstW + lastW + 16 <= panelW - left;
    bodies = panels.map((p, k) => {
      const end = lastIndex(p.values);
      return {
        height: PLOT_H + 20,
        svg: (
          <>
            <ValueGridY
              ticks={ticks}
              y={y}
              left={left}
              right={panelW}
              labelX={left - 8}
              format={tick}
            />
            <AxisText x={left} y={PLOT_H + 16}>
              {categories[0]}
            </AxisText>
            {showLast && (
              <AxisText x={panelW} y={PLOT_H + 16} anchor="end">
                {categories[categories.length - 1]}
              </AxisText>
            )}
            {active !== null && (
              <line
                x1={crisp(px(active))}
                x2={crisp(px(active))}
                y1={6}
                y2={PLOT_H - 4}
                stroke={AXIS_TEXT}
                strokeWidth={1}
              />
            )}
            <path
              d={path(p.values) ?? ''}
              fill="none"
              stroke={colorOf(k)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {end >= 0 && <Dot x={px(end)} y={y(p.values[end] as number)} color={colorOf(k)} />}
            {active !== null && p.values[active] != null && (
              <Dot x={px(active)} y={y(p.values[active] as number)} color={colorOf(k)} />
            )}
          </>
        ),
        targets: categories.map((_, i) => ({
          x: Math.max(0, px(i) - step / 2),
          y: 0,
          w: Math.min(panelW, px(i) + step / 2) - Math.max(0, px(i) - step / 2),
          h: PLOT_H + 20,
        })),
        anchor: (i) => ({
          x: px(i),
          y: p.values[i] != null ? y(p.values[i] as number) : PLOT_H / 2,
        }),
      };
    });
  } else {
    const { domain } = valueTicks(all, { zero: true });
    bodies = panels.map((p, k) =>
      layoutHBars(
        categories.map((c, i) => ({
          label: c,
          from: 0,
          to: p.values[i] ?? 0,
          color: colorOf(k),
          text: formatValue(p.values[i] ?? null, onMarks(format)),
        })),
        panelW,
        { domain, isActive: (i) => i === active },
      ),
    );
  }

  // Place panels on the grid.
  const placed: Array<{ x: number; y: number; title: number }> = [];
  let y = 0;
  for (let r = 0; r * cols < panels.length; r++) {
    const row = panels.map((_, k) => k).slice(r * cols, r * cols + cols);
    const tH = Math.max(...row.map((k) => titleH(titles[k])));
    const bH = Math.max(...row.map((k) => bodies[k].height));
    row.forEach((k, c) => placed.push({ x: c * (panelW + GUTTER_X), y, title: tH }));
    y += tH + bH + GUTTER_Y;
  }
  const height = y - GUTTER_Y;

  const svg = (
    <>
      {panels.map((p, k) => {
        const at = placed[k];
        const t = titles[k];
        const strong = emphasis === p.name;
        return (
          <g key={p.name} transform={`translate(${at.x},${at.y})`}>
            <text
              fill={strong || emphasis === undefined ? STRONG_TEXT : LABEL_TEXT}
              fontSize={LABEL_SIZE}
              fontWeight={600}
            >
              {t.lines.map((line, i) => (
                <tspan key={i} x={0} y={(i + 1) * LINE_HEIGHT - 4}>
                  {line}
                </tspan>
              ))}
            </text>
            {t.value && (
              <text
                x={t.valueOwnLine ? 0 : panelW}
                y={(t.valueOwnLine ? t.lines.length + 1 : 1) * LINE_HEIGHT - 4}
                textAnchor={t.valueOwnLine ? 'start' : 'end'}
                fill={LABEL_TEXT}
                fontSize={LABEL_SIZE}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {t.value}
              </text>
            )}
            <g transform={`translate(0,${at.title})`}>{bodies[k].svg}</g>
          </g>
        );
      })}
    </>
  );

  return {
    height,
    svg,
    targets: categories.map((_, i) =>
      panels.map((_, k) => {
        const t = bodies[k].targets[i];
        return { x: t.x + placed[k].x, y: t.y + placed[k].y + placed[k].title, w: t.w, h: t.h };
      }),
    ),
    anchor: (i, part) => {
      const k = Math.min(part, panels.length - 1);
      const a = bodies[k].anchor(i);
      return { x: a.x + placed[k].x, y: a.y + placed[k].y + placed[k].title };
    },
    tip: (i) => ({
      title: categories[i],
      rows: panels.map((p, k) => ({
        name: p.name,
        value: formatValue(p.values[i] ?? null, format),
        color: colorOf(k),
        key: kind === 'line' ? ('line' as const) : ('rect' as const),
      })),
    }),
  };
}
