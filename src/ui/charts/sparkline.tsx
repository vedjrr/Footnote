'use client';

/**
 * Sparkline: the recent shape of one measure, beside its figure. Context
 * grey with the latest point in series blue. No axes; it is one tab stop
 * and the arrow keys read each value, like every other chart.
 */
import { scaleLinear, scalePoint } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { Plot } from './frame';
import { formatValue } from './format';
import type { ValueFormat } from './format';
import { DOT_R, RING, crisp, valueTicks } from './layout';
import { Dot } from './line-chart';
import { AXIS_TEXT, CONTEXT, EMPHASIS } from './palette';

export type SparklineProps = {
  /** One sentence: what changed, over which periods. The accessible name. */
  summary: string;
  labels: string[];
  values: Array<number | null>;
  format?: ValueFormat;
  /** Width before the browser measures; the line fills its container. */
  width?: number;
  height?: number;
};

export function Sparkline({
  summary,
  labels,
  values,
  format = {},
  width = 120,
  height = 32,
}: SparklineProps) {
  return (
    <div className="w-full min-w-16">
      <Plot
        label={summary}
        fallbackWidth={width}
        layout={(w, active) => {
          const pad = DOT_R + RING;
          const { domain } = valueTicks(
            values.filter((v): v is number => v !== null),
            { zero: false, count: 2 },
          );
          const x = scalePoint<number>()
            .domain(values.map((_, i) => i))
            .range([pad, w - pad]);
          const y = scaleLinear()
            .domain(domain)
            .range([height - pad, pad]);
          const px = (i: number) => x(i) ?? pad;
          const path = d3line<number | null>()
            .defined((v) => v !== null)
            .x((_, i) => px(i))
            .y((v) => y(v as number));
          let last = -1;
          for (let i = values.length - 1; i >= 0 && last < 0; i--) if (values[i] !== null) last = i;
          const step = values.length > 1 ? px(1) - px(0) : w;
          return {
            height,
            svg: (
              <>
                {active !== null && (
                  <line
                    x1={crisp(px(active))}
                    x2={crisp(px(active))}
                    y1={0}
                    y2={height}
                    stroke={AXIS_TEXT}
                    strokeWidth={1}
                  />
                )}
                <path
                  d={path(values) ?? ''}
                  fill="none"
                  stroke={CONTEXT}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {last >= 0 && <Dot x={px(last)} y={y(values[last] as number)} color={EMPHASIS} />}
                {active !== null && values[active] !== null && active !== last && (
                  <Dot x={px(active)} y={y(values[active] as number)} color={CONTEXT} />
                )}
              </>
            ),
            targets: values.map((_, i) => ({ x: px(i) - step / 2, y: 0, w: step, h: height })),
            anchor: (i) => ({
              x: px(i),
              y: values[i] !== null ? y(values[i] as number) : height / 2,
            }),
            tip: (i) => ({
              title: labels[i] ?? '',
              rows: [{ value: formatValue(values[i] ?? null, format) }],
            }),
          };
        }}
      />
    </div>
  );
}
