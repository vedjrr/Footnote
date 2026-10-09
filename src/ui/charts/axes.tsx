/**
 * Axis pieces drawn inside a chart's SVG. Solid 1 px lines in `--rule`,
 * text in `--ink-3` at caption size with tabular digits (ui-ux-rules §7).
 */
import type { ReactNode } from 'react';
import { AXIS_SIZE, crisp } from './layout';
import { AXIS_TEXT, GRID } from './palette';
import { textWidth } from './text';

export function AxisText({
  x,
  y,
  anchor = 'start',
  children,
}: {
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
  children: ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fill={AXIS_TEXT}
      fontSize={AXIS_SIZE}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {children}
    </text>
  );
}

/** Horizontal gridlines with their labels at the left edge. */
export function ValueGridY({
  ticks,
  y,
  left,
  right,
  labelX,
  format,
}: {
  ticks: number[];
  y: (v: number) => number;
  left: number;
  right: number;
  labelX: number;
  format: (v: number) => string;
}) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={left}
            x2={right}
            y1={crisp(y(t))}
            y2={crisp(y(t))}
            stroke={GRID}
            strokeWidth={1}
          />
          <AxisText x={labelX} y={y(t) + 4} anchor="end">
            {format(t)}
          </AxisText>
        </g>
      ))}
    </g>
  );
}

/** Vertical gridlines with their labels underneath, for horizontal bars. */
export function ValueGridX({
  ticks,
  x,
  top,
  bottom,
  format,
  width,
}: {
  ticks: number[];
  x: (v: number) => number;
  top: number;
  bottom: number;
  format: (v: number) => string;
  width: number;
}) {
  return (
    <g>
      {ticks.map((t) => {
        const px = x(t);
        const label = format(t);
        const w = textWidth(label, AXIS_SIZE);
        const lx = Math.max(w / 2, Math.min(width - w / 2, px));
        return (
          <g key={t}>
            <line
              x1={crisp(px)}
              x2={crisp(px)}
              y1={top}
              y2={bottom}
              stroke={GRID}
              strokeWidth={1}
            />
            <AxisText x={lx} y={bottom + 14} anchor="middle">
              {label}
            </AxisText>
          </g>
        );
      })}
    </g>
  );
}

/** Width of the widest tick label, for the left margin. */
export function tickLabelWidth(ticks: number[], format: (v: number) => string): number {
  return Math.max(0, ...ticks.map((t) => textWidth(format(t), AXIS_SIZE)));
}

/**
 * Category labels under points or columns, thinned and kept inside the
 * plot: the first and last are anchored to the edge when centring would
 * push them out.
 */
export function CategoryLabels({
  labels,
  shown,
  x,
  y,
  width,
}: {
  labels: string[];
  shown: number[];
  x: (i: number) => number;
  y: number;
  width: number;
}) {
  return (
    <g>
      {shown.map((i) => {
        const w = textWidth(labels[i], AXIS_SIZE);
        const cx = x(i);
        let anchor: 'start' | 'middle' | 'end' = 'middle';
        let px = cx;
        if (cx - w / 2 < 0) {
          anchor = 'start';
          px = 0;
        } else if (cx + w / 2 > width) {
          anchor = 'end';
          px = width;
        }
        return (
          <AxisText key={i} x={px} y={y} anchor={anchor}>
            {labels[i]}
          </AxisText>
        );
      })}
    </g>
  );
}
