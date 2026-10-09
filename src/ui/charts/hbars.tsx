/**
 * The horizontal bar layout shared by ranked bars, the waterfall, columns
 * that are too narrow for their labels, and bar small multiples. Labels sit
 * in a column on the left, or above each bar when they would need more
 * than two lines there. Values sit outside the bar end and the scale makes
 * room for them, so nothing is clipped.
 */
import { scaleLinear } from 'd3-scale';
import type { ReactNode } from 'react';
import type { Rect } from './frame';
import { BAR_MAX, GAP, LABEL_SIZE, LINE_HEIGHT, barPath, crisp, valueTicks } from './layout';
import { AXIS_TEXT, GRID, HOVER, LABEL_TEXT, STRONG_TEXT } from './palette';
import { textWidth, wrapText } from './text';

export type HRow = {
  label: string;
  from: number;
  to: number;
  /** Bar colour, or null for a total drawn as a tick at `to` (zoomed axis). */
  color: string | null;
  /** Value label beside the bar end. */
  text: string;
  /** Written after the value in a quieter ink, e.g. a change: "+3.8%". */
  detail?: string;
  /** Draw the value label in ink and semibold: the bar the sentence is about. */
  strong?: boolean;
  /** Sits 2 px under the row before, as the next bar of the same group. */
  tight?: boolean;
};

export type HBarsLayout = {
  height: number;
  svg: ReactNode;
  targets: Rect[];
  anchor: (i: number) => { x: number; y: number };
};

const BAR = 20;
const ROW_GAP = 12;
const VALUE_PAD = 6;

export function layoutHBars(
  rows: HRow[],
  width: number,
  {
    domain: fixedDomain,
    zero = true,
    connectors = false,
    isActive = () => false,
  }: {
    domain?: [number, number];
    zero?: boolean;
    connectors?: boolean;
    isActive?: (row: number) => boolean;
  } = {},
): HBarsLayout {
  const thick = Math.min(BAR, BAR_MAX);
  const labelCol = Math.min(
    Math.max(0, ...rows.map((r) => textWidth(r.label, LABEL_SIZE))),
    width * 0.38,
  );
  const sideLines = rows.map((r) => wrapText(r.label, Math.max(labelCol, 1), LABEL_SIZE));
  const stacked = sideLines.some((l) => l.length > 2);
  const lines = (stacked ? rows.map((r) => wrapText(r.label, width, LABEL_SIZE)) : sideLines).map(
    (l) => (l.length === 1 && l[0] === '' ? [] : l),
  );
  const valueText = (r: HRow) => (r.detail ? `${r.text}  ${r.detail}` : r.text);
  const plotLeft = stacked ? 0 : labelCol + 12;

  const domain =
    fixedDomain ??
    valueTicks(
      rows.flatMap((r) => (r.color === null && !zero ? [r.to] : [r.from, r.to])),
      { zero },
    ).domain;

  // Find left and right room for the value labels, then rebuild the scale.
  let padL = 0;
  let padR = 0;
  let x = scaleLinear().domain(domain).range([plotLeft, width]);
  for (let pass = 0; pass < 3; pass++) {
    x = scaleLinear()
      .domain(domain)
      .range([plotLeft + padL, Math.max(plotLeft + padL + 1, width - padR)]);
    let needL = 0;
    let needR = 0;
    for (const r of rows) {
      const w = textWidth(valueText(r), LABEL_SIZE) + VALUE_PAD;
      if (r.to >= r.from) needR = Math.max(needR, x(Math.max(r.from, r.to)) + w - width);
      else needL = Math.max(needL, plotLeft - (x(Math.min(r.from, r.to)) - w));
    }
    if (needL <= 0.5 && needR <= 0.5) break;
    padL += Math.max(0, needL);
    padR += Math.max(0, needR);
  }

  const gapBefore = (i: number) => (i === 0 ? 0 : rows[i].tight ? GAP : ROW_GAP);
  const gapAfter = (i: number) => (i === rows.length - 1 ? 0 : gapBefore(i + 1));
  let y = 0;
  const bands = rows.map((_, i) => {
    y += gapBefore(i);
    const labelH = lines[i].length * LINE_HEIGHT;
    const top = y;
    const barY = stacked
      ? top + (labelH ? labelH + 4 : 0)
      : top + Math.max(0, (Math.min(labelH, 2 * LINE_HEIGHT) - thick) / 2);
    const rowH = stacked ? (labelH ? labelH + 4 : 0) + thick : Math.max(thick, labelH);
    y += rowH;
    return { top, barY, rowH, labelH };
  });
  const height = Math.max(y, 1) + 2;
  const band = (i: number) => ({
    y: bands[i].top - gapBefore(i) / 2,
    h: bands[i].rowH + gapBefore(i) / 2 + gapAfter(i) / 2,
  });

  const zeroX = domain[0] <= 0 && domain[1] >= 0 ? x(0) : null;

  const svg = (
    <>
      {zeroX !== null && (
        <line
          x1={crisp(zeroX)}
          x2={crisp(zeroX)}
          y1={0}
          y2={height}
          stroke={GRID}
          strokeWidth={1}
        />
      )}
      {rows.map((r, i) => {
        const b = bands[i];
        const lo = Math.min(r.from, r.to);
        const hi = Math.max(r.from, r.to);
        const x0 = x(lo);
        const x1 = x(hi);
        const mid = b.barY + thick / 2;
        const rise = r.to >= r.from;
        const labelTop = stacked ? b.top : b.top + Math.max(0, (thick - b.labelH) / 2);
        return (
          <g key={i}>
            {isActive(i) && (
              <rect x={0} y={band(i).y} width={width} height={band(i).h} fill={HOVER} />
            )}
            <text fill={LABEL_TEXT} fontSize={LABEL_SIZE}>
              {lines[i].map((line, k) => (
                <tspan key={k} x={0} y={labelTop + (k + 1) * LINE_HEIGHT - 4}>
                  {line}
                </tspan>
              ))}
            </text>
            {r.color === null ? (
              <line
                x1={crisp(x(r.to))}
                x2={crisp(x(r.to))}
                y1={b.barY}
                y2={b.barY + thick}
                stroke={STRONG_TEXT}
                strokeWidth={2}
              />
            ) : (
              <path
                d={barPath(x0, b.barY, Math.max(x1 - x0, 1), thick, rise ? 'right' : 'left')}
                fill={r.color}
              />
            )}
            <text
              x={rise ? x1 + VALUE_PAD : x0 - VALUE_PAD}
              y={mid + 4}
              textAnchor={rise ? 'start' : 'end'}
              fill={r.strong ? STRONG_TEXT : LABEL_TEXT}
              fontWeight={r.strong ? 600 : 400}
              fontSize={LABEL_SIZE}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {r.text}
              {r.detail && (
                <tspan dx={6} fill={AXIS_TEXT} fontWeight={400}>
                  {r.detail}
                </tspan>
              )}
            </text>
          </g>
        );
      })}
      {connectors &&
        rows.slice(0, -1).map((r, i) => {
          const next = bands[i + 1];
          const px = crisp(x(r.to));
          return (
            <line
              key={`c${i}`}
              x1={px}
              x2={px}
              y1={bands[i].barY + thick}
              y2={next.barY}
              stroke={GRID}
              strokeWidth={1}
            />
          );
        })}
    </>
  );

  return {
    height,
    svg,
    targets: bands.map((_, i) => ({ x: 0, ...band(i), w: width })),
    anchor: (i) => {
      const r = rows[i];
      return { x: x(Math.max(r.from, r.to)), y: bands[i].barY };
    },
  };
}
