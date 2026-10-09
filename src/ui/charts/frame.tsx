'use client';

/**
 * What every chart shares: the figure, its legend, the switch to a table,
 * the empty case, and the plot that measures its width, takes keyboard
 * focus and shows one tooltip. ui-ux-rules §7 and §11.
 */
import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/ui/button';
import { cx } from '@/ui/cx';
import { SERVER_WIDTH } from './layout';

export type LegendItem = { name: string; color: string; key: 'line' | 'rect' };

export type TableView = {
  caption: string;
  columns: string[];
  /** The first cell of each row is its header. */
  rows: string[][];
  /** Columns after the first that hold numbers, right-aligned. Default: all. */
  numeric?: boolean[];
};

export type Tip = {
  title: string;
  rows: Array<{ name?: string; value: string; color?: string; key?: 'line' | 'rect' }>;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type PlotLayout = {
  height: number;
  /** The marks, drawn for this width with `active` shown. */
  svg: ReactNode;
  /**
   * One hit area per point, in the order arrow keys move through them. A
   * point drawn in several places (small multiples) has one area per place.
   */
  targets: Array<Rect | Rect[]>;
  /** Where the tooltip for point `i` points at; `part` is the place hovered. */
  anchor: (i: number, part: number) => { x: number; y: number };
  tip: (i: number) => Tip;
};

export function ChartFrame({
  title,
  summary,
  legend,
  table,
  empty,
  children,
}: {
  /** Shown above the chart. Optional: the sentence beside a chart often names it. */
  title?: string;
  /** One sentence saying what the chart shows. The plot's accessible name. */
  summary: string;
  legend?: LegendItem[];
  table: TableView;
  /** Shown instead of the chart when there is nothing to draw. */
  empty?: string;
  children: ReactNode;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <figure className="flex min-w-0 flex-col gap-3" data-chart>
      {(title || !empty) && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {title ? (
            <figcaption className="type-small font-medium text-ink">{title}</figcaption>
          ) : (
            <span />
          )}
          {!empty && (
            <Button
              variant="quiet"
              className="type-caption"
              aria-pressed={view === 'table'}
              onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
            >
              {view === 'chart' ? 'Show as table' : 'Show as chart'}
            </Button>
          )}
        </div>
      )}
      {empty ? (
        <p className="type-small text-ink-2">{empty}</p>
      ) : view === 'table' ? (
        <ChartTable table={table} />
      ) : (
        <>
          {legend && legend.length > 1 && <Legend items={legend} />}
          {children}
        </>
      )}
      {!title && <figcaption className="sr-only">{summary}</figcaption>}
    </figure>
  );
}

function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Legend">
      {items.map((item) => (
        <li key={item.name} className="flex min-w-0 items-center gap-2 type-caption text-ink-2">
          <Key color={item.color} kind={item.key} />
          <span className="min-w-0 break-words">{item.name}</span>
        </li>
      ))}
    </ul>
  );
}

export function Key({ color, kind }: { color: string; kind: 'line' | 'rect' }) {
  return kind === 'line' ? (
    <svg width="16" height="8" aria-hidden className="shrink-0">
      <line x1="1" x2="15" y1="4" y2="4" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ) : (
    <svg width="10" height="10" aria-hidden className="shrink-0">
      <rect width="10" height="10" rx="2" fill={color} />
    </svg>
  );
}

