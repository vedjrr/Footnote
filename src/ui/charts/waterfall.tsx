'use client';

/**
 * Waterfall: where a change came from. One row per step between two totals,
 * drawn horizontally so long segment names have room. Rise is series blue,
 * fall is series orange, totals are context grey; the sign and the words
 * say the direction too (ui-ux-rules §2, §7).
 *
 * When the steps are small next to the totals, a bar from zero would make
 * every step a sliver. The axis then zooms to the walk between the totals,
 * the totals are drawn as ticks rather than bars, and a note under the
 * chart says the axis does not start at zero (D-037).
 */
import { ChartFrame, Plot } from './frame';
import { formatChange, formatValue, onMarks } from './format';
import type { ValueFormat } from './format';
import { layoutHBars } from './hbars';
import type { HRow } from './hbars';
import { FALL, RISE, TOTAL } from './palette';

export type WaterfallProps = {
  title?: string;
  summary: string;
  start: { label: string; value: number };
  steps: Array<{ label: string; value: number }>;
  end: { label: string; value: number };
  /** What the steps are, for the table header. Default "Step". */
  categoryName?: string;
  format?: ValueFormat;
  /** The step the sentence is about; its value label is set in ink. */
  emphasis?: string;
  empty?: string;
};

/** Steps below this share of the largest total make the axis zoom. */
const ZOOM_BELOW = 0.25;

export function waterfallZooms(start: number, steps: number[], end: number): boolean {
  let walk = start;
  let lo = Math.min(start, end);
  let hi = Math.max(start, end);
  for (const s of steps) {
    walk += s;
    lo = Math.min(lo, walk);
    hi = Math.max(hi, walk);
  }
  const biggest = Math.max(Math.abs(start), Math.abs(end));
  if (biggest === 0) return false;
  // Zoom only when zero is outside the walk and the walk is narrow.
  const crossesZero = lo <= 0 && hi >= 0;
  return !crossesZero && (hi - lo) / biggest < ZOOM_BELOW;
}

export function Waterfall(props: WaterfallProps) {
  const { start, steps, end, format = {}, emphasis } = props;
  const zoom = waterfallZooms(
    start.value,
    steps.map((s) => s.value),
    end.value,
  );
  const rows: HRow[] = [];
  rows.push({
    label: start.label,
    from: zoom ? start.value : 0,
    to: start.value,
    color: zoom ? null : TOTAL,
    text: formatValue(start.value, onMarks(format)),
  });
  let walk = start.value;
  for (const s of steps) {
    rows.push({
      label: s.label,
      from: walk,
      to: walk + s.value,
      color: s.value >= 0 ? RISE : FALL,
      text: formatChange(s.value, onMarks(format)),
      strong: s.label === emphasis,
    });
    walk += s.value;
  }
  rows.push({
    label: end.label,
    from: zoom ? end.value : 0,
    to: end.value,
    color: zoom ? null : TOTAL,
    text: formatValue(end.value, onMarks(format)),
  });
  const emphasisIndex = steps.findIndex((s) => s.label === emphasis);
  return (
    <ChartFrame
      title={props.title}
      summary={props.summary}
      empty={
        steps.length === 0 ? (props.empty ?? 'Nothing changed between the two totals.') : undefined
      }
      table={{
        caption: props.title ?? props.summary,
        columns: [props.categoryName ?? 'Step', 'Change', 'Running total'],
        rows: rows.map((r, i) => [
          r.label,
          i === 0 || i === rows.length - 1 ? '' : formatChange(r.to - r.from, format),
          formatValue(r.to, format),
        ]),
      }}
    >
      <Plot
        label={props.summary}
        defaultIndex={emphasisIndex >= 0 ? emphasisIndex + 1 : 1}
        layout={(width, active) => {
          const l = layoutHBars(rows, width, {
            zero: !zoom,
            connectors: true,
            isActive: (i) => i === active,
          });
          return {
            ...l,
            tip: (i) => {
              const r = rows[i];
              const total = i === 0 || i === rows.length - 1;
              return {
                title: r.label,
                rows: total
                  ? [{ value: formatValue(r.to, format) }]
                  : [
                      { value: formatChange(r.to - r.from, format) },
                      { name: 'running total', value: formatValue(r.to, format) },
                    ],
              };
            },
          };
        }}
      />
      {zoom && (
        <p className="type-caption text-ink-3">
          The axis does not start at zero, so that the steps can be read. Totals are marked with a
          line.
        </p>
      )}
    </ChartFrame>
  );
}
