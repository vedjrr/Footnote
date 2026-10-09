'use client';

/**
 * Ranked horizontal bars: one measure across the values of one column,
 * largest first. ui-ux-rules §7.
 */
import { ChartFrame, Plot } from './frame';
import { formatValue } from './format';
import type { ValueFormat } from './format';
import { layoutHBars } from './hbars';
import type { HRow } from './hbars';
import { seriesColor } from './palette';

export type BarItem = {
  label: string;
  value: number;
  /** Written after the value, e.g. a change: "+12.4%". */
  detail?: string;
};

export type RankedBarsProps = {
  title?: string;
  summary: string;
  items: BarItem[];
  /** What the labels are, for the table header. Default "Value". */
  categoryName?: string;
  /** What the values are, for the table header. Default "Amount". */
  valueName?: string;
  format?: ValueFormat;
  /** The label the sentence is about; the other bars turn grey. */
  emphasis?: string;
  /** Keep the given order (for ordered categories). Default: largest first. */
  ordered?: boolean;
  empty?: string;
};

export function RankedBars(props: RankedBarsProps) {
  const { format = {}, emphasis } = props;
  const items = props.ordered ? props.items : [...props.items].sort((a, b) => b.value - a.value);
  const emphasisIndex =
    emphasis === undefined ? undefined : items.findIndex((it) => it.label === emphasis);
  const text = (it: BarItem) =>
    it.detail ? `${formatValue(it.value, format)}  ${it.detail}` : formatValue(it.value, format);
  const rows: HRow[] = items.map((it, i) => ({
    label: it.label,
    from: 0,
    to: it.value,
    color: emphasisIndex === undefined ? seriesColor(0) : seriesColor(i, emphasisIndex),
    text: text(it),
    strong: i === emphasisIndex,
  }));
  const hasDetail = items.some((it) => it.detail);
  return (
    <ChartFrame
      title={props.title}
      summary={props.summary}
      empty={items.length === 0 ? (props.empty ?? 'There are no values to draw.') : undefined}
      table={{
        caption: props.title ?? props.summary,
        columns: [
          props.categoryName ?? 'Value',
          props.valueName ?? 'Amount',
          ...(hasDetail ? ['Change'] : []),
        ],
        rows: items.map((it) => [
          it.label,
          formatValue(it.value, format),
          ...(hasDetail ? [it.detail ?? ''] : []),
        ]),
      }}
    >
      <Plot
        label={props.summary}
        defaultIndex={emphasisIndex !== undefined && emphasisIndex >= 0 ? emphasisIndex : 0}
        layout={(width, active) => {
          const l = layoutHBars(rows, width, { activeIndex: active });
          return {
            ...l,
            tip: (i) => ({ title: items[i].label, rows: [{ value: text(items[i]) }] }),
          };
        }}
      />
    </ChartFrame>
  );
}