export function ChartTable({ table }: { table: TableView }) {
  return (
    <div className="fn-table-wrap">
      <table className="fn-table">
        <caption>{table.caption}</caption>
        <thead>
          <tr>
            {table.columns.map((c, i) => (
              <th
                key={i}
                scope="col"
                className={cx(i > 0 && (table.numeric?.[i - 1] ?? true) && 'num')}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className={cx((table.numeric?.[i - 1] ?? true) && 'num')}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Measures the container; the server and the first render use `fallback`. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const w = Math.floor(el.getBoundingClientRect().width);
      if (w > 0) setWidth(w);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, width: width ?? fallback, measured: width !== null };
}

/**
 * The interactive plot. It is one tab stop; arrow keys move between the
 * points, Home and End jump to the ends, Escape hides the tooltip. Hover
 * shows the same as focus. The point read out is announced politely.
 */
export function Plot({
  label,
  defaultIndex,
  layout,
  fallbackWidth = SERVER_WIDTH,
}: {
  label: string;
  /** The point shown when the plot first takes focus. Default: the last. */
  defaultIndex?: number;
  layout: (width: number, active: number | null) => PlotLayout;
  fallbackWidth?: number;
}) {
  const { ref, width } = useWidth(fallbackWidth);
  const [active, setActive] = useState<number | null>(null);
  const [part, setPart] = useState(0);
  const hintId = useId();
  const plot = layout(width, active);
  const count = plot.targets.length;

  const move = useCallback(
    (to: number) => {
      if (count === 0) return;
      setPart(0);
      setActive(Math.max(0, Math.min(count - 1, to)));
    },
    [count],
  );
  const hover = (i: number, p: number) => {
    if (active !== i || part !== p) {
      setActive(i);
      setPart(p);
    }
  };

  function onKeyDown(event: KeyboardEvent) {
    const current = active ?? defaultIndex ?? count - 1;
    const keys: Record<string, () => void> = {
      ArrowRight: () => move(current + 1),
      ArrowDown: () => move(current + 1),
      ArrowLeft: () => move(current - 1),
      ArrowUp: () => move(current - 1),
      Home: () => move(0),
      End: () => move(count - 1),
      Escape: () => setActive(null),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  }

  const tip = active !== null && active < count ? plot.tip(active) : null;
  const anchor = active !== null && active < count ? plot.anchor(active, part) : null;

  return (
    <div ref={ref} className="relative min-w-0">
      <div
        role="group"
        aria-roledescription="chart"
        aria-label={label}
        aria-describedby={hintId}
        tabIndex={0}
        className="block rounded-sm"
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (e.target === e.currentTarget && active === null) move(defaultIndex ?? count - 1);
        }}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        <svg
          width="100%"
          viewBox={`0 0 ${width} ${plot.height}`}
          className="block h-auto overflow-visible font-sans"
          aria-hidden
          data-plot
        >
          {plot.svg}
          <g fill="transparent">
            {plot.targets.map((target, i) =>
              (Array.isArray(target) ? target : [target]).map((t, p) => (
                <rect
                  key={`${i}-${p}`}
                  x={t.x}
                  y={t.y}
                  width={Math.max(t.w, 0)}
                  height={Math.max(t.h, 0)}
                  onPointerEnter={() => hover(i, p)}
                  onPointerMove={() => hover(i, p)}
                />
              )),
            )}
          </g>
        </svg>
      </div>
      <span id={hintId} className="sr-only">
        Use the arrow keys to read each value.
      </span>
      <div className="sr-only" aria-live="polite">
        {tip ? tipText(tip) : ''}
      </div>
      {tip && anchor && <Tooltip tip={tip} anchor={anchor} width={width} height={plot.height} />}
    </div>
  );
}

function tipText(tip: Tip): string {
  return [tip.title, ...tip.rows.map((r) => (r.name ? `${r.name} ${r.value}` : r.value))].join(
    '. ',
  );
}

function Tooltip({
  tip,
  anchor,
  width,
  height,
}: {
  tip: Tip;
  anchor: { x: number; y: number };
  width: number;
  height: number;
}) {
  // Beside the point, on the side with more room; never measured.
  const onLeft = anchor.x > width / 2;
  const maxWidth = Math.max(140, Math.min(260, (onLeft ? anchor.x : width - anchor.x) - 16));
  const top = Math.max(0, Math.min(anchor.y - 16, height - 48));
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 flex flex-col gap-1 rounded-sm border border-rule bg-paper px-3 py-2 shadow-float"
      style={{
        top,
        maxWidth,
        ...(onLeft ? { right: width - anchor.x + 12 } : { left: anchor.x + 12 }),
      }}
    >
      <span className="type-caption text-ink-3">{tip.title}</span>
      {tip.rows.map((row, i) => (
        <span key={i} className="flex items-center gap-2 type-caption">
          {row.color && <Key color={row.color} kind={row.key ?? 'line'} />}
          <span className="font-semibold text-ink tabular-nums">{row.value}</span>
          {row.name && <span className="min-w-0 break-words text-ink-2">{row.name}</span>}
        </span>
      ))}
    </div>
  );
}
