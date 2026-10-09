/**
 * The chart palette. ui-ux-rules §7.
 *
 * The hex values live once, in `src/ui/tokens.css`, for both themes, and
 * were validated there with the dataviz skill's script (see the T22
 * handoff). This file is the one place that says which token plays which
 * role, so a chart never picks a colour itself.
 */

/** Series colours in the order they are used. Never more than four. */
export const SERIES = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
] as const;

export const MAX_SERIES = SERIES.length;

/** Everything that is not the point of the chart. */
export const CONTEXT = 'var(--series-context)';

/** The series the sentence is about, when one is emphasised. */
export const EMPHASIS = SERIES[0];

/** Waterfall and change bars: colour says direction, not good or bad. */
export const RISE = SERIES[0];
export const FALL = SERIES[1];

/** Totals in a waterfall are context, not change. */
export const TOTAL = CONTEXT;

/** Chart chrome. Text always wears an ink token, never a series colour. */
export const SURFACE = 'var(--paper)';
export const GRID = 'var(--rule)';
export const HOVER = 'var(--wash)';
export const AXIS_TEXT = 'var(--ink-3)';
export const LABEL_TEXT = 'var(--ink-2)';
export const STRONG_TEXT = 'var(--ink)';

/**
 * The colour of series `index` (0-based) among `count` series, with an
 * optional emphasised index. With emphasis, that series is series blue and
 * every other one is context grey. Colour follows the series' position in
 * the data, never its rank, so a series keeps its colour when others go.
 */
export function seriesColor(index: number, emphasis?: number): string {
  if (emphasis !== undefined && emphasis >= 0) return index === emphasis ? EMPHASIS : CONTEXT;
  if (index < 0 || index >= SERIES.length) {
    throw new Error(`A chart shows at most ${MAX_SERIES} series; got series ${index + 1}`);
  }
  return SERIES[index];
}
